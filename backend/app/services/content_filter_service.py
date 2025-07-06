import logging
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
from openai import OpenAI
from sqlmodel import Session, select
from app.models import ContentFilterLog, ChatSession
from app.core.config import settings

logger = logging.getLogger(__name__)


class ContentFilterService:
    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            try:
                self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
                logger.info("OpenAI client initialized for content filtering")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
        else:
            logger.warning(
                "OpenAI API key not found. Content filtering will be limited."
            )

    def filter_content(
        self,
        content: str,
        user_id: uuid.UUID,
        session_id: Optional[uuid.UUID] = None,
        content_type: str = "user_input",
    ) -> Dict[str, Any]:
        """
        Filter content using OpenAI's content filtering API
        Returns dict with is_allowed, blocked_reason, and confidence
        """
        if not self.client:
            logger.warning("OpenAI client not available. Content will be allowed.")
            return {"is_allowed": True, "blocked_reason": "", "confidence": 0.0}

        try:
            logger.info(f"Filtering content for user {user_id}, type: {content_type}")

            # Use OpenAI's moderation API
            response = self.client.moderations.create(input=content)
            result = response.results[0]

            # Check for violations
            categories = result.categories
            category_scores = result.category_scores

            # Define blocked categories
            blocked_categories = {
                "violence": "Violence",
                "sexual": "Sexual Content",
                "self_harm": "Self-Harm",
                "hate": "Hate Speech",
            }

            blocked_reasons = []
            max_score = 0.0

            for category, reason in blocked_categories.items():
                if hasattr(categories, category) and getattr(categories, category):
                    score = getattr(category_scores, category, 0.0)
                    blocked_reasons.append(reason)
                    max_score = max(max_score, score)

            is_allowed = len(blocked_reasons) == 0

            result_data = {
                "is_allowed": is_allowed,
                "blocked_reason": "; ".join(blocked_reasons) if blocked_reasons else "",
                "confidence": max_score,
                "categories": {
                    "violence": getattr(category_scores, "violence", 0.0),
                    "sexual": getattr(category_scores, "sexual", 0.0),
                    "self_harm": getattr(category_scores, "self_harm", 0.0),
                    "hate": getattr(category_scores, "hate", 0.0),
                },
            }

            if not is_allowed:
                logger.warning(
                    f"Content blocked for user {user_id}: {result_data['blocked_reason']}"
                )
            else:
                logger.info(f"Content allowed for user {user_id}")

            return result_data

        except Exception as e:
            logger.error(f"Error filtering content: {e}")
            # Allow content if filtering fails
            return {"is_allowed": True, "blocked_reason": "", "confidence": 0.0}

    def log_violation(
        self,
        db: Session,
        user_id: uuid.UUID,
        session_id: Optional[uuid.UUID],
        content_type: str,
        original_content: str,
        blocked_reason: str,
    ) -> ContentFilterLog:
        """Log a content filter violation"""
        try:
            log_entry = ContentFilterLog(
                user_id=user_id,
                session_id=session_id,
                content_type=content_type,
                original_content=original_content,
                blocked_reason=blocked_reason,
            )

            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)

            logger.info(f"Logged content filter violation for user {user_id}")
            return log_entry

        except Exception as e:
            logger.error(f"Error logging content filter violation: {e}")
            db.rollback()
            raise

    def block_chat_session(
        self, db: Session, session_id: uuid.UUID, blocked_reason: str
    ) -> bool:
        """Block a chat session after content violation"""
        try:
            session = db.get(ChatSession, session_id)
            if not session:
                logger.error(f"Chat session {session_id} not found")
                return False

            session.is_blocked = True
            session.blocked_reason = blocked_reason
            session.updated_at = datetime.utcnow()

            db.add(session)
            db.commit()

            logger.info(f"Blocked chat session {session_id} due to: {blocked_reason}")
            return True

        except Exception as e:
            logger.error(f"Error blocking chat session: {e}")
            db.rollback()
            return False

    def get_filter_logs(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get content filter logs with optional filtering"""
        try:
            query = select(ContentFilterLog)

            if user_id:
                # Support partial user ID matching using LIKE operator
                from sqlalchemy import text

                query = query.where(
                    text("CAST(user_id AS TEXT) ILIKE :user_id_pattern")
                ).params(user_id_pattern=f"%{user_id}%")

            if content_type:
                query = query.where(ContentFilterLog.content_type == content_type)

            # Get total count
            count_query = query
            total_count = len(db.exec(count_query).all())

            # Get paginated results
            logs = db.exec(query.offset(skip).limit(limit)).all()

            return {"data": logs, "count": total_count, "skip": skip, "limit": limit}

        except Exception as e:
            logger.error(f"Error getting filter logs: {e}")
            return {"data": [], "count": 0, "skip": skip, "limit": limit}

    def get_filter_statistics(self, db: Session) -> Dict[str, Any]:
        """Get content filter statistics"""
        try:
            # Total violations
            total_violations = len(db.exec(select(ContentFilterLog)).all())

            # Today's violations
            today = datetime.utcnow().date()
            today_violations = len(
                db.exec(
                    select(ContentFilterLog).where(ContentFilterLog.created_at >= today)
                ).all()
            )

            # Violations by type
            user_input_violations = len(
                db.exec(
                    select(ContentFilterLog).where(
                        ContentFilterLog.content_type == "user_input"
                    )
                ).all()
            )

            ai_response_violations = len(
                db.exec(
                    select(ContentFilterLog).where(
                        ContentFilterLog.content_type == "ai_response"
                    )
                ).all()
            )

            return {
                "total_violations": total_violations,
                "today_violations": today_violations,
                "user_input_violations": user_input_violations,
                "ai_response_violations": ai_response_violations,
            }

        except Exception as e:
            logger.error(f"Error getting filter statistics: {e}")
            return {
                "total_violations": 0,
                "today_violations": 0,
                "user_input_violations": 0,
                "ai_response_violations": 0,
            }


# Global instance
content_filter_service = ContentFilterService()
