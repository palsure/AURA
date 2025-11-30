"""Test Generation Endpoints"""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import GeneratedTest, CodeAnalysis, Repository
from app.ai.agent import CodeMindAgent
from app.ai.test_generator import TestGenerator

router = APIRouter()
agent = CodeMindAgent()
test_generator = TestGenerator(agent)


class GenerateTestRequest(BaseModel):
    """Request model for test generation"""
    code: str
    language: str = "python"
    test_type: str = "unit"  # unit, integration, regression
    function_name: Optional[str] = None
    analysis_id: Optional[int] = None
    ai_model: Optional[str] = None  # Optional: override default model
    ai_provider: Optional[str] = None  # Optional: override default provider
    repository_id: Optional[int] = None  # Repository ID to save test file
    file_path: Optional[str] = None  # Source file path to create test for


class GenerateTestResponse(BaseModel):
    """Response model for test generation"""
    test_id: int
    test_code: str
    test_type: str
    language: str
    coverage_estimate: float
    test_count: int


def get_test_file_path(source_file_path: str, language: str, repo_path: str, test_type: str = "unit") -> str:
    """Determine the test file path based on source file path and language"""
    repo_path_obj = Path(repo_path)
    
    # Handle relative paths - make them relative to repo root
    source_path = Path(source_file_path)
    if source_path.is_absolute():
        try:
            source_path = source_path.relative_to(repo_path_obj)
        except ValueError:
            # If absolute path is not in repo, treat as relative
            pass
    
    source_name = source_path.stem  # filename without extension
    source_ext = source_path.suffix  # .py, .js, etc.
    source_dir = source_path.parent
    
    # Determine test file naming convention based on language and test type
    test_suffix = "_e2e" if test_type.lower() == "e2e" else ""
    
    if language.lower() in ["python", "py"]:
        # Python: test_*.py or test_*_e2e.py for E2E
        test_name = f"test_{source_name}{test_suffix}.py"
        # Try tests/ directory in same location, or same directory
        test_dir = source_dir / "tests"
        # If tests directory doesn't exist, use same directory
        if not (repo_path_obj / test_dir).exists():
            test_dir = source_dir
    elif language.lower() in ["javascript", "typescript", "js", "ts"]:
        # JavaScript/TypeScript: *.test.js, *.test.ts or *.e2e.test.js for E2E
        ext = ".test.js" if language.lower() in ["javascript", "js"] else ".test.ts"
        if test_type.lower() == "e2e":
            ext = ".e2e.test.js" if language.lower() in ["javascript", "js"] else ".e2e.test.ts"
        test_name = f"{source_name}{ext}"
        # Try __tests__ directory, or same directory
        test_dir = source_dir / "__tests__"
        if not (repo_path_obj / test_dir).exists():
            test_dir = source_dir
    elif language.lower() == "java":
        # Java: *Test.java
        test_name = f"{source_name}Test.java"
        # Try to find test directory structure
        # If source is in src/main/java, test goes to src/test/java
        if "src" in str(source_dir) and "main" in str(source_dir):
            parts = list(source_dir.parts)
            if "main" in parts:
                main_idx = parts.index("main")
                parts[main_idx] = "test"
                if "java" not in parts[main_idx+1:]:
                    parts.insert(main_idx + 1, "java")
                test_dir = Path(*parts)
            else:
                test_dir = source_dir / "test"
        else:
            test_dir = source_dir / "test"
        if not (repo_path_obj / test_dir).exists():
            test_dir = source_dir
    else:
        # Default: test_*.ext
        test_name = f"test_{source_name}{source_ext}"
        test_dir = source_dir
    
    # Create test file path
    test_path = test_dir / test_name
    
    # Ensure path is relative to repo root
    if test_path.is_absolute():
        try:
            test_path = test_path.relative_to(repo_path_obj)
        except ValueError:
            # Fallback: use source directory + test name
            test_path = source_dir / test_name
    
    return str(test_path)


@router.post("/generate", response_model=GenerateTestResponse)
async def generate_tests(
    request: GenerateTestRequest,
    db: Session = Depends(get_db)
):
    """
    Generate tests for code using AI
    
    This endpoint uses AURA's test generation engine to create
    comprehensive test suites automatically.
    If repository_id and file_path are provided, the test file will be saved to the repository.
    """
    try:
        # Log the request details
        print(f"🔍 Test generation request:")
        print(f"   Language: {request.language}")
        print(f"   Test type: {request.test_type}")
        print(f"   AI Model: {request.ai_model}")
        print(f"   AI Provider: {request.ai_provider}")
        print(f"   Code length: {len(request.code)} chars")
        print(f"   Code preview: {request.code[:200]}...")
        
        # Generate tests with optional model selection
        result = test_generator.generate_tests(
            request.code,
            request.language,
            request.test_type,
            request.function_name,
            ai_model=request.ai_model,
            ai_provider=request.ai_provider
        )
        
        print(f"✅ Test generation successful:")
        print(f"   Test code length: {len(result.get('test_code', ''))} chars")
        print(f"   Test count: {result.get('test_count', 0)}")
        print(f"   Coverage estimate: {result.get('coverage_estimate', 0)}%")
        
        # Save test file to repository if repository_id and file_path are provided
        test_file_path = None
        if request.repository_id and request.file_path:
            repo = db.query(Repository).filter(Repository.id == request.repository_id).first()
            if repo and repo.repo_type == "local" and repo.path and os.path.exists(repo.path):
                try:
                    repo_path_obj = Path(repo.path)
                    source_file_path = Path(request.file_path)
                    
                    # If source path is not absolute, make it relative to repo
                    if not source_file_path.is_absolute():
                        source_file_path = repo_path_obj / source_file_path
                    
                    # Determine test file path
                    test_file_path = get_test_file_path(
                        str(source_file_path.relative_to(repo_path_obj)),
                        request.language,
                        repo.path,
                        request.test_type or "unit"
                    )
                    
                    # Create full path
                    full_test_path = repo_path_obj / test_file_path
                    
                    # Create directory if it doesn't exist
                    full_test_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Write test file
                    with open(full_test_path, 'w', encoding='utf-8') as f:
                        f.write(result["test_code"])
                    
                    print(f"Test file saved to: {full_test_path}")
                except Exception as e:
                    print(f"Error saving test file: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    # Continue even if file save fails
        
        # Create or find CodeAnalysis if repository_id and file_path are provided
        analysis_id = request.analysis_id
        if not analysis_id and request.repository_id and request.file_path:
            # Try to find existing analysis for this file
            repo = db.query(Repository).filter(Repository.id == request.repository_id).first()
            if repo:
                existing_analysis = db.query(CodeAnalysis).filter(
                    CodeAnalysis.file_path.like(f"%{request.file_path}%")
                ).order_by(CodeAnalysis.created_at.desc()).first()
                
                if existing_analysis:
                    analysis_id = existing_analysis.id
                else:
                    # Create a new analysis for this file
                    new_analysis = CodeAnalysis(
                        file_path=request.file_path,
                        language=request.language,
                        code_content="",  # We don't have the full source code here
                        analysis_result={},
                        issues_found=0,
                        quality_score=100
                    )
                    db.add(new_analysis)
                    db.commit()
                    db.refresh(new_analysis)
                    analysis_id = new_analysis.id
        
        # Save to database
        db_test = GeneratedTest(
            analysis_id=analysis_id,
            test_type=request.test_type,
            test_code=result["test_code"],
            test_language=request.language,
            coverage_percentage=result["coverage_estimate"],
            status="generated"
        )
        db.add(db_test)
        db.commit()
        db.refresh(db_test)
        
        response = GenerateTestResponse(
            test_id=db_test.id,
            test_code=result["test_code"],
            test_type=result["test_type"],
            language=result["language"],
            coverage_estimate=result["coverage_estimate"],
            test_count=result["test_count"]
        )
        
        # Add test file path to response if saved
        if test_file_path:
            response_dict = response.dict()
            response_dict["test_file_path"] = test_file_path
            return response_dict
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test generation failed: {str(e)}")


@router.post("/generate-regression")
async def generate_regression_tests(
    code: str,
    language: str = "python",
    previous_issues: Optional[List[Dict[str, Any]]] = None,
    db: Session = Depends(get_db)
):
    """Generate regression tests based on previous issues"""
    try:
        result = test_generator.generate_regression_tests(
            code,
            previous_issues or [],
            language
        )
        
        db_test = GeneratedTest(
            test_type="regression",
            test_code=result["test_code"],
            test_language=language,
            coverage_percentage=result["coverage_estimate"],
            status="generated"
        )
        db.add(db_test)
        db.commit()
        db.refresh(db_test)
        
        return {
            "test_id": db_test.id,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regression test generation failed: {str(e)}")


@router.get("/{test_id}")
async def get_test(test_id: int, db: Session = Depends(get_db)):
    """Get generated test by ID"""
    test = db.query(GeneratedTest).filter(GeneratedTest.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {
        "id": test.id,
        "test_type": test.test_type,
        "test_code": test.test_code,
        "language": test.test_language,
        "coverage": test.coverage_percentage,
        "status": test.status,
        "created_at": test.created_at
    }


@router.get("/")
async def list_tests(
    analysis_id: Optional[int] = None,
    test_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List generated tests"""
    query = db.query(GeneratedTest)
    
    if analysis_id:
        query = query.filter(GeneratedTest.analysis_id == analysis_id)
    if test_type:
        query = query.filter(GeneratedTest.test_type == test_type)
    
    tests = query.all()
    return tests

