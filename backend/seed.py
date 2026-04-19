"""Seed the database with prospects from prospects_seed.json."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal, Base
from models import Prospect

SEED_PATH = os.path.join(os.path.dirname(__file__), "..", "prospects_seed.json")


def seed(reseed=False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Prospect).count()
        if existing > 0 and not reseed:
            print("Prospects already seeded. Skipping. (use --reseed to replace)")
            return
        if existing > 0 and reseed:
            db.query(Prospect).delete()
            db.commit()
            print(f"Cleared {existing} old prospects.")
        with open(SEED_PATH, "r") as f:
            prospects = json.load(f)
        for p in prospects:
            db.add(Prospect(
                name=p["name"],
                position=p["position"],
                school=p["school"],
                height=p.get("height"),
                height_raw=p.get("height_raw"),
                weight=p.get("weight"),
                forty_time=p.get("forty_time"),
                forty_ten=p.get("forty_ten"),
                hand_size=p.get("hand_size"),
                arm_length=p.get("arm_length"),
                wingspan=p.get("wingspan"),
                age_draft_day=p.get("age_draft_day"),
                brugler_grade=p.get("brugler_grade"),
                brugler_pos_rank=p.get("brugler_pos_rank"),
                consensus_rank=p["consensus_rank"],
            ))
        db.commit()
        print(f"Seeded {len(prospects)} prospects.")
    finally:
        db.close()


if __name__ == "__main__":
    reseed = "--reseed" in sys.argv
    seed(reseed=reseed)
