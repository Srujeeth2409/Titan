from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LogEventCreate(BaseModel):
    source: str = Field(..., min_length=1, max_length=255)
    service: str | None = Field(default=None, max_length=255)
    environment: str | None = Field(default=None, max_length=100)

    level: str = Field(..., min_length=1, max_length=20)
    message: str = Field(..., min_length=1)

    timestamp: datetime | None = None

    metadata: dict = Field(default_factory=dict)


class LogEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    source: str
    service: str | None
    environment: str | None
    level: str
    message: str
    timestamp: datetime
    metadata: dict = Field(validation_alias="event_metadata")
    created_at: datetime


class LogBatchIngestRequest(BaseModel):
    events: list[LogEventCreate] = Field(..., min_length=1, max_length=500)

    @field_validator("events")
    @classmethod
    def non_empty_messages(cls, events: list[LogEventCreate]) -> list[LogEventCreate]:
        if not events:
            raise ValueError("At least one log event is required")
        return events


class LogBatchIngestResponse(BaseModel):
    ingested: int
    events: list[LogEventResponse]


class LogEventListResponse(BaseModel):
    total: int
    items: list[LogEventResponse]
