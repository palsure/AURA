"""Dashboard Endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any

from app.db.database import get_db
from app.db.models import CodeAnalysis, Issue, Repository

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    
    # Total analyses
    total_analyses = db.query(CodeAnalysis).count()
    
    # Total issues
    total_issues = db.query(Issue).count()
    fixed_issues = db.query(Issue).filter(Issue.fixed == True).count()
    
    # Average quality score
    avg_quality = db.query(func.avg(CodeAnalysis.quality_score)).scalar() or 0
    
    # Issues by type
    issues_by_type = db.query(
        Issue.issue_type,
        func.count(Issue.id).label('count')
    ).group_by(Issue.issue_type).all()
    
    # Issues by severity
    issues_by_severity = db.query(
        Issue.severity,
        func.count(Issue.id).label('count')
    ).group_by(Issue.severity).all()
    
    # Recent analyses (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_analyses = db.query(CodeAnalysis).filter(
        CodeAnalysis.created_at >= week_ago
    ).count()
    
    # Repositories
    total_repos = db.query(Repository).count()
    
    return {
        "total_analyses": total_analyses,
        "total_issues": total_issues,
        "fixed_issues": fixed_issues,
        "open_issues": total_issues - fixed_issues,
        "average_quality_score": round(float(avg_quality), 2),
        "issues_by_type": {item[0]: item[1] for item in issues_by_type},
        "issues_by_severity": {item[0]: item[1] for item in issues_by_severity},
        "recent_analyses": recent_analyses,
        "total_repositories": total_repos
    }


@router.get("/trends")
async def get_quality_trends(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get quality score trends over time"""
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    analyses = db.query(CodeAnalysis).filter(
        CodeAnalysis.created_at >= start_date
    ).order_by(CodeAnalysis.created_at).all()
    
    trends = []
    for analysis in analyses:
        trends.append({
            "date": analysis.created_at.isoformat(),
            "quality_score": analysis.quality_score,
            "issues_found": analysis.issues_found
        })
    
    return {
        "period_days": days,
        "data_points": trends
    }


@router.get("/health")
async def get_code_health(db: Session = Depends(get_db)):
    """Get overall code health metrics"""
    
    # Recent analyses (last 30 days)
    month_ago = datetime.utcnow() - timedelta(days=30)
    recent_analyses = db.query(CodeAnalysis).filter(
        CodeAnalysis.created_at >= month_ago
    ).all()
    
    if not recent_analyses:
        return {
            "health_status": "no_data",
            "message": "No recent analyses available"
        }
    
    avg_quality = sum(a.quality_score for a in recent_analyses) / len(recent_analyses)
    total_recent_issues = sum(a.issues_found for a in recent_analyses)
    
    # Determine health status
    if avg_quality >= 80 and total_recent_issues < 10:
        health_status = "excellent"
    elif avg_quality >= 70:
        health_status = "good"
    elif avg_quality >= 60:
        health_status = "fair"
    else:
        health_status = "needs_attention"
    
    return {
        "health_status": health_status,
        "average_quality_score": round(avg_quality, 2),
        "total_issues_last_30_days": total_recent_issues,
        "analyses_count": len(recent_analyses)
    }

