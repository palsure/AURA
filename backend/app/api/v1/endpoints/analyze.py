"""Code Analysis Endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import CodeAnalysis, Issue
from app.ai.agent import CodeMindAgent

router = APIRouter()
agent = CodeMindAgent()


class AnalyzeRequest(BaseModel):
    """Request model for code analysis"""
    code: str
    language: str = "python"
    file_path: Optional[str] = None
    ai_model: Optional[str] = None  # Optional: override default model
    ai_provider: Optional[str] = None  # Optional: override default provider


class AnalyzeResponse(BaseModel):
    """Response model for code analysis"""
    analysis_id: int
    quality_score: float
    total_issues: int
    issues: List[Dict[str, Any]]
    issues_by_type: Dict[str, int]
    issues_by_severity: Dict[str, int]


@router.post("/", response_model=AnalyzeResponse)
async def analyze_code(
    request: AnalyzeRequest,
    db: Session = Depends(get_db)
):
    """
    Analyze code and return comprehensive results
    
    This endpoint uses the autonomous AI agent to analyze code,
    detect issues, and provide intelligent suggestions.
    """
    try:
        # Perform analysis with optional model selection
        analysis_result = agent.analyze_code(
            request.code, 
            request.language,
            ai_model=request.ai_model,
            ai_provider=request.ai_provider
        )
        
        # Save to database
        db_analysis = CodeAnalysis(
            file_path=request.file_path or "unknown",
            language=request.language,
            code_content=request.code,
            analysis_result=analysis_result,
            issues_found=analysis_result["total_issues"],
            quality_score=analysis_result["quality_score"]
        )
        db.add(db_analysis)
        db.commit()
        db.refresh(db_analysis)
        
        # Save individual issues
        issues_to_save = analysis_result.get("issues", [])
        if issues_to_save:
            saved_count = 0
            for issue_data in issues_to_save:
                try:
                    issue_type = issue_data.get("issue_type", "unknown")
                    if hasattr(issue_type, 'value'):
                        issue_type = issue_type.value
                    issue_type = str(issue_type).lower().strip() if issue_type else "unknown"
                    
                    severity = issue_data.get("severity", "low")
                    if hasattr(severity, 'value'):
                        severity = severity.value
                    severity = str(severity).lower().strip() if severity else "low"
                    
                    db_issue = Issue(
                        analysis_id=db_analysis.id,
                        issue_type=issue_type,
                        severity=severity,
                        line_number=issue_data.get("line_number"),
                        message=str(issue_data.get("message", ""))[:500],
                        suggestion=str(issue_data.get("suggestion", ""))[:1000],
                        code_snippet=issue_data.get("code_snippet")
                    )
                    db.add(db_issue)
                    saved_count += 1
                except Exception as e:
                    print(f"❌ Error saving issue: {str(e)}")
                    print(f"   Issue data: {issue_data}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            if saved_count > 0:
                try:
                    db.commit()
                    print(f"✅ Saved {saved_count}/{len(issues_to_save)} issues for analysis {db_analysis.id}")
                except Exception as e:
                    print(f"❌ Error committing issues: {str(e)}")
                    db.rollback()
            else:
                print(f"⚠️  No issues were saved for analysis {db_analysis.id}")
        
        return AnalyzeResponse(
            analysis_id=db_analysis.id,
            quality_score=analysis_result["quality_score"],
            total_issues=analysis_result["total_issues"],
            issues=analysis_result["issues"],
            issues_by_type=analysis_result["issues_by_type"],
            issues_by_severity=analysis_result["issues_by_severity"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/{analysis_id}")
async def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    """Get analysis by ID"""
    analysis = db.query(CodeAnalysis).filter(CodeAnalysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return {
        "id": analysis.id,
        "file_path": analysis.file_path,
        "language": analysis.language,
        "quality_score": analysis.quality_score,
        "issues_found": analysis.issues_found,
        "analysis_result": analysis.analysis_result,
        "created_at": analysis.created_at
    }


@router.post("/{analysis_id}/suggest-fix")
async def suggest_fix(
    analysis_id: int,
    issue_id: int,
    db: Session = Depends(get_db)
):
    """Get AI-suggested fix for a specific issue"""
    analysis = db.query(CodeAnalysis).filter(CodeAnalysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    # Generate fix suggestion
    fix = agent.suggest_fix(analysis.code_content, issue, analysis.language)
    
    return {
        "issue_id": issue_id,
        "suggested_fix": fix,
        "original_code": analysis.code_content
    }

