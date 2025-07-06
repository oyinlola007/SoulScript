from fastapi import APIRouter

from app.api.routes import (
    items,
    login,
    private,
    users,
    utils,
    pdfs,
    chat,
    content_filter,
    feature_flags,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(pdfs.router, prefix="/pdfs", tags=["pdfs"])
api_router.include_router(chat.router)
api_router.include_router(
    content_filter.router, prefix="/content-filter", tags=["content-filter"]
)
api_router.include_router(
    feature_flags.router, prefix="/feature-flags", tags=["feature-flags"]
)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
