"""Database Models"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class CodeAnalysis(Base):
    """Code analysis results model"""
    __tablename__ = "code_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, index=True)
    language = Column(String)
    code_content = Column(Text)
    analysis_result = Column(JSON)
    issues_found = Column(Integer, default=0)
    quality_score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    issues = relationship("Issue", back_populates="analysis", cascade="all, delete-orphan")
    tests = relationship("GeneratedTest", back_populates="analysis", cascade="all, delete-orphan")


class Issue(Base):
    """Code issues model"""
    __tablename__ = "issues"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("code_analyses.id"), index=True)
    issue_type = Column(String)  # bug, security, performance, style
    severity = Column(String)  # critical, high, medium, low
    line_number = Column(Integer)
    message = Column(Text)
    suggestion = Column(Text)
    fixed = Column(Boolean, default=False)
    auto_fixed = Column(Boolean, default=False)  # Whether AURA auto-fixed this
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    analysis = relationship("CodeAnalysis", back_populates="issues")


class Repository(Base):
    """Repository model"""
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    path = Column(String)
    language = Column(String)
    repo_type = Column(String, default="local")  # local, github
    github_url = Column(String, nullable=True)
    github_owner = Column(String, nullable=True)
    github_repo = Column(String, nullable=True)
    github_token = Column(String, nullable=True)  # Encrypted in production
    total_files = Column(Integer, default=0)
    last_analyzed = Column(DateTime(timezone=True))
    last_reviewed = Column(DateTime(timezone=True))
    continuous_monitoring = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    reviews = relationship("Review", back_populates="repository", cascade="all, delete-orphan")
    predictions = relationship("RegressionPrediction", back_populates="repository", cascade="all, delete-orphan")


class Review(Base):
    """Autonomous review sessions"""
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), index=True)
    review_type = Column(String)  # full, incremental, triggered
    status = Column(String)  # pending, in_progress, completed, failed
    files_reviewed = Column(Integer, default=0)
    issues_found = Column(Integer, default=0)
    tests_generated = Column(Integer, default=0)
    actions_triggered = Column(Integer, default=0)
    review_result = Column(JSON)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    repository = relationship("Repository", back_populates="reviews")


class GeneratedTest(Base):
    """AI-generated tests"""
    __tablename__ = "generated_tests"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("code_analyses.id"), index=True)
    test_type = Column(String)  # unit, integration, regression
    test_code = Column(Text)
    test_language = Column(String)
    coverage_percentage = Column(Float)
    status = Column(String)  # generated, executed, passed, failed
    execution_result = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    executed_at = Column(DateTime(timezone=True))
    
    # Relationships
    analysis = relationship("CodeAnalysis", back_populates="tests")


class RegressionPrediction(Base):
    """Regression predictions"""
    __tablename__ = "regression_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), index=True)
    file_path = Column(String)
    prediction_type = Column(String)  # regression, bug, performance
    risk_score = Column(Float)  # 0.0 to 1.0
    confidence = Column(Float)  # 0.0 to 1.0
    predicted_issues = Column(JSON)
    historical_patterns = Column(JSON)
    triggered = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    repository = relationship("Repository", back_populates="predictions")


class AutomatedAction(Base):
    """Automated actions triggered by AURA"""
    __tablename__ = "automated_actions"
    
    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String)  # fix, test, deploy, notify, block
    trigger_reason = Column(String)
    target_file = Column(String)
    action_data = Column(JSON)
    status = Column(String)  # pending, executing, completed, failed
    result = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    executed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))


class LearningPattern(Base):
    """Learning patterns from code analysis"""
    __tablename__ = "learning_patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    pattern_type = Column(String)
    pattern_data = Column(JSON)
    frequency = Column(Integer, default=1)
    confidence = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
