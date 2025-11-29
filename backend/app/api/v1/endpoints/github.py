"""GitHub Integration Endpoints"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Repository
from app.services.github_service import GitHubService

router = APIRouter()


class GitHubConnectRequest(BaseModel):
    """Request model for connecting GitHub repository"""
    github_url: str
    name: Optional[str] = None
    language: Optional[str] = None
    github_token: Optional[str] = None


class GitHubFileRequest(BaseModel):
    """Request model for fetching file from GitHub"""
    repository_id: int
    file_path: str
    branch: Optional[str] = None


@router.post("/connect")
async def connect_github_repository(
    request: GitHubConnectRequest,
    db: Session = Depends(get_db)
):
    """Connect a GitHub repository to AURA"""
    try:
        github_service = GitHubService(token=request.github_token)
        
        # Parse GitHub URL
        repo_info = github_service.parse_github_url(request.github_url)
        owner = repo_info["owner"]
        repo = repo_info["repo"]
        
        # Validate access
        if not github_service.validate_repository_access(owner, repo):
            raise HTTPException(
                status_code=404,
                detail="Repository not found or access denied"
            )
        
        # Get repository information
        github_repo = github_service.get_repository_info(owner, repo)
        
        # Get languages
        languages = github_service.get_repository_languages(owner, repo)
        primary_language = max(languages.items(), key=lambda x: x[1])[0] if languages else None
        
        # Count files (approximate)
        try:
            files = github_service.list_repository_files(owner, repo)
            total_files = len(files)
        except:
            total_files = 0
        
        # Create or update repository
        existing_repo = db.query(Repository).filter(
            Repository.github_url == request.github_url
        ).first()
        
        if existing_repo:
            # Update existing
            existing_repo.name = request.name or github_repo["name"]
            existing_repo.path = f"{owner}/{repo}"
            existing_repo.language = request.language or primary_language
            existing_repo.github_owner = owner
            existing_repo.github_repo = repo
            existing_repo.total_files = total_files
            if request.github_token:
                existing_repo.github_token = request.github_token
            db.commit()
            db.refresh(existing_repo)
            return existing_repo
        else:
            # Create new
            db_repo = Repository(
                name=request.name or github_repo["name"],
                path=f"{owner}/{repo}",
                language=request.language or primary_language,
                repo_type="github",
                github_url=request.github_url,
                github_owner=owner,
                github_repo=repo,
                github_token=request.github_token,
                total_files=total_files
            )
            db.add(db_repo)
            db.commit()
            db.refresh(db_repo)
            return db_repo
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect repository: {str(e)}")


@router.get("/{repository_id}/files")
async def list_repository_files(
    repository_id: int,
    extension: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List files in a GitHub repository"""
    repo = db.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    if repo.repo_type != "github":
        raise HTTPException(status_code=400, detail="Repository is not a GitHub repository")
    
    try:
        github_service = GitHubService(token=repo.github_token)
        files = github_service.list_repository_files(
            repo.github_owner,
            repo.github_repo,
            extension=extension
        )
        return {
            "repository_id": repository_id,
            "files": files,
            "total": len(files)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.post("/fetch-file")
async def fetch_file_content(
    request: GitHubFileRequest,
    db: Session = Depends(get_db)
):
    """Fetch file content from GitHub repository"""
    repo = db.query(Repository).filter(Repository.id == request.repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    if repo.repo_type != "github":
        raise HTTPException(status_code=400, detail="Repository is not a GitHub repository")
    
    try:
        github_service = GitHubService(token=repo.github_token)
        content = github_service.get_file_content(
            repo.github_owner,
            repo.github_repo,
            request.file_path,
            ref=request.branch
        )
        
        return {
            "repository_id": request.repository_id,
            "file_path": request.file_path,
            "content": content,
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch file: {str(e)}")


@router.get("/{repository_id}/info")
async def get_repository_info(
    repository_id: int,
    db: Session = Depends(get_db)
):
    """Get GitHub repository information"""
    repo = db.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    if repo.repo_type != "github":
        raise HTTPException(status_code=400, detail="Repository is not a GitHub repository")
    
    try:
        github_service = GitHubService(token=repo.github_token)
        info = github_service.get_repository_info(repo.github_owner, repo.github_repo)
        languages = github_service.get_repository_languages(repo.github_owner, repo.github_repo)
        
        return {
            "repository_id": repository_id,
            "github_info": info,
            "languages": languages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get repository info: {str(e)}")


@router.post("/validate")
async def validate_github_url(
    github_url: str,
    github_token: Optional[str] = None
):
    """Validate GitHub URL and access"""
    """Validate GitHub URL and access"""
    try:
        github_service = GitHubService(token=github_token)
        repo_info = github_service.parse_github_url(github_url)
        
        is_accessible = github_service.validate_repository_access(
            repo_info["owner"],
            repo_info["repo"]
        )
        
        if is_accessible:
            repo_data = github_service.get_repository_info(
                repo_info["owner"],
                repo_info["repo"]
            )
            return {
                "valid": True,
                "owner": repo_info["owner"],
                "repo": repo_info["repo"],
                "name": repo_data["name"],
                "description": repo_data.get("description"),
                "private": repo_data.get("private", False),
                "default_branch": repo_data.get("default_branch", "main")
            }
        else:
            return {
                "valid": False,
                "error": "Repository not found or access denied"
            }
    except ValueError as e:
        return {
            "valid": False,
            "error": str(e)
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Validation failed: {str(e)}"
        }

