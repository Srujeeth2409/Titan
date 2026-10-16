"""
Document Ingestion Service.

Entry point for all document sources (direct upload, cloud drives, git
repos, email). Normalizes every source into a raw byte stream + metadata,
enqueues OCR/parsing work, and emits the first telemetry stage event
(`PipelineStage.INGESTION`) for the trace.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RawDocument:
    filename: str
    content_type: str
    data: bytes
    source_metadata: dict


class SourceConnector(ABC):
    @abstractmethod
    async def fetch(self, reference: str) -> RawDocument:
        ...


class UploadConnector(SourceConnector):
    async def fetch(self, reference: str) -> RawDocument:
        raise NotImplementedError("Reads directly from the multipart upload buffer")


class GoogleDriveConnector(SourceConnector):
    def __init__(self, access_token: str):
        self.access_token = access_token

    async def fetch(self, reference: str) -> RawDocument:
        raise NotImplementedError("Wire up the Google Drive Files.get API call")


CONNECTOR_REGISTRY: dict[str, type[SourceConnector]] = {
    "upload": UploadConnector,
    "google_drive": GoogleDriveConnector,
}
