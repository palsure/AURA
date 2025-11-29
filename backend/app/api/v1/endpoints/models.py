"""AI Model Selection Endpoints"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.core.config import settings

router = APIRouter()


class ModelInfo(BaseModel):
    """AI model information"""
    id: str
    name: str
    provider: str
    description: str
    capabilities: List[str]
    context_window: str
    speed: str
    quality: str


class ModelSelectionRequest(BaseModel):
    """Request to select AI model"""
    provider: str  # openai or anthropic
    model: str
    use_for: str = "all"  # all, analysis, tests, fixes


@router.get("/available", response_model=List[ModelInfo])
async def get_available_models():
    """Get list of available AI models"""
    models = [
        ModelInfo(
            id="gpt-4o",
            name="GPT-4o",
            provider="openai",
            description="Latest, fastest, most capable model. Best for speed and efficiency.",
            capabilities=["code_analysis", "test_generation", "code_fixes", "documentation"],
            context_window="128K tokens",
            speed="⚡⚡⚡ Fastest",
            quality="⭐⭐⭐⭐⭐ Excellent"
        ),
        ModelInfo(
            id="gpt-4-turbo",
            name="GPT-4 Turbo",
            provider="openai",
            description="High-performance model with large context window. Great for complex codebases.",
            capabilities=["code_analysis", "test_generation", "code_fixes"],
            context_window="128K tokens",
            speed="⚡⚡ Fast",
            quality="⭐⭐⭐⭐ Very Good"
        ),
        ModelInfo(
            id="gpt-4",
            name="GPT-4",
            provider="openai",
            description="Reliable and proven model. Good balance of quality and cost.",
            capabilities=["code_analysis", "test_generation", "code_fixes"],
            context_window="8K tokens",
            speed="⚡ Moderate",
            quality="⭐⭐⭐⭐ Very Good"
        ),
        ModelInfo(
            id="claude-3-5-sonnet-20241022",
            name="Claude 3.5 Sonnet",
            provider="anthropic",
            description="Best code quality (94.4/100). Excellent for production code and clean output.",
            capabilities=["code_analysis", "test_generation", "code_fixes", "documentation"],
            context_window="200K tokens",
            speed="⚡⚡ Fast",
            quality="⭐⭐⭐⭐⭐ Best"
        ),
        ModelInfo(
            id="claude-3-opus-20240229",
            name="Claude 3 Opus",
            provider="anthropic",
            description="Highest capability tier. Best for complex reasoning and analysis.",
            capabilities=["code_analysis", "test_generation", "code_fixes"],
            context_window="200K tokens",
            speed="⚡ Moderate",
            quality="⭐⭐⭐⭐⭐ Excellent"
        ),
    ]
    
    # Filter based on available API keys
    available_models = []
    for model in models:
        if model.provider == "openai" and settings.OPENAI_API_KEY:
            available_models.append(model)
        elif model.provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            available_models.append(model)
        # Always show models (user can configure keys)
        available_models.append(model)
    
    # Remove duplicates
    seen = set()
    unique_models = []
    for model in available_models:
        if model.id not in seen:
            seen.add(model.id)
            unique_models.append(model)
    
    return unique_models


@router.get("/current")
async def get_current_model():
    """Get currently configured model"""
    return {
        "openai_model": settings.OPENAI_MODEL,
        "anthropic_model": settings.ANTHROPIC_MODEL,
        "preferred_provider": settings.PREFERRED_AI_PROVIDER,
        "openai_available": bool(settings.OPENAI_API_KEY),
        "anthropic_available": bool(settings.ANTHROPIC_API_KEY)
    }


@router.post("/select")
async def select_model(request: ModelSelectionRequest):
    """Select AI model for current session (stored in memory)"""
    # Validate model
    available = await get_available_models()
    model_ids = [m.id for m in available]
    
    if request.model not in model_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Model {request.model} not available. Available: {', '.join(model_ids)}"
        )
    
    # Find model info
    model_info = next((m for m in available if m.id == request.model), None)
    
    if not model_info:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Check if provider API key is available
    if model_info.provider == "openai" and not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key not configured. Add OPENAI_API_KEY to .env"
        )
    
    if model_info.provider == "anthropic" and not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env"
        )
    
    return {
        "message": "Model selected successfully",
        "model": request.model,
        "provider": model_info.provider,
        "use_for": request.use_for,
        "note": "This selection applies to the current session. For permanent changes, update .env file."
    }

