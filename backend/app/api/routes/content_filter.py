import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ContentFilterLog,
    ContentFilterLogPublic,
    ContentFilterLogsPublic,
)
from app.services.content_filter_service import content_filter_service

router = APIRouter()


@router.get("/logs", response_model=ContentFilterLogsPublic)
def get_content_filter_logs(
    db: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None),
) -> ContentFilterLogsPublic:
    """
    Get content filter logs (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can view content filter logs.",
        )

    result = content_filter_service.get_filter_logs(
        db=db,
        skip=skip,
        limit=limit,
        user_id=user_id,
        content_type=content_type,
    )

    return ContentFilterLogsPublic(data=result["data"], count=result["count"])


@router.get("/statistics")
def get_content_filter_statistics(
    current_user: CurrentUser,
    db: SessionDep,
) -> dict:
    """
    Get content filter statistics (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can view content filter statistics.",
        )

    stats = content_filter_service.get_filter_statistics(db=db)
    return stats
