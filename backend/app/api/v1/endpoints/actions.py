"""Automated Actions Endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AutomatedAction, CodeAnalysis
from app.ai.action_engine import ActionEngine

router = APIRouter()
action_engine = ActionEngine()


class TriggerActionsRequest(BaseModel):
    """Request model for triggering actions"""
    analysis_id: int
    regression_prediction_id: Optional[int] = None
    test_coverage: Optional[float] = None


@router.post("/trigger")
async def trigger_actions(
    request: TriggerActionsRequest,
    db: Session = Depends(get_db)
):
    """
    Trigger automated actions based on analysis
    
    This endpoint determines and executes appropriate
    automated actions based on code analysis results.
    """
    try:
        # Get analysis
        analysis = db.query(CodeAnalysis).filter(
            CodeAnalysis.id == request.analysis_id
        ).first()
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Get regression prediction if available
        regression_prediction = None
        if request.regression_prediction_id:
            from app.db.models import RegressionPrediction
            regression_prediction = db.query(RegressionPrediction).filter(
                RegressionPrediction.id == request.regression_prediction_id
            ).first()
            if regression_prediction:
                regression_prediction = {
                    "risk_score": regression_prediction.risk_score,
                    "confidence": regression_prediction.confidence,
                    "predicted_issues": regression_prediction.predicted_issues
                }
        
        # Determine actions
        actions = action_engine.determine_actions(
            analysis.analysis_result,
            regression_prediction,
            request.test_coverage
        )
        
        # Save actions to database
        db_actions = []
        for action_data in actions:
            db_action = AutomatedAction(
                action_type=action_data["action_type"],
                trigger_reason=action_data["trigger_reason"],
                target_file=analysis.file_path,
                action_data=action_data.get("context", {}),
                status="pending"
            )
            db.add(db_action)
            db_actions.append(db_action)
        
        db.commit()
        
        # Execute actions
        executed_actions = []
        for db_action in db_actions:
            result = action_engine.execute_action({
                "action_type": db_action.action_type,
                "context": db_action.action_data
            })
            db_action.status = result.get("status", "completed")
            db_action.result = result
            executed_actions.append({
                "id": db_action.id,
                "action_type": db_action.action_type,
                "status": db_action.status,
                "result": result
            })
        
        db.commit()
        
        return {
            "actions_triggered": len(executed_actions),
            "actions": executed_actions
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action triggering failed: {str(e)}")


@router.get("/")
async def list_actions(
    status: Optional[str] = None,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List automated actions"""
    query = db.query(AutomatedAction)
    
    if status:
        query = query.filter(AutomatedAction.status == status)
    if action_type:
        query = query.filter(AutomatedAction.action_type == action_type)
    
    actions = query.order_by(AutomatedAction.created_at.desc()).all()
    return actions


@router.get("/{action_id}")
async def get_action(action_id: int, db: Session = Depends(get_db)):
    """Get action by ID"""
    action = db.query(AutomatedAction).filter(
        AutomatedAction.id == action_id
    ).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    return {
        "id": action.id,
        "action_type": action.action_type,
        "trigger_reason": action.trigger_reason,
        "target_file": action.target_file,
        "status": action.status,
        "result": action.result,
        "created_at": action.created_at,
        "executed_at": action.executed_at
    }

