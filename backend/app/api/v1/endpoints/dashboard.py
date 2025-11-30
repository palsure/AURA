"""Dashboard Endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Dict, Any

from app.db.database import get_db
from app.db.models import CodeAnalysis, Issue, Repository, GeneratedTest

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    
    # Total analyses
    total_analyses = db.query(CodeAnalysis).count()
    
    # Total issues from database
    total_issues = db.query(Issue).count()
    fixed_issues = db.query(Issue).filter(Issue.fixed == True).count()
    
    # Average quality score
    avg_quality = db.query(func.avg(CodeAnalysis.quality_score)).scalar() or 0
    
    # Issues by type (filter out None values) - initialize from database first
    issues_by_type_query = db.query(
        Issue.issue_type,
        func.count(Issue.id).label('count')
    ).filter(Issue.issue_type.isnot(None)).group_by(Issue.issue_type).all()
    
    # Convert to dictionary, handling None and empty strings
    issues_by_type = {}
    for item in issues_by_type_query:
        issue_type = item[0]
        count = item[1]
        if issue_type and issue_type.strip():  # Only add non-empty types
            # Normalize issue type (lowercase for consistency)
            normalized_type = issue_type.lower().strip()
            issues_by_type[normalized_type] = issues_by_type.get(normalized_type, 0) + count
    
    # Issues by severity (filter out None values) - initialize from database first
    issues_by_severity_query = db.query(
        Issue.severity,
        func.count(Issue.id).label('count')
    ).filter(Issue.severity.isnot(None)).group_by(Issue.severity).all()
    
    # Convert to dictionary
    issues_by_severity = {}
    for item in issues_by_severity_query:
        severity = item[0]
        count = item[1]
        if severity and severity.strip():  # Only add non-empty severities
            normalized_severity = severity.lower().strip()
            issues_by_severity[normalized_severity] = issues_by_severity.get(normalized_severity, 0) + count
    
    # Also count issues from analysis_result JSON for analyses that don't have saved issues
    # This provides a more accurate count when issues weren't properly saved
    analyses_with_unsaved_issues = db.query(CodeAnalysis).filter(
        CodeAnalysis.issues_found > 0
    ).all()
    
    unsaved_issues_count = 0
    for analysis in analyses_with_unsaved_issues:
        if len(analysis.issues) == 0:  # No issues saved to Issue table
            if analysis.analysis_result and isinstance(analysis.analysis_result, dict):
                issues_data = analysis.analysis_result.get("issues", [])
                if issues_data:
                    unsaved_issues_count += len(issues_data)
    
    # If we have unsaved issues but no saved issues, extract them from analysis_result
    # This is a fallback to show issues even if they weren't properly saved
    if unsaved_issues_count > 0 and total_issues == 0:
        issues_by_type_from_analyses = {}
        issues_by_severity_from_analyses = {}
        
        for analysis in analyses_with_unsaved_issues:
            if len(analysis.issues) == 0 and analysis.analysis_result:
                issues_data = analysis.analysis_result.get("issues", [])
                for issue_data in issues_data:
                    issue_type = str(issue_data.get("issue_type", "unknown")).lower().strip()
                    severity = str(issue_data.get("severity", "low")).lower().strip()
                    
                    if issue_type:
                        issues_by_type_from_analyses[issue_type] = issues_by_type_from_analyses.get(issue_type, 0) + 1
                    if severity:
                        issues_by_severity_from_analyses[severity] = issues_by_severity_from_analyses.get(severity, 0) + 1
        
        # Merge with database issues (if any)
        for issue_type, count in issues_by_type_from_analyses.items():
            issues_by_type[issue_type] = issues_by_type.get(issue_type, 0) + count
        for severity, count in issues_by_severity_from_analyses.items():
            issues_by_severity[severity] = issues_by_severity.get(severity, 0) + count
        
        # Update total count
        total_issues = max(total_issues, unsaved_issues_count)
    
    # Recent analyses (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_analyses = db.query(CodeAnalysis).filter(
        CodeAnalysis.created_at >= week_ago
    ).count()
    
    # Repositories
    total_repos = db.query(Repository).count()
    
    # Test metrics
    total_tests = db.query(GeneratedTest).count()
    
    # Average test coverage
    avg_coverage = db.query(func.avg(GeneratedTest.coverage_percentage)).scalar() or 0
    
    # Tests created in last 7 days
    tests_last_7_days = db.query(GeneratedTest).filter(
        GeneratedTest.created_at >= week_ago
    ).count()
    
    # Tests by type
    tests_by_type = db.query(
        GeneratedTest.test_type,
        func.count(GeneratedTest.id).label('count')
    ).group_by(GeneratedTest.test_type).all()
    
    return {
        "total_analyses": total_analyses,
        "total_issues": total_issues,
        "fixed_issues": fixed_issues,
        "open_issues": total_issues - fixed_issues,
        "average_quality_score": round(float(avg_quality), 2),
        "issues_by_type": issues_by_type,
        "issues_by_severity": issues_by_severity,
        "recent_analyses": recent_analyses,
        "total_repositories": total_repos,
        "total_tests": total_tests,
        "average_test_coverage": round(float(avg_coverage), 2),
        "tests_created_last_7_days": tests_last_7_days,
        "tests_by_type": {item[0]: item[1] for item in tests_by_type if item[0]}
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

