"""Issue Management Endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Issue, CodeAnalysis

router = APIRouter()


class IssueResponse(BaseModel):
    """Issue response model"""
    id: int
    analysis_id: int
    issue_type: str
    severity: str
    line_number: int
    message: str
    suggestion: str
    fixed: bool
    created_at: str


@router.get("/", response_model=List[IssueResponse])
async def list_issues(
    analysis_id: Optional[int] = None,
    severity: Optional[str] = None,
    issue_type: Optional[str] = None,
    fixed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """List issues with optional filters"""
    query = db.query(Issue)
    
    if analysis_id:
        query = query.filter(Issue.analysis_id == analysis_id)
    if severity:
        query = query.filter(Issue.severity == severity)
    if issue_type:
        query = query.filter(Issue.issue_type == issue_type)
    if fixed is not None:
        query = query.filter(Issue.fixed == fixed)
    
    issues = query.all()
    return issues


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: int, db: Session = Depends(get_db)):
    """Get issue by ID"""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.patch("/{issue_id}/fix")
async def mark_issue_fixed(issue_id: int, db: Session = Depends(get_db)):
    """Mark an issue as fixed"""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    issue.fixed = True
    db.commit()
    
    return {"message": "Issue marked as fixed", "issue_id": issue_id}


@router.get("/stats/summary")
async def get_issues_summary(db: Session = Depends(get_db)):
    """Get summary statistics of issues"""
    total_issues = db.query(Issue).count()
    fixed_issues = db.query(Issue).filter(Issue.fixed == True).count()
    critical_issues = db.query(Issue).filter(Issue.severity == "critical").count()
    high_issues = db.query(Issue).filter(Issue.severity == "high").count()
    
    return {
        "total_issues": total_issues,
        "fixed_issues": fixed_issues,
        "open_issues": total_issues - fixed_issues,
        "critical_issues": critical_issues,
        "high_issues": high_issues,
        "fix_rate": round((fixed_issues / total_issues * 100) if total_issues > 0 else 0, 2)
    }

