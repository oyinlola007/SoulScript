import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlmodel import Session, select
from app.models import FeatureFlag, FeatureFlagCreate, FeatureFlagUpdate
from app.core.prompts import (
    FEATURE_FLAG_ACTIVE_HEADER,
    FEATURE_FLAG_INSTRUCTIONS,
    format_feature_flags_prompt,
)

logger = logging.getLogger(__name__)


class FeatureFlagService:
    def __init__(self):
        self.predefined_flags = {
            "spiritual_parenting": {
                "name": "Spiritual Parenting",
                "description": "Enable parenting-focused spiritual guidance and family-oriented advice for raising children with spiritual values.",
                "is_enabled": False,
            },
            "grief_support": {
                "name": "Grief Support",
                "description": "Enable grief counseling and loss support features to help users through difficult times with spiritual comfort.",
                "is_enabled": False,
            },
            "meditation_guidance": {
                "name": "Meditation Guidance",
                "description": "Enable meditation techniques and mindfulness practices to help users develop spiritual awareness and inner peace.",
                "is_enabled": False,
            },
            "scripture_study": {
                "name": "Scripture Study",
                "description": "Enable in-depth scripture analysis and biblical interpretation for deeper understanding of religious texts.",
                "is_enabled": False,
            },
            "prayer_requests": {
                "name": "Prayer Requests",
                "description": "Enable prayer request features and spiritual intercession support for community prayer needs.",
                "is_enabled": False,
            },
            "community_features": {
                "name": "Community Features",
                "description": "Enable group discussions and community sharing features for spiritual fellowship.",
                "is_enabled": False,
            },
        }

    def initialize_predefined_flags(self, db: Session) -> List[FeatureFlag]:
        """Initialize predefined feature flags in the database"""
        try:
            created_flags = []

            for flag_key, flag_data in self.predefined_flags.items():
                # Check if flag already exists
                existing_flag = db.exec(
                    select(FeatureFlag).where(FeatureFlag.name == flag_data["name"])
                ).first()

                if not existing_flag:
                    # Create new flag
                    new_flag = FeatureFlag(
                        name=flag_data["name"],
                        description=flag_data["description"],
                        is_enabled=flag_data["is_enabled"],
                        is_predefined=True,
                    )

                    db.add(new_flag)
                    created_flags.append(new_flag)
                    logger.info(f"Created predefined flag: {flag_data['name']}")
                else:
                    # Update existing flag if needed
                    if existing_flag.description != flag_data["description"]:
                        existing_flag.description = flag_data["description"]
                        existing_flag.updated_at = datetime.utcnow()
                        db.add(existing_flag)
                        logger.info(f"Updated predefined flag: {flag_data['name']}")

            db.commit()
            logger.info(f"Initialized {len(created_flags)} predefined feature flags")
            return created_flags

        except Exception as e:
            logger.error(f"Error initializing predefined flags: {e}")
            db.rollback()
            return []

    def get_all_flags(self, db: Session) -> List[FeatureFlag]:
        """Get all feature flags"""
        try:
            flags = db.exec(select(FeatureFlag).order_by(FeatureFlag.name)).all()
            return flags
        except Exception as e:
            logger.error(f"Error getting feature flags: {e}")
            return []

    def get_active_flags(self, db: Session) -> List[FeatureFlag]:
        """Get all enabled feature flags"""
        try:
            active_flags = db.exec(
                select(FeatureFlag).where(FeatureFlag.is_enabled == True)
            ).all()
            return active_flags
        except Exception as e:
            logger.error(f"Error getting active feature flags: {e}")
            return []

    def get_flag_by_id(self, db: Session, flag_id: uuid.UUID) -> Optional[FeatureFlag]:
        """Get a specific feature flag by ID"""
        try:
            flag = db.get(FeatureFlag, flag_id)
            return flag
        except Exception as e:
            logger.error(f"Error getting feature flag {flag_id}: {e}")
            return None

    def create_flag(
        self, db: Session, flag_data: FeatureFlagCreate
    ) -> Optional[FeatureFlag]:
        """Create a new feature flag"""
        try:
            # Check if flag with same name already exists
            existing_flag = db.exec(
                select(FeatureFlag).where(FeatureFlag.name == flag_data.name)
            ).first()

            if existing_flag:
                logger.warning(
                    f"Feature flag with name '{flag_data.name}' already exists"
                )
                return None

            new_flag = FeatureFlag(
                name=flag_data.name,
                description=flag_data.description,
                is_enabled=True,  # Automatically enable new flags
                is_predefined=False,
            )

            db.add(new_flag)
            db.commit()
            db.refresh(new_flag)

            logger.info(f"Created feature flag: {flag_data.name}")
            return new_flag

        except Exception as e:
            logger.error(f"Error creating feature flag: {e}")
            db.rollback()
            return None

    def update_flag(
        self, db: Session, flag_id: uuid.UUID, flag_data: FeatureFlagUpdate
    ) -> Optional[FeatureFlag]:
        """Update a feature flag"""
        try:
            flag = db.get(FeatureFlag, flag_id)
            if not flag:
                logger.error(f"Feature flag {flag_id} not found")
                return None

            # Update fields if provided
            if flag_data.name is not None:
                # Check if new name conflicts with existing flag
                if flag_data.name != flag.name:
                    existing_flag = db.exec(
                        select(FeatureFlag).where(FeatureFlag.name == flag_data.name)
                    ).first()
                    if existing_flag:
                        logger.warning(
                            f"Feature flag with name '{flag_data.name}' already exists"
                        )
                        return None
                flag.name = flag_data.name

            if flag_data.description is not None:
                flag.description = flag_data.description

            if flag_data.is_enabled is not None:
                flag.is_enabled = flag_data.is_enabled

            flag.updated_at = datetime.utcnow()

            db.add(flag)
            db.commit()
            db.refresh(flag)

            logger.info(f"Updated feature flag: {flag.name}")
            return flag

        except Exception as e:
            logger.error(f"Error updating feature flag {flag_id}: {e}")
            db.rollback()
            return None

    def delete_flag(self, db: Session, flag_id: uuid.UUID) -> bool:
        """Delete a feature flag"""
        try:
            flag = db.get(FeatureFlag, flag_id)
            if not flag:
                logger.error(f"Feature flag {flag_id} not found")
                return False

            # Don't allow deletion of predefined flags
            if flag.is_predefined:
                logger.warning(f"Cannot delete predefined flag: {flag.name}")
                return False

            flag_name = flag.name
            db.delete(flag)
            db.commit()

            logger.info(f"Deleted feature flag: {flag_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting feature flag {flag_id}: {e}")
            db.rollback()
            return False

    def toggle_flag(self, db: Session, flag_id: uuid.UUID) -> Optional[FeatureFlag]:
        """Toggle a feature flag on/off"""
        try:
            flag = db.get(FeatureFlag, flag_id)
            if not flag:
                logger.error(f"Feature flag {flag_id} not found")
                return None

            flag.is_enabled = not flag.is_enabled
            flag.updated_at = datetime.utcnow()

            db.add(flag)
            db.commit()
            db.refresh(flag)

            status = "enabled" if flag.is_enabled else "disabled"
            logger.info(f"Toggled feature flag '{flag.name}' to {status}")
            return flag

        except Exception as e:
            logger.error(f"Error toggling feature flag {flag_id}: {e}")
            db.rollback()
            return None

    def get_active_flags_prompt_text(self, db: Session) -> str:
        """Get formatted text of active flags for AI prompt"""
        try:
            active_flags = self.get_active_flags(db)
            return format_feature_flags_prompt(active_flags)
        except Exception as e:
            logger.error(f"Error generating active flags prompt: {e}")
            return ""

    def is_feature_available(self, db: Session, feature_name: str) -> bool:
        """Check if a specific feature is available"""
        try:
            flag = db.exec(
                select(FeatureFlag).where(FeatureFlag.name == feature_name)
            ).first()

            return flag.is_enabled if flag else False

        except Exception as e:
            logger.error(
                f"Error checking feature availability for '{feature_name}': {e}"
            )
            return False


# Global instance
feature_flag_service = FeatureFlagService()
