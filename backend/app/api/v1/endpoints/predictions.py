"""Regression Prediction Endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import RegressionPrediction, Repository
from app.ai.regression_predictor import RegressionPredictor

router = APIRouter()
predictor = RegressionPredictor()


class PredictRequest(BaseModel):
    """Request model for regression prediction"""
    code: str
    file_path: str
    repository_id: Optional[int] = None
    change_history: Optional[List[Dict[str, Any]]] = None
    previous_issues: Optional[List[Dict[str, Any]]] = None
    test_coverage: Optional[float] = None


class PredictResponse(BaseModel):
    """Response model for regression prediction"""
    prediction_id: int
    risk_score: float
    confidence: float
    risk_level: str
    predicted_issues: List[Dict[str, Any]]
    recommendations: List[str]


@router.post("/regression", response_model=PredictResponse)
async def predict_regression(
    request: PredictRequest,
    db: Session = Depends(get_db)
):
    """
    Predict regression risk for code
    
    This endpoint uses AURA's ML-based regression prediction
    to assess the risk of introducing regressions.
    """
    try:
        # Generate prediction
        result = predictor.predict_regression(
            request.code,
            request.file_path,
            request.change_history,
            request.previous_issues,
            request.test_coverage
        )
        
        # Save to database
        db_prediction = RegressionPrediction(
            repository_id=request.repository_id,
            file_path=request.file_path,
            prediction_type="regression",
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            predicted_issues=result["predicted_issues"],
            historical_patterns=result.get("risk_factors", {})
        )
        db.add(db_prediction)
        db.commit()
        db.refresh(db_prediction)
        
        return PredictResponse(
            prediction_id=db_prediction.id,
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            risk_level=result["risk_level"],
            predicted_issues=result["predicted_issues"],
            recommendations=result["recommendations"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/{prediction_id}")
async def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    """Get prediction by ID"""
    prediction = db.query(RegressionPrediction).filter(
        RegressionPrediction.id == prediction_id
    ).first()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    return {
        "id": prediction.id,
        "file_path": prediction.file_path,
        "risk_score": prediction.risk_score,
        "confidence": prediction.confidence,
        "predicted_issues": prediction.predicted_issues,
        "created_at": prediction.created_at
    }


@router.get("/")
async def list_predictions(
    repository_id: Optional[int] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List regression predictions"""
    query = db.query(RegressionPrediction)
    
    if repository_id:
        query = query.filter(RegressionPrediction.repository_id == repository_id)
    if risk_level:
        query = query.filter(RegressionPrediction.risk_score >= {
            "critical": 0.7,
            "high": 0.5,
            "medium": 0.3,
            "low": 0.0
        }.get(risk_level, 0.0))
    
    predictions = query.all()
    return predictions

