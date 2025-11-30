"""Database Configuration and Initialization"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# Use database_url property which handles PostgreSQL driver conversion
try:
    database_url = settings.database_url
    logger.info(f"Database URL configured: {database_url.split('@')[-1] if '@' in database_url else 'SQLite'}")
except ValueError as e:
    logger.error(f"Database configuration error: {str(e)}")
    raise

try:
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {},
        pool_pre_ping=True if "postgresql" in database_url else False  # Reconnect if connection lost
    )
    logger.info("Database engine created successfully")
except Exception as e:
    logger.error(f"Failed to create database engine: {str(e)}")
    logger.error(f"Database URL format: {database_url[:50]}..." if len(database_url) > 50 else f"Database URL: {database_url}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

