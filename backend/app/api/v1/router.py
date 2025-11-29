"""API Router"""

from fastapi import APIRouter
from app.api.v1.endpoints import analyze, repositories, issues, dashboard, tests, predictions, actions, review, github, models

api_router = APIRouter()

api_router.include_router(review.router, prefix="/review", tags=["review"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["analysis"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(predictions.router, prefix="/predict", tags=["predictions"])
api_router.include_router(actions.router, prefix="/actions", tags=["actions"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(github.router, prefix="/github", tags=["github"])
api_router.include_router(repositories.router, prefix="/repositories", tags=["repositories"])
api_router.include_router(issues.router, prefix="/issues", tags=["issues"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

