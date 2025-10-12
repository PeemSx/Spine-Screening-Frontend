from fastapi import APIRouter

from app.routes import ap, la

router = APIRouter()
router.include_router(ap.router)
router.include_router(la.router)

__all__ = ["router"]
