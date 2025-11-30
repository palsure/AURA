"""Application Configuration"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str = "sqlite:///./codemind.db"
    
    # For production PostgreSQL, the DATABASE_URL will be provided by the hosting platform
    # Format: postgresql://user:password@host:port/dbname
    # SQLAlchemy needs: postgresql+psycopg://user:password@host:port/dbname (psycopg3)
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # AI Services
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # AI Model Configuration
    OPENAI_MODEL: str = "gpt-4o"  # Options: gpt-4o, gpt-4-turbo, gpt-4
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"  # Options: claude-3-5-sonnet-20241022, claude-3-opus-20240229
    PREFERRED_AI_PROVIDER: str = "openai"  # Options: openai, anthropic, auto
    
    # GitHub Integration
    GITHUB_TOKEN: str = ""
    
    # Application
    DEBUG: bool = True
    ENVIRONMENT: str = "development"  # development, production
    FRONTEND_URL: str = ""  # Frontend URL for CORS (e.g., https://your-app.onrender.com)
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    @property
    def database_url(self) -> str:
        """Get database URL with proper driver for PostgreSQL"""
        url = self.DATABASE_URL
        
        # Validate URL is not empty
        if not url or not url.strip():
            raise ValueError(
                "DATABASE_URL is not set. Please set it in your environment variables. "
                "For Render: Create a PostgreSQL database and copy the Internal Database URL."
            )
        
        url = url.strip()
        
        # Convert postgresql:// to postgresql+psycopg:// for SQLAlchemy (psycopg3)
        if url.startswith("postgresql://") and "+psycopg" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        
        return url
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    
    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins, including frontend URL if provided"""
        origins = list(self.CORS_ORIGINS)
        
        # Add frontend URL if provided
        if self.FRONTEND_URL:
            frontend_url = self.FRONTEND_URL.strip().rstrip('/')
            if frontend_url not in origins:
                origins.append(frontend_url)
            # Also add without trailing slash variations
            if frontend_url.endswith('/'):
                origins.append(frontend_url.rstrip('/'))
            else:
                origins.append(frontend_url + '/')
        
        # In production, if no specific frontend URL is set, allow all origins
        # This is a fallback - it's better to set FRONTEND_URL explicitly
        if self.ENVIRONMENT == "production" and not self.FRONTEND_URL:
            return ["*"]
        
        return origins
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

