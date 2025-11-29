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
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

