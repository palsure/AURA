"""Repository Management Endpoints"""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import func

from app.db.database import get_db
from app.db.models import Repository, Review, CodeAnalysis, Issue, GeneratedTest, RegressionPrediction, AutomatedAction

router = APIRouter()


def list_files_in_directory(directory_path: str, max_depth: int = 3) -> List[Dict[str, Any]]:
    """List files in a directory recursively"""
    files = []
    try:
        path = Path(directory_path)
        if not path.exists() or not path.is_dir():
            return files
        
        # Directories to ignore
        ignore_dirs = {
            '.git', '.svn', '.hg', '.bzr', '__pycache__', 'node_modules',
            '.venv', 'venv', 'env', '.env', 'dist', 'build', '.build',
            'target', '.idea', '.vscode', '.vs', '.gradle', '.mvn',
            'coverage', '.coverage', '.pytest_cache', '.mypy_cache',
            '.tox', '.cache', 'tmp', 'temp', '.tmp', '.temp'
        }
        
        def walk_directory(current_path: Path, relative_path: str = "", depth: int = 0):
            if depth > max_depth:
                return
            
            try:
                for item in current_path.iterdir():
                    if item.name in ignore_dirs:
                        continue
                    
                    item_relative = f"{relative_path}/{item.name}" if relative_path else item.name
                    
                    if item.is_file():
                        files.append({
                            "path": str(item),
                            "relative_path": item_relative,
                            "name": item.name,
                            "size": item.stat().st_size,
                            "extension": item.suffix
                        })
                    elif item.is_dir():
                        walk_directory(item, item_relative, depth + 1)
            except PermissionError:
                pass
        
        walk_directory(path)
        return files
    except Exception as e:
        print(f"Error listing files in {directory_path}: {str(e)}")
        return files


def detect_languages_from_directory(directory_path: str) -> Dict[str, Any]:
    """Detect programming languages from directory files with percentages"""
    try:
        path = Path(directory_path)
        if not path.exists() or not path.is_dir():
            return {"primary": None, "languages": []}
        
        # Language to extension mapping
        language_extensions = {
            'python': ['.py', '.pyw', '.pyx', '.pyi'],
            'javascript': ['.js', '.mjs', '.cjs'],
            'typescript': ['.ts', '.tsx'],
            'java': ['.java'],
            'cpp': ['.cpp', '.cc', '.cxx', '.hpp', '.hxx'],
            'c': ['.c', '.h'],
            'csharp': ['.cs'],
            'go': ['.go'],
            'rust': ['.rs'],
            'ruby': ['.rb'],
            'php': ['.php', '.phtml'],
            'swift': ['.swift'],
            'kotlin': ['.kt', '.kts'],
            'scala': ['.scala'],
            'r': ['.r', '.R'],
            'matlab': ['.m'],
            'perl': ['.pl', '.pm'],
            'lua': ['.lua'],
            'html': ['.html', '.htm'],
            'css': ['.css', '.scss', '.sass', '.less'],
            'vue': ['.vue'],
            'svelte': ['.svelte'],
            'json': ['.json'],
            'yaml': ['.yaml', '.yml'],
            'xml': ['.xml'],
            'sql': ['.sql'],
            'shell': ['.sh', '.bash', '.zsh', '.fish'],
            'powershell': ['.ps1'],
            'batch': ['.bat', '.cmd'],
        }
        
        # Map some languages to display names
        language_display_map = {
            'cpp': 'C++',
            'csharp': 'C#',
            'typescript': 'TypeScript',
            'javascript': 'JavaScript',
            'powershell': 'PowerShell',
            'batch': 'Batch',
            'shell': 'Shell',
        }
        
        # Count files by extension
        extension_counts = {}
        ignore_dirs = {
            '.git', '.svn', '.hg', '.bzr', '__pycache__', 'node_modules',
            '.venv', 'venv', 'env', '.env', 'dist', 'build', '.build',
            'target', '.idea', '.vscode', '.vs', '.gradle', '.mvn',
            'coverage', '.coverage', '.pytest_cache', '.mypy_cache',
            '.tox', '.cache', 'tmp', 'temp', '.tmp', '.temp'
        }
        
        total_code_files = 0
        for root, dirs, files in os.walk(directory_path):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.is_file():
                    ext = file_path.suffix.lower()
                    # Only count code files (files with known extensions)
                    if any(ext in exts for exts in language_extensions.values()):
                        extension_counts[ext] = extension_counts.get(ext, 0) + 1
                        total_code_files += 1
        
        # Calculate language scores
        language_scores = {}
        for lang, exts in language_extensions.items():
            score = sum(extension_counts.get(ext, 0) for ext in exts)
            if score > 0:
                language_scores[lang] = score
        
        if not language_scores or total_code_files == 0:
            return {"primary": None, "languages": []}
        
        # Sort languages by score (descending)
        sorted_languages = sorted(language_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Get primary language
        primary_lang = sorted_languages[0][0]
        primary_display = language_display_map.get(primary_lang, primary_lang.capitalize())
        
        # Build language list with percentages (only include languages with >5% of files)
        # Exclude json from display
        languages = []
        for lang, count in sorted_languages:
            percentage = (count / total_code_files) * 100
            if percentage >= 5.0 and lang != 'json':  # Only show languages with at least 5% of files, exclude json
                display_name = language_display_map.get(lang, lang.capitalize())
                languages.append({
                    "name": display_name,
                    "percentage": round(percentage, 1),
                    "count": count
                })
        
        return {
            "primary": primary_display if primary_lang != 'json' else (sorted_languages[1][0] if len(sorted_languages) > 1 else None),
            "languages": languages,
            "display": ", ".join([f"{lang['name']} ({lang['percentage']}%)" for lang in languages[:3]])  # Show top 3
        }
    except Exception as e:
        print(f"Error detecting languages in {directory_path}: {str(e)}")
        return {"primary": None, "languages": []}


def count_files_in_directory(directory_path: str) -> int:
    """Count total files in a directory recursively"""
    try:
        path = Path(directory_path)
        if not path.exists() or not path.is_dir():
            return 0
        
        file_count = 0
        # Common code file extensions
        code_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
            '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.clj',
            '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
            '.md', '.txt', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
            '.sql', '.r', '.m', '.pl', '.pm', '.lua', '.vim', '.el',
            '.dockerfile', '.makefile', '.cmake', '.gradle', '.maven'
        }
        
        # Directories to ignore
        ignore_dirs = {
            '.git', '.svn', '.hg', '.bzr', '__pycache__', 'node_modules',
            '.venv', 'venv', 'env', '.env', 'dist', 'build', '.build',
            'target', '.idea', '.vscode', '.vs', '.gradle', '.mvn',
            'coverage', '.coverage', '.pytest_cache', '.mypy_cache',
            '.tox', '.cache', 'tmp', 'temp', '.tmp', '.temp'
        }
        
        for root, dirs, files in os.walk(directory_path):
            # Filter out ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                file_path = Path(root) / file
                # Count all files, or optionally filter by code extensions
                # For now, count all files
                if file_path.is_file():
                    file_count += 1
        
        return file_count
    except Exception as e:
        print(f"Error counting files in {directory_path}: {str(e)}")
        return 0


class RepositoryCreate(BaseModel):
    """Repository creation model"""
    name: str
    path: str
    language: Optional[str] = None


class RepositoryResponse(BaseModel):
    """Repository response model"""
    id: int
    name: str
    path: str
    language: Optional[str]
    repo_type: Optional[str] = "local"
    github_url: Optional[str] = None
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    github_token: Optional[str] = None
    total_files: int = 0
    last_analyzed: Optional[datetime] = None
    last_reviewed: Optional[datetime] = None
    continuous_monitoring: bool = True
    created_at: datetime


@router.post("/", response_model=RepositoryResponse)
async def create_repository(
    repo: RepositoryCreate,
    db: Session = Depends(get_db)
):
    """Create a new repository"""
    # Count files and detect languages
    total_files = 0
    detected_language = repo.language
    
    if repo.path and os.path.exists(repo.path):
        total_files = count_files_in_directory(repo.path)
        
        # Auto-detect languages if not provided
        if not detected_language:
            lang_info = detect_languages_from_directory(repo.path)
            detected_language = lang_info.get("display") or lang_info.get("primary")
    
    db_repo = Repository(
        name=repo.name,
        path=repo.path,
        language=detected_language,
        repo_type="local",
        total_files=total_files
    )
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    
    return db_repo


@router.get("/", response_model=List[RepositoryResponse])
async def list_repositories(db: Session = Depends(get_db)):
    """List all repositories"""
    repos = db.query(Repository).all()
    return repos


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(repo_id: int, db: Session = Depends(get_db)):
    """Get repository by ID"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.get("/{repo_id}/details")
async def get_repository_details(repo_id: int, db: Session = Depends(get_db)):
    """Get comprehensive repository details including all analyses, reviews, issues, etc."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Get all reviews for this repository
    reviews = db.query(Review).filter(Review.repository_id == repo_id).order_by(Review.started_at.desc()).limit(10).all()
    
    # Get all reviews for this repository to find related analyses
    review_ids = [r.id for r in reviews]
    
    # Get all code analyses - match by repository path or get recent ones
    # Since CodeAnalysis stores relative paths, we need flexible matching
    analyses = []
    if repo.path:
        repo_name = os.path.basename(repo.path.rstrip('/'))
        # Try multiple matching strategies
        analyses = db.query(CodeAnalysis).filter(
            (CodeAnalysis.file_path.like(f"%{repo.path}%")) |
            (CodeAnalysis.file_path.like(f"%{repo_name}%"))
        ).order_by(CodeAnalysis.created_at.desc()).limit(100).all()
        
        # If no matches by path, get all recent analyses (they're likely from this repo)
        # This handles the case where file_path is relative (e.g., "frontend/App.tsx")
        if not analyses:
            all_recent = db.query(CodeAnalysis).order_by(CodeAnalysis.created_at.desc()).limit(200).all()
            # Filter to likely matches (relative paths that don't start with /)
            analyses = [a for a in all_recent if not (a.file_path or "").startswith("/")][:100]
    
    # Get all issues from those analyses
    analysis_ids = [a.id for a in analyses] if analyses else []
    issues = []
    if analysis_ids:
        # Get ALL issues, not limited to 100
        issues = db.query(Issue).filter(
            Issue.analysis_id.in_(analysis_ids)
        ).order_by(Issue.created_at.desc()).all()
    
    # Fallback: Get all recent issues if we have reviews but no matching analyses
    # This handles cases where file paths don't match but issues exist from recent reviews
    if not issues and reviews:
        # Get all recent issues (they might be from this repo's reviews)
        all_recent_issues = db.query(Issue).order_by(Issue.created_at.desc()).limit(500).all()
        if all_recent_issues:
            # Get analyses for these issues
            issue_analysis_ids = list({i.analysis_id for i in all_recent_issues})
            issue_analyses = db.query(CodeAnalysis).filter(
                CodeAnalysis.id.in_(issue_analysis_ids)
            ).all()
            # If analyses have relative paths (not absolute), they're likely from this repo
            relative_analyses = [a for a in issue_analyses if a.file_path and not a.file_path.startswith("/")]
            if relative_analyses:
                relative_ids = [a.id for a in relative_analyses]
                issues = [i for i in all_recent_issues if i.analysis_id in relative_ids]
    
    # Also extract issues from the most recent review's review_result JSON
    # This handles cases where issues are in the review response but not yet saved to Issue table
    if reviews:
        most_recent_review = reviews[0]
        if most_recent_review.review_result:
            try:
                review_result = most_recent_review.review_result
                if isinstance(review_result, dict):
                    # Try multiple paths: analysis.issues, all_issues, or direct issues
                    review_issues = []
                    if "analysis" in review_result:
                        review_issues = review_result.get("analysis", {}).get("issues", [])
                    if not review_issues and "all_issues" in review_result:
                        review_issues = review_result.get("all_issues", [])
                    if not review_issues and "issues" in review_result:
                        review_issues = review_result.get("issues", [])
                    
                    if review_issues:
                        print(f"📦 Found {len(review_issues)} issues in review_result JSON")
                        # Convert JSON issues to Issue-like objects for serialization
                        # We'll create temporary Issue objects from the JSON data
                        existing_issue_ids = {i.id for i in issues}
                        
                        # Get analyses from the review time window
                        from datetime import timedelta
                        review_time = most_recent_review.started_at
                        time_window_start = review_time - timedelta(minutes=10)
                        time_window_end = review_time + timedelta(minutes=10)
                        
                        review_analyses = db.query(CodeAnalysis).filter(
                            CodeAnalysis.created_at >= time_window_start,
                            CodeAnalysis.created_at <= time_window_end
                        ).all()
                        
                        # Try to match JSON issues to database issues by content
                        # If not found, we'll include them anyway
                        for json_issue in review_issues:
                            # Check if this issue already exists in our list
                            issue_exists = False
                            for existing_issue in issues:
                                if (existing_issue.message == json_issue.get("message", "") and
                                    existing_issue.line_number == json_issue.get("line_number") and
                                    existing_issue.issue_type == json_issue.get("issue_type", "").lower()):
                                    issue_exists = True
                                    break
                            
                            if not issue_exists:
                                # Create a simple dict-like object from JSON (not a SQLAlchemy model)
                                # We'll use the first matching analysis_id or create a placeholder
                                analysis_id = None
                                if review_analyses:
                                    # Try to find matching analysis by file path if available
                                    file_path = json_issue.get("file_path")
                                    if file_path:
                                        for analysis in review_analyses:
                                            if file_path in (analysis.file_path or ""):
                                                analysis_id = analysis.id
                                                break
                                    # If no match, use the first analysis
                                    if not analysis_id:
                                        analysis_id = review_analyses[0].id
                                
                                # Create a simple object with attributes (not a SQLAlchemy model)
                                class TempIssue:
                                    def __init__(self, data):
                                        self.id = data.get('id')
                                        self.analysis_id = data.get('analysis_id')
                                        self.issue_type = data.get('issue_type')
                                        self.severity = data.get('severity')
                                        self.line_number = data.get('line_number')
                                        self.message = data.get('message')
                                        self.suggestion = data.get('suggestion')
                                        self.code_snippet = data.get('code_snippet')
                                        self.fixed = data.get('fixed', False)
                                        self.created_at = data.get('created_at')
                                
                                temp_issue = TempIssue({
                                    'id': len(issues) + 10000,  # Temporary ID to avoid conflicts
                                    'analysis_id': analysis_id or 0,
                                    'issue_type': str(json_issue.get("issue_type", "unknown")).lower(),
                                    'severity': str(json_issue.get("severity", "low")).lower(),
                                    'line_number': json_issue.get("line_number"),
                                    'message': str(json_issue.get("message", ""))[:500],
                                    'suggestion': str(json_issue.get("suggestion", ""))[:1000],
                                    'code_snippet': json_issue.get("code_snippet"),
                                    'fixed': False,
                                    'created_at': review_time
                                })
                                issues.append(temp_issue)
                        
                        print(f"✅ Merged {len(issues)} total issues (including {len(review_issues)} from review_result)")
            except Exception as e:
                print(f"⚠️  Error extracting issues from review_result: {str(e)}")
                import traceback
                traceback.print_exc()
    
    # Get all tests from those analyses
    tests = []
    if analysis_ids:
        tests = db.query(GeneratedTest).filter(
            GeneratedTest.analysis_id.in_(analysis_ids)
        ).order_by(GeneratedTest.created_at.desc()).limit(20).all()
    
    # Get all predictions
    predictions = db.query(RegressionPrediction).filter(
        RegressionPrediction.repository_id == repo_id
    ).order_by(RegressionPrediction.created_at.desc()).limit(10).all()
    
    # Get all actions - filter by target_file matching repository path
    actions = []
    if repo.path:
        actions = db.query(AutomatedAction).filter(
            AutomatedAction.target_file.like(f"%{repo.path}%")
        ).order_by(AutomatedAction.created_at.desc()).limit(20).all()
    
    # Calculate statistics
    total_issues = len(issues)
    fixed_issues = len([i for i in issues if i.fixed])
    
    avg_quality_score = 0
    if analyses:
        avg_quality_score = sum(a.quality_score for a in analyses if a.quality_score) / len(analyses) if analyses else 0
    
    # Create a lookup dict for analyses by ID (for adding file_path to issues)
    analyses_dict = {a.id: {"file_path": a.file_path} for a in analyses}
    
    issues_by_type = {}
    issues_by_severity = {}
    for issue in issues:
        issue_type = issue.issue_type if hasattr(issue, 'issue_type') else getattr(issue, 'issue_type', 'unknown')
        issue_severity = issue.severity if hasattr(issue, 'severity') else getattr(issue, 'severity', 'low')
        issues_by_type[issue_type] = issues_by_type.get(issue_type, 0) + 1
        issues_by_severity[issue_severity] = issues_by_severity.get(issue_severity, 0) + 1
    
    # Create a lookup dict for analyses by ID (for adding file_path to issues)
    analyses_dict = {a.id: {"file_path": a.file_path} for a in analyses}
    
    return {
        "repository": {
            "id": repo.id,
            "name": repo.name,
            "path": repo.path,
            "language": repo.language,
            "repo_type": repo.repo_type,
            "total_files": repo.total_files,
            "last_analyzed": repo.last_analyzed,
            "last_reviewed": repo.last_reviewed,
            "created_at": repo.created_at
        },
        "statistics": {
            "total_reviews": len(reviews),
            "total_analyses": len(analyses),
            "total_issues": total_issues,
            "fixed_issues": fixed_issues,
            "open_issues": total_issues - fixed_issues,
            "average_quality_score": round(float(avg_quality_score), 2),
            "total_tests": len(tests),
            "total_predictions": len(predictions),
            "total_actions": len(actions),
            "issues_by_type": {item[0]: item[1] for item in issues_by_type},
            "issues_by_severity": {item[0]: item[1] for item in issues_by_severity}
        },
        "reviews": [
            {
                "id": r.id,
                "review_type": r.review_type,
                "status": r.status,
                "files_reviewed": r.files_reviewed,
                "issues_found": r.issues_found,
                "tests_generated": r.tests_generated,
                "actions_triggered": r.actions_triggered,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
                "review_result": r.review_result
            }
            for r in reviews
        ],
        "analyses": [
            {
                "id": a.id,
                "file_path": a.file_path,
                "language": a.language,
                "issues_found": a.issues_found,
                "quality_score": a.quality_score,
                "created_at": a.created_at
            }
            for a in analyses
        ],
        "issues": [
            {
                "id": i.id if hasattr(i, 'id') and (not hasattr(i, '__dict__') or (hasattr(i, 'id') and i.id < 10000)) else None,
                "analysis_id": i.analysis_id if hasattr(i, 'analysis_id') else None,
                "issue_type": i.issue_type if hasattr(i, 'issue_type') else str(getattr(i, 'issue_type', 'unknown')),
                "severity": i.severity if hasattr(i, 'severity') else str(getattr(i, 'severity', 'low')),
                "line_number": i.line_number if hasattr(i, 'line_number') else getattr(i, 'line_number', None),
                "message": i.message if hasattr(i, 'message') else str(getattr(i, 'message', '')),
                "suggestion": i.suggestion if hasattr(i, 'suggestion') else str(getattr(i, 'suggestion', '')),
                "code_snippet": getattr(i, 'code_snippet', None),
                "fixed": getattr(i, 'fixed', False),
                "file_path": analyses_dict.get(i.analysis_id, {}).get("file_path") if hasattr(i, 'analysis_id') and i.analysis_id else None,
                "created_at": i.created_at.isoformat() if hasattr(i, 'created_at') and i.created_at else None
            }
            for i in issues
        ],
        "tests": [
            {
                "id": t.id,
                "test_type": t.test_type,
                "test_language": t.test_language,
                "coverage_percentage": t.coverage_percentage,
                "status": t.status,
                "created_at": t.created_at
            }
            for t in tests
        ],
        "predictions": [
            {
                "id": p.id,
                "file_path": p.file_path,
                "prediction_type": p.prediction_type,
                "risk_score": p.risk_score,
                "confidence": p.confidence,
                "predicted_issues": p.predicted_issues,
                "triggered": p.triggered,
                "created_at": p.created_at
            }
            for p in predictions
        ],
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "trigger_reason": a.trigger_reason,
                "target_file": a.target_file,
                "status": a.status,
                "created_at": a.created_at
            }
            for a in actions
        ]
    }


@router.post("/{repo_id}/refresh")
async def refresh_repository_files(repo_id: int, db: Session = Depends(get_db)):
    """Refresh file count and languages for a repository"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Only refresh for local repositories
    if repo.repo_type == "local" and repo.path and os.path.exists(repo.path):
        total_files = count_files_in_directory(repo.path)
        lang_info = detect_languages_from_directory(repo.path)
        detected_language = lang_info.get("display") or lang_info.get("primary")
        
        repo.total_files = total_files
        if detected_language:
            repo.language = detected_language
        
        db.commit()
        db.refresh(repo)
        return {
            "message": "File count and languages refreshed",
            "repository_id": repo_id,
            "total_files": total_files,
            "language": detected_language,
            "languages": lang_info.get("languages", [])
        }
    else:
        raise HTTPException(
            status_code=400,
            detail="Can only refresh file count for local repositories with valid paths"
        )


@router.get("/{repo_id}/files")
async def list_repository_files(
    repo_id: int,
    extension: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List files in a repository (local or GitHub)"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Handle GitHub repositories
    if repo.repo_type == "github":
        try:
            from app.services.github_service import GitHubService
            
            github_service = GitHubService(token=repo.github_token)
            file_paths = github_service.list_repository_files(
                repo.github_owner,
                repo.github_repo,
                extension=extension
            )
            
            # Convert to same format as local files
            files = []
            for file_path in file_paths:
                file_name = os.path.basename(file_path)
                file_ext = os.path.splitext(file_name)[1]
                
                # Get file info from GitHub API
                try:
                    file_info = github_service.get_repository_contents(
                        repo.github_owner,
                        repo.github_repo,
                        file_path
                    )
                    # GitHub API returns a single file object when requesting a file path
                    if isinstance(file_info, dict) and file_info.get("type") == "file":
                        size = file_info.get("size", 0)
                    else:
                        size = 0
                except:
                    size = 0
                
                files.append({
                    "path": file_path,
                    "relative_path": file_path,
                    "name": file_name,
                    "size": size,
                    "extension": file_ext
                })
            
            return {
                "repository_id": repo_id,
                "files": files,
                "total": len(files)
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to list GitHub repository files: {str(e)}"
            )
    
    # Handle local repositories
    if repo.repo_type != "local":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported repository type: {repo.repo_type}"
        )
    
    if not repo.path or not os.path.exists(repo.path):
        raise HTTPException(
            status_code=400,
            detail="Repository path does not exist"
        )
    
    try:
        files = list_files_in_directory(repo.path)
        
        # Filter by extension if provided
        if extension:
            files = [f for f in files if f["extension"] == extension or f["name"].endswith(extension)]
        
        return {
            "repository_id": repo_id,
            "files": files,
            "total": len(files)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list files: {str(e)}"
        )


@router.get("/{repo_id}/file-content")
async def get_file_content(
    repo_id: int,
    file_path: str,
    db: Session = Depends(get_db)
):
    """Get file content from a repository (local or GitHub)"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Handle GitHub repositories
    if repo.repo_type == "github":
        try:
            from app.services.github_service import GitHubService
            
            github_service = GitHubService(token=repo.github_token)
            content = github_service.get_file_content(
                repo.github_owner,
                repo.github_repo,
                file_path
            )
            
            return {
                "repository_id": repo_id,
                "file_path": file_path,
                "content": content
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch file from GitHub: {str(e)}"
            )
    
    # Handle local repositories
    if repo.repo_type != "local":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported repository type: {repo.repo_type}"
        )
    
    # Get content of a file in a local repository
    # Security: Ensure file_path is within repository
    full_path = Path(repo.path) / file_path
    repo_path = Path(repo.path).resolve()
    file_path_resolved = full_path.resolve()
    
    if not str(file_path_resolved).startswith(str(repo_path)):
        raise HTTPException(
            status_code=403,
            detail="Access denied: File path outside repository"
        )
    
    if not file_path_resolved.exists() or not file_path_resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path_resolved, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        return {
            "repository_id": repo_id,
            "file_path": file_path,
            "content": content,
            "size": file_path_resolved.stat().st_size
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {str(e)}"
        )


@router.delete("/{repo_id}")
async def delete_repository(repo_id: int, db: Session = Depends(get_db)):
    """Delete a repository"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    db.delete(repo)
    db.commit()
    
    return {"message": "Repository deleted successfully"}
