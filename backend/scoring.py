import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "scoring_config.json")


def load_scoring_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def compute_distance_points(distance: int, config: dict) -> int:
    if distance == 0:
        return config["exact"]
    elif distance <= 2:
        return config["off_by_1_2"]
    elif distance <= 5:
        return config["off_by_3_5"]
    elif distance <= 10:
        return config["off_by_6_10"]
    elif distance <= 20:
        return config["off_by_11_20"]
    else:
        return config["off_by_21_plus"]


def score_submission(
    user_picks: dict[int, int],       # slot_number -> prospect_id
    actual_results: dict[int, int],   # slot_number -> prospect_id
    config: dict | None = None,
) -> tuple[int, int]:
    """Return (total_score, exact_picks)."""
    if config is None:
        config = load_scoring_config()

    actual_by_prospect = {pid: slot for slot, pid in actual_results.items()}
    user_prospect_ids = set(user_picks.values())

    total = 0
    exact = 0

    for slot, prospect_id in user_picks.items():
        if prospect_id in actual_by_prospect:
            actual_slot = actual_by_prospect[prospect_id]
            distance = abs(slot - actual_slot)
            pts = compute_distance_points(distance, config)
            if distance == 0:
                exact += 1
            total += pts
            # bonus for having the player anywhere on the board
            total += config["player_in_board_bonus"]
        # player not in actual results at all -> 0 points

    return total, exact
