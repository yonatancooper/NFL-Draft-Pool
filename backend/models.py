from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Prospect(Base):
    __tablename__ = "prospects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    position = Column(String, nullable=False)
    school = Column(String, nullable=False)
    height = Column(String, nullable=True)
    height_raw = Column(Integer, nullable=True)
    weight = Column(Integer, nullable=True)
    forty_time = Column(Float, nullable=True)
    forty_ten = Column(String, nullable=True)
    hand_size = Column(String, nullable=True)
    arm_length = Column(String, nullable=True)
    wingspan = Column(String, nullable=True)
    age_draft_day = Column(Float, nullable=True)
    brugler_grade = Column(String, nullable=True)
    brugler_pos_rank = Column(Integer, nullable=True)
    consensus_rank = Column(Integer, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)
    submission_token = Column(String, unique=True, nullable=False, index=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    picks = relationship("Pick", back_populates="user")
    score = relationship("Score", back_populates="user", uselist=False)


class Pick(Base):
    __tablename__ = "picks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    slot_number = Column(Integer, nullable=False)
    prospect_id = Column(Integer, ForeignKey("prospects.id"), nullable=False)
    user = relationship("User", back_populates="picks")
    prospect = relationship("Prospect")


class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(Integer, nullable=False, unique=True)
    prospect_id = Column(Integer, ForeignKey("prospects.id"), nullable=False)
    prospect = relationship("Prospect")


class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    total_score = Column(Integer, nullable=False)
    exact_picks = Column(Integer, nullable=False)
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User", back_populates="score")


class SavedDraft(Base):
    __tablename__ = "saved_drafts"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    board_json = Column(Text, nullable=False)  # JSON: {slot_number: prospect_id}
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class DraftSlot(Base):
    """Current team ownership per slot. Kept in sync with ESPN by the poller."""
    __tablename__ = "draft_slots"
    slot_number = Column(Integer, primary_key=True)
    team_id = Column(Integer, nullable=True)           # ESPN NFL team id
    team_name = Column(String, nullable=False)         # e.g. "Dallas Cowboys"
    team_abbr = Column(String, nullable=False)         # e.g. "DAL"
    trade_note = Column(String, nullable=True)         # e.g. "From CLE via BUF"
    traded = Column(Integer, default=0, nullable=False)  # 0/1
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
