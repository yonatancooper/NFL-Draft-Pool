"""
Live ESPN draft poller.

Polls ESPN's public NFL draft endpoint during the draft window, fuzzy-matches
each completed pick against the Prospect table, and writes high-confidence
matches to the Result table (triggering re-scoring). Low-confidence matches
are held in a pending queue for the admin to confirm via the admin panel.
"""
import asyncio
import datetime
import json
import logging
import os
import urllib.request
from collections import deque
from difflib import SequenceMatcher
from threading import Lock

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Prospect, Result, Score, User
from scoring import load_scoring_config, score_submission

log = logging.getLogger("espn_poller")
log.setLevel(logging.INFO)

ESPN_ENDPOINT = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/draft?season={year}"
DRAFT_YEAR = 2026
POOL_PICK_COUNT = 32
MATCH_THRESHOLD = 0.85

# Poll cadence (seconds)
POLL_PRE_DRAFT = 60      # before DRAFT_LOCK, just wait
POLL_ACTIVE = 20         # during active draft
POLL_POST_DRAFT = 120    # after all 32 captured, slow down

# Polling window: from DRAFT_LOCK onwards for this many hours
ACTIVE_WINDOW_HOURS = 12


_state_lock = Lock()
_state = {
    "enabled": os.getenv("ENABLE_LIVE_POLLER", "true").lower() in ("1", "true", "yes"),
    "last_poll_at": None,
    "last_error": None,
    "draft_status": None,
    "picks_processed": 0,
    "events": deque(maxlen=100),     # auto-applied + flagged, most recent last
    "pending": {},                    # overall -> flagged pick dict awaiting admin decision
}


def _record_event(kind: str, overall: int, message: str, extra: dict | None = None) -> None:
    with _state_lock:
        _state["events"].append({
            "kind": kind,  # "auto" | "flag" | "confirm" | "skip" | "error"
            "overall": overall,
            "message": message,
            "at": datetime.datetime.utcnow().isoformat() + "Z",
            **(extra or {}),
        })


def get_status() -> dict:
    with _state_lock:
        return {
            "enabled": _state["enabled"],
            "last_poll_at": _state["last_poll_at"],
            "last_error": _state["last_error"],
            "draft_status": _state["draft_status"],
            "picks_processed": _state["picks_processed"],
            "events": list(_state["events"])[-50:],
            "pending": list(_state["pending"].values()),
        }


def set_enabled(enabled: bool) -> None:
    with _state_lock:
        _state["enabled"] = enabled


# ── Matching ──────────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    return (
        (s or "")
        .lower()
        .replace(".", "")
        .replace("'", "")
        .replace("-", " ")
        .replace(" jr", "")
        .replace(" sr", "")
        .replace(" iii", "")
        .replace(" ii", "")
        .replace(" iv", "")
        .strip()
    )


def _match_prospect(player_name: str, school: str, prospects: list[Prospect]) -> tuple[Prospect | None, float]:
    target_name = _normalize(player_name)
    target_school = _normalize(school)
    best = None
    best_score = 0.0
    for p in prospects:
        name_sim = SequenceMatcher(None, target_name, _normalize(p.name)).ratio()
        school_sim = SequenceMatcher(None, target_school, _normalize(p.school)).ratio()
        score = name_sim * 0.8 + school_sim * 0.2
        if score > best_score:
            best_score = score
            best = p
    return best, best_score


# ── ESPN fetch ────────────────────────────────────────────────────────────

def _fetch_draft_sync(year: int) -> dict:
    url = ESPN_ENDPOINT.format(year=year)
    req = urllib.request.Request(url, headers={"User-Agent": "nfl-draft-pool/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


async def fetch_draft(year: int) -> dict:
    return await asyncio.to_thread(_fetch_draft_sync, year)


# ── Scoring (apply a Result) ──────────────────────────────────────────────

def _rescore_all(db: Session) -> None:
    config = load_scoring_config()
    actual = {r.slot_number: r.prospect_id for r in db.query(Result).all()}
    if not actual:
        return
    db.query(Score).delete()
    for user in db.query(User).all():
        user_picks = {p.slot_number: p.prospect_id for p in user.picks}
        total, exact = score_submission(user_picks, actual, config)
        db.add(Score(user_id=user.id, total_score=total, exact_picks=exact))


def apply_result(db: Session, slot_number: int, prospect_id: int) -> None:
    """Upsert a Result row and re-score all users."""
    existing = db.query(Result).filter(Result.slot_number == slot_number).first()
    if existing:
        existing.prospect_id = prospect_id
    else:
        db.add(Result(slot_number=slot_number, prospect_id=prospect_id))
    db.flush()
    _rescore_all(db)
    db.commit()


# ── Poll cycle ────────────────────────────────────────────────────────────

def _already_has_result(db: Session, slot_number: int) -> bool:
    return db.query(Result).filter(Result.slot_number == slot_number).first() is not None


def poll_once(year: int, raw_data: dict) -> None:
    """Process one ESPN payload: write auto-matches, queue flagged ones."""
    status = raw_data.get("status") or {}
    with _state_lock:
        _state["draft_status"] = {
            "state": status.get("state"),
            "description": status.get("description"),
        }

    db = SessionLocal()
    try:
        prospects = db.query(Prospect).all()
        picks = raw_data.get("picks", [])
        processed = 0
        for pick in picks:
            overall = pick.get("overall", 0)
            if overall < 1 or overall > POOL_PICK_COUNT:
                continue
            if pick.get("status") != "SELECTION_MADE":
                continue
            if _already_has_result(db, overall):
                processed += 1
                continue

            athlete = pick.get("athlete") or {}
            player_name = athlete.get("displayName", "")
            school = ((athlete.get("team") or {}).get("shortDisplayName")) or ""
            if not player_name:
                _record_event("skip", overall, f"No athlete data on pick {overall}")
                continue

            best, confidence = _match_prospect(player_name, school, prospects)
            if best is None:
                _record_event("skip", overall, f"No prospect match for {player_name!r}")
                continue

            common = {
                "player_name": player_name,
                "school": school,
                "matched_prospect_id": best.id,
                "matched_prospect_name": best.name,
                "matched_school": best.school,
                "confidence": round(confidence, 3),
            }

            if confidence >= MATCH_THRESHOLD:
                apply_result(db, overall, best.id)
                processed += 1
                _record_event(
                    "auto",
                    overall,
                    f"Pick {overall}: {player_name} ({school}) -> {best.name} [{best.school}]",
                    common,
                )
                with _state_lock:
                    _state["pending"].pop(overall, None)
            else:
                with _state_lock:
                    _state["pending"][overall] = {"overall": overall, **common}
                _record_event(
                    "flag",
                    overall,
                    f"Pick {overall}: {player_name} ({school}) needs admin confirmation (conf={confidence:.2f})",
                    common,
                )

        with _state_lock:
            _state["picks_processed"] = processed
    finally:
        db.close()


def admin_confirm_pending(overall: int, prospect_id: int) -> dict:
    """Admin confirms a flagged pick (or overrides with a different prospect_id)."""
    db = SessionLocal()
    try:
        prospect = db.query(Prospect).filter(Prospect.id == prospect_id).first()
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found")
        apply_result(db, overall, prospect_id)
        with _state_lock:
            _state["pending"].pop(overall, None)
        _record_event(
            "confirm",
            overall,
            f"Pick {overall}: admin confirmed -> {prospect.name}",
            {"matched_prospect_id": prospect_id, "matched_prospect_name": prospect.name},
        )
        return {"overall": overall, "prospect_id": prospect_id, "prospect_name": prospect.name}
    finally:
        db.close()


# ── Background loop ──────────────────────────────────────────────────────

async def poller_loop(draft_lock: datetime.datetime) -> None:
    """Run forever (until task cancelled). Respects the enabled flag and the draft window."""
    log.info("ESPN poller loop starting")
    window_end = draft_lock + datetime.timedelta(hours=ACTIVE_WINDOW_HOURS)

    while True:
        try:
            with _state_lock:
                enabled = _state["enabled"]

            if not enabled:
                await asyncio.sleep(POLL_PRE_DRAFT)
                continue

            now = datetime.datetime.utcnow() - datetime.timedelta(hours=4)  # approx ET
            past_window = now > window_end

            # Always fetch so the admin panel shows a live status heartbeat.
            # Pre-draft: poll_once is effectively a no-op (all picks ON_THE_CLOCK).
            data = await fetch_draft(DRAFT_YEAR)
            with _state_lock:
                _state["last_poll_at"] = datetime.datetime.utcnow().isoformat() + "Z"
                _state["last_error"] = None

            await asyncio.to_thread(poll_once, DRAFT_YEAR, data)

            if now < draft_lock:
                await asyncio.sleep(POLL_PRE_DRAFT)
                continue

            if past_window:
                log.info("Past active window, slowing poll cadence")
                await asyncio.sleep(POLL_POST_DRAFT * 4)
                continue

            # During active draft: pace based on how many picks we've captured
            db = SessionLocal()
            try:
                result_count = db.query(Result).count()
            finally:
                db.close()

            if result_count >= POOL_PICK_COUNT:
                await asyncio.sleep(POLL_POST_DRAFT)
            else:
                await asyncio.sleep(POLL_ACTIVE)

        except asyncio.CancelledError:
            log.info("ESPN poller loop cancelled")
            raise
        except Exception as e:
            log.exception("Poller error")
            with _state_lock:
                _state["last_error"] = f"{type(e).__name__}: {e}"
            _record_event("error", 0, f"Poller error: {e}")
            await asyncio.sleep(POLL_ACTIVE)
