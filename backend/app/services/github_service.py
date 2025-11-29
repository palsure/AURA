"""
GitHub Integration Service
Handles GitHub API interactions for repository integration
"""

import requests
from typing import List, Dict, Any, Optional
from app.core.config import settings


class GitHubService:
    """Service for interacting with GitHub API"""
    
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    def get_repository_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get repository information"""
        url = f"{self.base_url}/repos/{owner}/{repo}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_repository_contents(
        self,
        owner: str,
        repo: str,
        path: str = "",
        ref: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get repository contents (files and directories)"""
        url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
        params = {}
        if ref:
            params["ref"] = ref
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_file_content(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: Optional[str] = None
    ) -> str:
        """Get file content from repository"""
        url = f"{self.base_url}/repos/{owner}/{repo}/contents/{path}"
        params = {}
        if ref:
            params["ref"] = ref
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Decode base64 content
        import base64
        content = base64.b64decode(data["content"]).decode("utf-8")
        return content
    
    def get_repository_languages(self, owner: str, repo: str) -> Dict[str, int]:
        """Get repository languages statistics"""
        url = f"{self.base_url}/repos/{owner}/{repo}/languages"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def list_repository_files(
        self,
        owner: str,
        repo: str,
        path: str = "",
        extension: Optional[str] = None
    ) -> List[str]:
        """Recursively list all files in repository"""
        files = []
        contents = self.get_repository_contents(owner, repo, path)
        
        for item in contents:
            if item["type"] == "file":
                if not extension or item["name"].endswith(extension):
                    files.append(item["path"])
            elif item["type"] == "dir":
                # Recursively get files from subdirectories
                sub_files = self.list_repository_files(
                    owner, repo, item["path"], extension
                )
                files.extend(sub_files)
        
        return files
    
    def parse_github_url(self, url: str) -> Dict[str, str]:
        """Parse GitHub URL to extract owner and repo"""
        # Handle various GitHub URL formats
        url = url.strip()
        
        # Remove .git suffix if present
        if url.endswith(".git"):
            url = url[:-4]
        
        # Handle https://github.com/owner/repo
        if "github.com" in url:
            parts = url.split("github.com/")[-1].split("/")
            if len(parts) >= 2:
                return {
                    "owner": parts[0],
                    "repo": parts[1],
                    "full_name": f"{parts[0]}/{parts[1]}"
                }
        
        # Handle owner/repo format
        if "/" in url and not url.startswith("http"):
            parts = url.split("/")
            if len(parts) >= 2:
                return {
                    "owner": parts[0],
                    "repo": parts[1],
                    "full_name": f"{parts[0]}/{parts[1]}"
                }
        
        raise ValueError(f"Invalid GitHub URL format: {url}")
    
    def validate_repository_access(self, owner: str, repo: str) -> bool:
        """Validate that we can access the repository"""
        try:
            self.get_repository_info(owner, repo)
            return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return False
            raise
        except Exception:
            return False

