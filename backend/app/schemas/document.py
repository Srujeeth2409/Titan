from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    QUEUED = "queued"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXED = "indexed"
    FAILED = "failed"


class SourceType(str, Enum):
    UPLOAD = "upload"
    GOOGLE_DRIVE = "google_drive"
    SHAREPOINT = "sharepoint"
    CONFLUENCE = "confluence"
    NOTION = "notion"
    S3 = "s3"
    GITHUB = "github"


class DocumentCreate(BaseModel):
    filename: str
    source_type: SourceType = SourceType.UPLOAD
    workspace_id: UUID
    metadata: dict = Field(default_factory=dict)


class Document(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    filename: str
    source_type: SourceType
    workspace_id: UUID
    status: DocumentStatus = DocumentStatus.QUEUED
    page_count: int | None = None
    chunk_count: int | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict = Field(default_factory=dict)


class Chunk(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    document_id: UUID
    text: str
    chunk_index: int
    page_number: int | None = None
    section: str | None = None
    strategy: str
    token_count: int
    embedding_model: str | None = None
