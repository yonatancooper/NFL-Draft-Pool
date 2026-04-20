import os
import uuid
import json
import datetime
from contextlib import asynccontextmanager
from pathlib import Path

import bcrypt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db, Base
from models import Prospect, User, Pick, Result, Score, SavedDraft
from schemas import (
    ProspectOut, SubmissionIn, SubmissionOut, PickOut,
    AdminResultsIn, ScoreOut, EntryDetailOut, EntryDetailPick,
    SaveDraftIn, LoadDraftIn, SaveDraftOut, EditEntryIn,
)
from scoring import load_scoring_config, score_submission
from seed import seed


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def run_migrations():
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("users")]
        if "password_hash" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    seed()
    yield


app = FastAPI(title="NFL Draft Pool", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "draftadmin2026")

# ── Draft order (2026 NFL Draft) ──────────────────────────────────────────
DRAFT_ORDER = [
    {"pick": 1,  "team": "Las Vegas Raiders", "abbr": "LV"},
    {"pick": 2,  "team": "New York Jets", "abbr": "NYJ"},
    {"pick": 3,  "team": "Arizona Cardinals", "abbr": "ARI"},
    {"pick": 4,  "team": "Tennessee Titans", "abbr": "TEN"},
    {"pick": 5,  "team": "New York Giants", "abbr": "NYG"},
    {"pick": 6,  "team": "Cleveland Browns", "abbr": "CLE"},
    {"pick": 7,  "team": "Washington Commanders", "abbr": "WAS"},
    {"pick": 8,  "team": "New Orleans Saints", "abbr": "NO"},
    {"pick": 9,  "team": "Kansas City Chiefs", "abbr": "KC"},
    {"pick": 10, "team": "New York Giants (from CIN)", "abbr": "NYG"},
    {"pick": 11, "team": "Miami Dolphins", "abbr": "MIA"},
    {"pick": 12, "team": "Dallas Cowboys", "abbr": "DAL"},
    {"pick": 13, "team": "Los Angeles Rams (from ATL)", "abbr": "LAR"},
    {"pick": 14, "team": "Baltimore Ravens", "abbr": "BAL"},
    {"pick": 15, "team": "Tampa Bay Buccaneers", "abbr": "TB"},
    {"pick": 16, "team": "New York Jets (from IND)", "abbr": "NYJ"},
    {"pick": 17, "team": "Detroit Lions", "abbr": "DET"},
    {"pick": 18, "team": "Minnesota Vikings", "abbr": "MIN"},
    {"pick": 19, "team": "Carolina Panthers", "abbr": "CAR"},
    {"pick": 20, "team": "Dallas Cowboys (from GB)", "abbr": "DAL"},
    {"pick": 21, "team": "Pittsburgh Steelers", "abbr": "PIT"},
    {"pick": 22, "team": "Los Angeles Chargers", "abbr": "LAC"},
    {"pick": 23, "team": "Philadelphia Eagles", "abbr": "PHI"},
    {"pick": 24, "team": "Cleveland Browns (from JAX)", "abbr": "CLE"},
    {"pick": 25, "team": "Chicago Bears", "abbr": "CHI"},
    {"pick": 26, "team": "Buffalo Bills", "abbr": "BUF"},
    {"pick": 27, "team": "San Francisco 49ers", "abbr": "SF"},
    {"pick": 28, "team": "Houston Texans", "abbr": "HOU"},
    {"pick": 29, "team": "Kansas City Chiefs (from LAR)", "abbr": "KC"},
    {"pick": 30, "team": "Miami Dolphins (from DEN)", "abbr": "MIA"},
    {"pick": 31, "team": "New England Patriots", "abbr": "NE"},
    {"pick": 32, "team": "Seattle Seahawks", "abbr": "SEA"},
]


# ── Prospects ─────────────────────────────────────────────────────────────

@app.get("/api/prospects", response_model=list[ProspectOut])
def get_prospects(db: Session = Depends(get_db)):
    return db.query(Prospect).order_by(Prospect.consensus_rank).all()


# ── Draft order ───────────────────────────────────────────────────────────

@app.get("/api/draft-order")
def get_draft_order():
    return DRAFT_ORDER


# ── Scoring config ───────────────────────────────────────────────────────

@app.get("/api/scoring-config")
def get_scoring_config():
    return load_scoring_config()


# ── Check email ──────────────────────────────────────────────────────────

@app.get("/api/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if user:
        return {"submitted": True, "token": user.submission_token}
    return {"submitted": False}


# ── Save draft (pre-submission progress) ─────────────────────────────────

@app.post("/api/drafts/save")
def save_draft(data: SaveDraftIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    if not data.password or len(data.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters.")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(400, "You have already submitted your entry. Saved drafts are locked.")

    saved = db.query(SavedDraft).filter(SavedDraft.email == email).first()
    if saved:
        if not verify_password(data.password, saved.password_hash):
            raise HTTPException(403, "Wrong password for this email.")
        saved.first_name = data.first_name.strip()
        saved.last_name = data.last_name.strip()
        saved.board_json = json.dumps(data.board)
        saved.updated_at = datetime.datetime.utcnow()
    else:
        saved = SavedDraft(
            email=email,
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            password_hash=hash_password(data.password),
            board_json=json.dumps(data.board),
        )
        db.add(saved)
    db.commit()
    db.refresh(saved)
    return {
        "email": saved.email,
        "first_name": saved.first_name,
        "last_name": saved.last_name,
        "board": json.loads(saved.board_json),
        "updated_at": saved.updated_at,
    }


@app.post("/api/drafts/load")
def load_draft(data: LoadDraftIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    if not data.password:
        raise HTTPException(400, "Password is required.")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        return {"submitted": True, "token": existing_user.submission_token}

    saved = db.query(SavedDraft).filter(SavedDraft.email == email).first()
    if not saved:
        return {"found": False}

    if not verify_password(data.password, saved.password_hash):
        raise HTTPException(403, "Wrong password.")

    return {
        "found": True,
        "submitted": False,
        "email": saved.email,
        "first_name": saved.first_name,
        "last_name": saved.last_name,
        "board": json.loads(saved.board_json),
        "updated_at": saved.updated_at,
    }


# ── Submit entry ─────────────────────────────────────────────────────────

@app.post("/api/submit", response_model=SubmissionOut)
def submit_entry(data: SubmissionIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    if not data.password or len(data.password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "This email has already submitted an entry.")

    # If a saved draft exists, verify password matches
    saved = db.query(SavedDraft).filter(SavedDraft.email == email).first()
    if saved and not verify_password(data.password, saved.password_hash):
        raise HTTPException(403, "Wrong password for this email.")

    if len(data.picks) != 32:
        raise HTTPException(400, "Exactly 32 picks are required.")

    slots = [p.slot_number for p in data.picks]
    if sorted(slots) != list(range(1, 33)):
        raise HTTPException(400, "Must fill slots 1-32 exactly once each.")

    prospect_ids = [p.prospect_id for p in data.picks]
    if len(set(prospect_ids)) != 32:
        raise HTTPException(400, "Duplicate prospects are not allowed.")

    count = db.query(Prospect).filter(Prospect.id.in_(prospect_ids)).count()
    if count != 32:
        raise HTTPException(400, "One or more prospect IDs are invalid.")

    token = uuid.uuid4().hex[:12]
    pw_hash = hash_password(data.password)
    if saved:
        pw_hash = saved.password_hash
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=email,
        password_hash=pw_hash,
        submission_token=token,
    )
    db.add(user)
    db.flush()

    for p in data.picks:
        db.add(Pick(user_id=user.id, slot_number=p.slot_number, prospect_id=p.prospect_id))

    # Clean up saved draft
    db.query(SavedDraft).filter(SavedDraft.email == email).delete()

    db.commit()
    db.refresh(user)

    picks_out = []
    for pick in sorted(user.picks, key=lambda x: x.slot_number):
        picks_out.append(PickOut(slot_number=pick.slot_number, prospect=pick.prospect))

    return SubmissionOut(
        token=token,
        first_name=user.first_name,
        last_name=user.last_name,
        submitted_at=user.submitted_at,
        picks=picks_out,
    )


# ── View entry ───────────────────────────────────────────────────────────

@app.get("/api/entry/{token}")
def get_entry(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.submission_token == token).first()
    if not user:
        raise HTTPException(404, "Entry not found.")

    picks = sorted(user.picks, key=lambda x: x.slot_number)
    results = {r.slot_number: r for r in db.query(Result).all()}
    has_results = len(results) > 0

    actual_by_prospect = {}
    if has_results:
        actual_by_prospect = {r.prospect_id: r.slot_number for r in results.values()}

    config = load_scoring_config() if has_results else None

    pick_details = []
    for p in picks:
        detail = {
            "slot_number": p.slot_number,
            "predicted_prospect": p.prospect,
            "actual_prospect": results[p.slot_number].prospect if p.slot_number in results else None,
            "points": 0,
            "distance": None,
        }
        if has_results and p.prospect_id in actual_by_prospect:
            actual_slot = actual_by_prospect[p.prospect_id]
            distance = abs(p.slot_number - actual_slot)
            from scoring import compute_distance_points
            pts = compute_distance_points(distance, config)
            pts += config["player_in_board_bonus"]
            detail["points"] = pts
            detail["distance"] = distance
        pick_details.append(detail)

    total = sum(d["points"] for d in pick_details)
    exact = sum(1 for d in pick_details if d.get("distance") == 0)

    return {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "submitted_at": user.submitted_at,
        "token": user.submission_token,
        "total_score": total if has_results else None,
        "exact_picks": exact if has_results else None,
        "has_results": has_results,
        "picks": pick_details,
        "draft_order": DRAFT_ORDER,
    }


# ── Edit entry ──────────────────────────────────────────────────────────

DRAFT_LOCK = datetime.datetime(2026, 4, 23, 20, 0, 0)

@app.put("/api/entry/{token}/edit")
def edit_entry(token: str, data: EditEntryIn, db: Session = Depends(get_db)):
    now_et = datetime.datetime.utcnow() - datetime.timedelta(hours=4)
    if now_et >= DRAFT_LOCK:
        raise HTTPException(403, "Edits are locked — the draft has started.")

    user = db.query(User).filter(User.submission_token == token).first()
    if not user:
        raise HTTPException(404, "Entry not found.")

    if not user.password_hash:
        raise HTTPException(400, "This entry has no password set. Contact admin.")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(403, "Wrong password.")

    if len(data.picks) != 32:
        raise HTTPException(400, "Exactly 32 picks are required.")
    slots = [p.slot_number for p in data.picks]
    if sorted(slots) != list(range(1, 33)):
        raise HTTPException(400, "Must fill slots 1-32 exactly once each.")
    prospect_ids = [p.prospect_id for p in data.picks]
    if len(set(prospect_ids)) != 32:
        raise HTTPException(400, "Duplicate prospects are not allowed.")
    count = db.query(Prospect).filter(Prospect.id.in_(prospect_ids)).count()
    if count != 32:
        raise HTTPException(400, "One or more prospect IDs are invalid.")

    db.query(Pick).filter(Pick.user_id == user.id).delete()
    for p in data.picks:
        db.add(Pick(user_id=user.id, slot_number=p.slot_number, prospect_id=p.prospect_id))

    user.submitted_at = datetime.datetime.utcnow()
    db.commit()

    return {"message": "Picks updated successfully.", "token": token}


# ── Admin: submit results ───────────────────────────────────────────────

@app.post("/api/admin/results")
def submit_results(data: AdminResultsIn, db: Session = Depends(get_db)):
    if data.password != ADMIN_PASSWORD:
        raise HTTPException(403, "Invalid admin password.")
    if len(data.results) != 32:
        raise HTTPException(400, "Exactly 32 player names required.")

    db.query(Score).delete()
    db.query(Result).delete()

    config = load_scoring_config()

    for i, name in enumerate(data.results, start=1):
        prospect = db.query(Prospect).filter(Prospect.name == name.strip()).first()
        if not prospect:
            raise HTTPException(400, f"Prospect not found: '{name}' (pick {i}). Name must match exactly.")
        db.add(Result(slot_number=i, prospect_id=prospect.id))

    db.flush()

    actual_results = {}
    for r in db.query(Result).all():
        actual_results[r.slot_number] = r.prospect_id

    users = db.query(User).all()
    for user in users:
        user_picks = {p.slot_number: p.prospect_id for p in user.picks}
        total, exact = score_submission(user_picks, actual_results, config)
        db.add(Score(user_id=user.id, total_score=total, exact_picks=exact))

    db.commit()
    return {"message": f"Results saved. Scored {len(users)} submissions."}


# ── Admin: stats ─────────────────────────────────────────────────────────

@app.get("/api/admin/stats")
def admin_stats(password: str, db: Session = Depends(get_db)):
    if password != ADMIN_PASSWORD:
        raise HTTPException(403, "Invalid admin password.")
    sub_count = db.query(User).count()
    has_results = db.query(Result).count() > 0
    return {"submission_count": sub_count, "has_results": has_results}


# ── Leaderboard ──────────────────────────────────────────────────────────

@app.get("/api/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    has_results = db.query(Result).count() > 0

    if has_results:
        scores = (
            db.query(Score, User)
            .join(User, Score.user_id == User.id)
            .order_by(Score.total_score.desc())
            .all()
        )
        entries = []
        for rank, (score, user) in enumerate(scores, start=1):
            entries.append({
                "rank": rank,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "total_score": score.total_score,
                "exact_picks": score.exact_picks,
                "submitted_at": user.submitted_at,
                "token": user.submission_token,
            })
        return {"has_results": True, "entries": entries}

    # Pre-draft: show all entrants without scores
    users = db.query(User).order_by(User.submitted_at).all()
    entries = []
    for i, user in enumerate(users, start=1):
        entries.append({
            "rank": i,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "total_score": None,
            "exact_picks": None,
            "submitted_at": user.submitted_at,
            "token": user.submission_token,
        })
    return {"has_results": False, "entry_count": len(entries), "entries": entries}


# ── Admin: list all entries ──────────────────────────────────────────────

@app.get("/api/admin/entries")
def admin_list_entries(password: str, db: Session = Depends(get_db)):
    if password != ADMIN_PASSWORD:
        raise HTTPException(403, "Invalid admin password.")
    users = db.query(User).order_by(User.submitted_at).all()
    entries = []
    for user in users:
        picks = sorted(user.picks, key=lambda p: p.slot_number)
        entries.append({
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "token": user.submission_token,
            "submitted_at": user.submitted_at,
            "picks": [{"slot_number": p.slot_number, "prospect_id": p.prospect_id, "prospect_name": p.prospect.name} for p in picks],
        })
    return entries


# ── Admin: delete entry ──────────────────────────────────────────────────

@app.delete("/api/admin/entries/{user_id}")
def admin_delete_entry(user_id: int, password: str, db: Session = Depends(get_db)):
    if password != ADMIN_PASSWORD:
        raise HTTPException(403, "Invalid admin password.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Entry not found.")
    db.query(Score).filter(Score.user_id == user_id).delete()
    db.query(Pick).filter(Pick.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"message": f"Deleted entry for {user.first_name} {user.last_name}."}


# ── Admin: edit picks ───────────────────────────────────────────────────

@app.put("/api/admin/entries/{user_id}/picks")
def admin_edit_picks(user_id: int, data: dict, db: Session = Depends(get_db)):
    if data.get("password") != ADMIN_PASSWORD:
        raise HTTPException(403, "Invalid admin password.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Entry not found.")

    picks = data.get("picks", [])
    if len(picks) != 32:
        raise HTTPException(400, "Exactly 32 picks required.")

    slots = [p["slot_number"] for p in picks]
    if sorted(slots) != list(range(1, 33)):
        raise HTTPException(400, "Must fill slots 1-32 exactly once each.")

    prospect_ids = [p["prospect_id"] for p in picks]
    if len(set(prospect_ids)) != 32:
        raise HTTPException(400, "Duplicate prospects are not allowed.")

    count = db.query(Prospect).filter(Prospect.id.in_(prospect_ids)).count()
    if count != 32:
        raise HTTPException(400, "One or more prospect IDs are invalid.")

    # Delete old picks and insert new ones
    db.query(Pick).filter(Pick.user_id == user_id).delete()
    for p in picks:
        db.add(Pick(user_id=user_id, slot_number=p["slot_number"], prospect_id=p["prospect_id"]))

    # Re-score if results exist
    db.query(Score).filter(Score.user_id == user_id).delete()
    results = {r.slot_number: r.prospect_id for r in db.query(Result).all()}
    if results:
        config = load_scoring_config()
        user_picks = {p["slot_number"]: p["prospect_id"] for p in picks}
        total, exact = score_submission(user_picks, results, config)
        db.add(Score(user_id=user_id, total_score=total, exact_picks=exact))

    db.commit()
    return {"message": f"Updated picks for {user.first_name} {user.last_name}."}


# ── Serve frontend (production) ──────────────────────────────────────────

STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if STATIC_DIR.is_dir():
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(404, "Not found")
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
