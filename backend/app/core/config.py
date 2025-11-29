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
    # SQLAlchemy needs: postgresql+psycopg2://user:password@host:port/dbname
    
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
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    @property
    def database_url(self) -> str:
        """Get database URL with proper driver for PostgreSQL"""
        url = self.DATABASE_URL
        # Convert postgresql:// to postgresql+psycopg2:// for SQLAlchemy
        if url.startswith("postgresql://") and "+psycopg2" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

