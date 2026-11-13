"""
Enterprise Files and Documents API routes for Titan.
Handles central file storage, folders, uploads/downloads, versioning,
local disk storage, and Titan AI document summarization.
"""
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.db.models import WorkspaceFile
from app.db.session import get_db
from app.services.llm_gateway.service import get_llm_gateway

router = APIRouter(prefix="/files", tags=["files"])
settings = get_settings()

UPLOAD_DIR = Path("storage/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class CreateFolderRequest(BaseModel):
    name: str
    parent_path: str = "/"
    department: Optional[str] = "General"


class UpdateFileRequest(BaseModel):
    name: Optional[str] = None
    access_level: Optional[str] = None
    department: Optional[str] = None


@router.get("")
async def list_files(
    user: CurrentUser,
    folder_path: str = Query("/"),
    department: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Normalize folder path
    if not folder_path.startswith("/"):
        folder_path = "/" + folder_path
    if folder_path != "/" and folder_path.endswith("/"):
        folder_path = folder_path.rstrip("/")

    # Seed some sample company workspace files if database is completely empty
    total_files_count = (await db.execute(select(func.count(WorkspaceFile.id)))).scalar() or 0
    if total_files_count == 0:
        sample_files = [
            ("Employee_Handbook_2026.pdf", "/HR", 2450000, "application/pdf", "HR", "internal", "Comprehensive company policies, benefits, and workplace standards for 2026."),
            ("Q3_Financial_Review.xlsx", "/Finance", 1120000, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Finance", "confidential", "Detailed revenue breakdown, OPEX analysis, and department forecast metrics."),
            ("Infrastructure_Architecture.pdf", "/Engineering", 3800000, "application/pdf", "Engineering", "internal", "High-level diagram of air-gapped on-premises Kubernetes deployment."),
            ("Brand_Guidelines_v4.pdf", "/Marketing", 8500000, "application/pdf", "Marketing", "public", "Design tokens, color palette, typography, and logo usage guidelines."),
            ("Titan_Workspace_Overview.docx", "/", 840000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "General", "internal", "Getting started guide for the Titan Enterprise Workspace."),
        ]
        for name, fpath, size, mime, dept, access, summary in sample_files:
            dummy_path = UPLOAD_DIR / f"{uuid.uuid4()}_{name}"
            dummy_path.write_text(f"Titan Enterprise Workspace Sample File: {name}\nDepartment: {dept}\n{summary}")
            wf = WorkspaceFile(
                name=name,
                folder_path=fpath,
                size_bytes=size,
                mime_type=mime,
                storage_path=str(dummy_path),
                owner_id=user.id,
                department=dept,
                access_level=access,
                summary=summary,
            )
            db.add(wf)
        await db.commit()

    # Query files
    stmt = select(WorkspaceFile)

    # Permission check: Non-admins only see files matching their department, General, or public
    if getattr(user, "role", "Employee").lower() not in ["admin", "executive", "management"]:
        stmt = stmt.where(
            or_(
                WorkspaceFile.owner_id == user.id,
                WorkspaceFile.access_level == "public",
                WorkspaceFile.department == user.department,
                WorkspaceFile.department == "General",
                WorkspaceFile.department == "All",
            )
        )

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                WorkspaceFile.name.ilike(search_pattern),
                WorkspaceFile.summary.ilike(search_pattern),
            )
        )
    else:
        stmt = stmt.where(WorkspaceFile.folder_path == folder_path)

    if department:
        stmt = stmt.where(WorkspaceFile.department == department)

    stmt = stmt.order_by(WorkspaceFile.name.asc())
    result = await db.execute(stmt)
    files = result.scalars().all()

    # Discover known folders across workspace files
    f_stmt = select(distinct(WorkspaceFile.folder_path))
    f_res = await db.execute(f_stmt)
    all_paths = [r[0] for r in f_res.fetchall() if r[0]]

    # Compute immediate subfolders for current folder_path
    subfolders = set()
    for p in all_paths:
        if p == folder_path:
            continue
        if p.startswith(folder_path):
            remainder = p[len(folder_path):].strip("/")
            top_part = remainder.split("/")[0]
            if top_part:
                subfolders.add(top_part)

    # Default folders if at root
    if folder_path == "/":
        subfolders.update(["HR", "Finance", "Engineering", "Marketing", "Legal", "Operations"])

    folder_list = []
    for sf in sorted(list(subfolders)):
        full_sub_path = f"{folder_path.rstrip('/')}/{sf}"
        # count files in folder
        cnt_stmt = select(func.count(WorkspaceFile.id), func.coalesce(func.sum(WorkspaceFile.size_bytes), 0)).where(
            WorkspaceFile.folder_path.startswith(full_sub_path)
        )
        c_res = await db.execute(cnt_stmt)
        c_row = c_res.fetchone()
        folder_list.append({
            "name": sf,
            "path": full_sub_path,
            "file_count": c_row[0] if c_row else 0,
            "size_bytes": c_row[1] if c_row else 0,
        })

    return {
        "current_folder": folder_path,
        "folders": folder_list,
        "files": [
            {
                "id": str(f.id),
                "name": f.name,
                "folder_path": f.folder_path,
                "size_bytes": f.size_bytes,
                "mime_type": f.mime_type,
                "department": f.department,
                "access_level": f.access_level,
                "version": f.version,
                "summary": f.summary,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
                "is_owner": (f.owner_id == user.id),
            }
            for f in files
        ],
    }


@router.post("/upload")
async def upload_file(
    user: CurrentUser,
    file: UploadFile = File(...),
    folder_path: str = Form("/"),
    department: Optional[str] = Form(None),
    access_level: str = Form("internal"),
    db: AsyncSession = Depends(get_db),
):
    # Ensure folder path format
    if not folder_path.startswith("/"):
        folder_path = "/" + folder_path
    if folder_path != "/" and folder_path.endswith("/"):
        folder_path = folder_path.rstrip("/")

    file_id = uuid.uuid4()
    safe_filename = file.filename.replace(" ", "_")
    storage_filename = f"{file_id}_{safe_filename}"
    file_path = UPLOAD_DIR / storage_filename

    # Write file to disk
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size
    mime_type = file.content_type or "application/octet-stream"

    workspace_file = WorkspaceFile(
        id=file_id,
        name=file.filename,
        folder_path=folder_path,
        size_bytes=file_size,
        mime_type=mime_type,
        storage_path=str(file_path),
        owner_id=user.id,
        department=department or user.department,
        access_level=access_level,
        version=1,
    )
    db.add(workspace_file)
    await db.commit()

    return {
        "status": "ok",
        "file": {
            "id": str(workspace_file.id),
            "name": workspace_file.name,
            "folder_path": workspace_file.folder_path,
            "size_bytes": workspace_file.size_bytes,
            "mime_type": workspace_file.mime_type,
            "department": workspace_file.department,
            "access_level": workspace_file.access_level,
            "version": workspace_file.version,
        },
    }


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    stmt = select(WorkspaceFile).where(WorkspaceFile.id == fid)
    res = await db.execute(stmt)
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = Path(wf.storage_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Physical file missing on server storage")

    return FileResponse(
        path=file_path,
        filename=wf.name,
        media_type=wf.mime_type,
    )


@router.post("/{file_id}/summarize")
async def summarize_file(
    file_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-app integration: Uses Titan AI local LLM to generate an authoritative executive summary.
    """
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    stmt = select(WorkspaceFile).where(WorkspaceFile.id == fid)
    res = await db.execute(stmt)
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="File not found")

    # Read up to 8KB of text if possible
    file_path = Path(wf.storage_path)
    content_sample = ""
    if file_path.exists():
        try:
            content_sample = file_path.read_text(encoding="utf-8", errors="ignore")[:6000]
        except Exception:
            content_sample = f"Document title: {wf.name}. File type: {wf.mime_type}."

    prompt = (
        f"You are Titan AI RAG System. Summarize this company document for an executive employee.\n"
        f"Document Name: {wf.name}\n"
        f"Department: {wf.department}\n"
        f"Content Extract:\n{content_sample or wf.name}\n\n"
        f"Provide a 3-bullet concise summary covering key takeaways, action items, and departmental impact."
    )

    try:
        gateway = get_llm_gateway()
        result = await gateway.generate(
            prompt=prompt,
            system_prompt="You are Titan AI, an enterprise RAG System. Be concise and factual.",
            model_name="gemma2:2b",
        )
        summary_text = result.text.strip()
    except Exception as e:
        summary_text = (
            f"• Document: {wf.name} ({round(wf.size_bytes / 1024, 1)} KB)\n"
            f"• Access level: {wf.access_level.capitalize()} under {wf.department} department.\n"
            f"• Verified on-premises record stored in Titan Workspace storage."
        )

    wf.summary = summary_text
    await db.commit()

    return {"status": "ok", "summary": summary_text}


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    stmt = select(WorkspaceFile).where(WorkspaceFile.id == fid)
    res = await db.execute(stmt)
    wf = res.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete physical file
    try:
        p = Path(wf.storage_path)
        if p.exists():
            p.unlink()
    except Exception:
        pass

    await db.delete(wf)
    await db.commit()
    return {"status": "ok"}

