import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    FeatureFlag,
    FeatureFlagCreate,
    FeatureFlagUpdate,
    FeatureFlagPublic,
    FeatureFlagsPublic,
)
from app.services.feature_flag_service import feature_flag_service

router = APIRouter()


@router.get("/", response_model=FeatureFlagsPublic)
def get_feature_flags(
    db: SessionDep,
    current_user: CurrentUser,
) -> FeatureFlagsPublic:
    """
    Get all feature flags (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can view feature flags.",
        )

    flags = feature_flag_service.get_all_flags(db=db)
    return FeatureFlagsPublic(data=flags, count=len(flags))


@router.get("/active")
def get_active_feature_flags(
    db: SessionDep,
    current_user: CurrentUser,
) -> List[FeatureFlagPublic]:
    """
    Get active feature flags (all users)
    """
    active_flags = feature_flag_service.get_active_flags(db=db)
    return active_flags


@router.post("/", response_model=FeatureFlagPublic)
def create_feature_flag(
    *,
    db: SessionDep,
    current_user: CurrentUser,
    flag_data: FeatureFlagCreate,
) -> FeatureFlagPublic:
    """
    Create a new feature flag (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can create feature flags.",
        )

    flag = feature_flag_service.create_flag(db=db, flag_data=flag_data)
    if not flag:
        raise HTTPException(
            status_code=400,
            detail="Failed to create feature flag. Flag with this name may already exist.",
        )

    return FeatureFlagPublic.from_orm(flag)


@router.get("/{flag_id}", response_model=FeatureFlagPublic)
def get_feature_flag(
    *,
    db: SessionDep,
    current_user: CurrentUser,
    flag_id: uuid.UUID,
) -> FeatureFlagPublic:
    """
    Get a specific feature flag (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can view feature flags.",
        )

    flag = feature_flag_service.get_flag_by_id(db=db, flag_id=flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    return FeatureFlagPublic.from_orm(flag)


@router.put("/{flag_id}", response_model=FeatureFlagPublic)
def update_feature_flag(
    *,
    db: SessionDep,
    current_user: CurrentUser,
    flag_id: uuid.UUID,
    flag_data: FeatureFlagUpdate,
) -> FeatureFlagPublic:
    """
    Update a feature flag (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can update feature flags.",
        )

    flag = feature_flag_service.update_flag(db=db, flag_id=flag_id, flag_data=flag_data)
    if not flag:
        raise HTTPException(
            status_code=404,
            detail="Feature flag not found or update failed",
        )

    return FeatureFlagPublic.from_orm(flag)


@router.delete("/{flag_id}")
def delete_feature_flag(
    *,
    db: SessionDep,
    current_user: CurrentUser,
    flag_id: uuid.UUID,
) -> dict:
    """
    Delete a feature flag (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can delete feature flags.",
        )

    success = feature_flag_service.delete_flag(db=db, flag_id=flag_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Feature flag not found or cannot be deleted (predefined flags cannot be deleted)",
        )

    return {"message": "Feature flag deleted successfully"}


@router.post("/{flag_id}/toggle", response_model=FeatureFlagPublic)
def toggle_feature_flag(
    *,
    db: SessionDep,
    current_user: CurrentUser,
    flag_id: uuid.UUID,
) -> FeatureFlagPublic:
    """
    Toggle a feature flag on/off (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can toggle feature flags.",
        )

    flag = feature_flag_service.toggle_flag(db=db, flag_id=flag_id)
    if not flag:
        raise HTTPException(
            status_code=404,
            detail="Feature flag not found",
        )

    return FeatureFlagPublic.from_orm(flag)


@router.post("/initialize")
def initialize_predefined_flags(
    current_user: CurrentUser,
    db: SessionDep,
) -> dict:
    """
    Initialize predefined feature flags (admin only)
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Only admins can initialize feature flags.",
        )

    created_flags = feature_flag_service.initialize_predefined_flags(db=db)
    return {
        "message": f"Initialized {len(created_flags)} predefined feature flags",
        "created_count": len(created_flags),
    }
