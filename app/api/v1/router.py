from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.channels import router as channels_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.creator_struggles import router as creator_struggles_router
from app.api.v1.experiments import router as experiments_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.memories import router as memories_router
from app.api.v1.niche_radar import router as niche_radar_router
from app.api.v1.opportunities import router as opportunities_router
from app.api.v1.reports import router as reports_router
from app.api.v1.studio import router as studio_router
from app.api.v1.videos import router as videos_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(channels_router)
api_router.include_router(jobs_router)
api_router.include_router(reports_router)
api_router.include_router(opportunities_router)
api_router.include_router(studio_router)
api_router.include_router(experiments_router)
api_router.include_router(memories_router)
api_router.include_router(conversations_router)
api_router.include_router(niche_radar_router)
api_router.include_router(creator_struggles_router)
api_router.include_router(videos_router)
