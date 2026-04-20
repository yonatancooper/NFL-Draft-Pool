from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProspectOut(BaseModel):
    id: int
    name: str
    position: str
    school: str
    height: Optional[str] = None
    height_raw: Optional[int] = None
    weight: Optional[int] = None
    forty_time: Optional[float] = None
    forty_ten: Optional[str] = None
    hand_size: Optional[str] = None
    arm_length: Optional[str] = None
    wingspan: Optional[str] = None
    age_draft_day: Optional[float] = None
    brugler_grade: Optional[str] = None
    brugler_pos_rank: Optional[int] = None
    consensus_rank: int

    class Config:
        from_attributes = True


class PickIn(BaseModel):
    slot_number: int
    prospect_id: int


class SubmissionIn(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    picks: list[PickIn]


class PickOut(BaseModel):
    slot_number: int
    prospect: ProspectOut

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    token: str
    first_name: str
    last_name: str
    submitted_at: datetime
    picks: list[PickOut]

    class Config:
        from_attributes = True


class AdminResultsIn(BaseModel):
    password: str
    results: list[str]  # 32 player names in order


class ScoreOut(BaseModel):
    rank: int
    first_name: str
    last_name: str
    total_score: int
    exact_picks: int
    submitted_at: datetime


class EntryDetailPick(BaseModel):
    slot_number: int
    predicted_prospect: ProspectOut
    actual_prospect: Optional[ProspectOut] = None
    points: int = 0
    distance: Optional[int] = None


class EntryDetailOut(BaseModel):
    first_name: str
    last_name: str
    total_score: int
    exact_picks: int
    picks: list[EntryDetailPick]


class EditEntryIn(BaseModel):
    password: str
    picks: list[PickIn]


class SaveDraftIn(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    board: dict[str, int]  # {"1": prospect_id, "2": prospect_id, ...}


class LoadDraftIn(BaseModel):
    email: str
    password: str


class SaveDraftOut(BaseModel):
    email: str
    first_name: str
    last_name: str
    board: dict[str, int]
    updated_at: datetime
