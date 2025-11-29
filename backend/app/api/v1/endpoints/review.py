"""Unified Review Endpoint - AURA's Main Entry Point"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Review, Repository, CodeAnalysis, GeneratedTest, RegressionPrediction, AutomatedAction, Issue
from app.ai.agent import CodeMindAgent
from app.ai.test_generator import TestGenerator
from app.ai.regression_predictor import RegressionPredictor
from app.ai.action_engine import ActionEngine

router = APIRouter()
agent = CodeMindAgent()
test_generator = TestGenerator(agent)
predictor = RegressionPredictor()
action_engine = ActionEngine()


class ReviewRequest(BaseModel):
    """Request model for unified review"""
    code: str
    language: str = "python"
    file_path: Optional[str] = None
    repository_id: Optional[int] = None
    generate_tests: bool = True
    predict_regression: bool = True
    trigger_actions: bool = True
    ai_model: Optional[str] = None  # Optional: override default model
    ai_provider: Optional[str] = None  # Optional: override default provider


class ReviewResponse(BaseModel):
    """Response model for unified review"""
    review_id: int
    analysis: Dict[str, Any]
    tests: Optional[Dict[str, Any]] = None
    prediction: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    summary: Dict[str, Any]


@router.post("/", response_model=ReviewResponse)
async def unified_review(
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    """
    AURA's unified review endpoint
    
    This is the main entry point that performs:
    1. Code analysis
    2. Test generation (if requested)
    3. Regression prediction (if requested)
    4. Automated actions (if requested)
    
    All in one autonomous workflow.
    """
    review = None
    try:
        # Create review session
        review = Review(
            repository_id=request.repository_id,
            review_type="full",
            status="in_progress"
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        
        # 1. Code Analysis
        analysis_result = agent.analyze_code(
            request.code, 
            request.language,
            ai_model=request.ai_model,
            ai_provider=request.ai_provider
        )
        db_analysis = CodeAnalysis(
            file_path=request.file_path or "unknown",
            language=request.language,
            code_content=request.code,
            analysis_result=analysis_result,
            issues_found=analysis_result["total_issues"],
            quality_score=analysis_result["quality_score"]
        )
        db.add(db_analysis)
        db.commit()
        db.refresh(db_analysis)
        
        # Save issues to database
        issues_to_save = analysis_result.get("issues", [])
        print(f"🔍 Single file analysis: total_issues={analysis_result.get('total_issues', 0)}, issues_list_length={len(issues_to_save)}")
        if issues_to_save:
            print(f"📝 Saving {len(issues_to_save)} issues for analysis {db_analysis.id}")
            saved_count = 0
            for issue_dict in issues_to_save:
                try:
                    issue_type = issue_dict.get("issue_type", "unknown")
                    if hasattr(issue_type, 'value'):
                        issue_type = issue_type.value
                    
                    severity = issue_dict.get("severity", "low")
                    if hasattr(severity, 'value'):
                        severity = severity.value
                    
                    db_issue = Issue(
                        analysis_id=db_analysis.id,
                        issue_type=str(issue_type).lower(),
                        severity=str(severity).lower(),
                        line_number=issue_dict.get("line_number"),
                        message=str(issue_dict.get("message", ""))[:500],
                        suggestion=str(issue_dict.get("suggestion", ""))[:1000],
                        code_snippet=issue_dict.get("code_snippet")
                    )
                    db.add(db_issue)
                    saved_count += 1
                except Exception as e:
                    print(f"❌ Error saving issue: {str(e)}")
                    print(f"   Issue dict: {issue_dict}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            if saved_count > 0:
                db.commit()
                print(f"✅ Saved {saved_count}/{len(issues_to_save)} issues for analysis {db_analysis.id}")
            else:
                db.rollback()
                print(f"❌ Failed to save any issues")
        else:
            print(f"⚠️  No issues to save for analysis {db_analysis.id}")
        
        review.files_reviewed = 1
        review.issues_found = analysis_result["total_issues"]
        
        # 2. Test Generation (if requested)
        tests_result = None
        if request.generate_tests:
            test_result = test_generator.generate_tests(
                request.code,
                request.language,
                "unit",
                function_name=None,
                ai_model=request.ai_model,
                ai_provider=request.ai_provider
            )
            db_test = GeneratedTest(
                analysis_id=db_analysis.id,
                test_type="unit",
                test_code=test_result["test_code"],
                test_language=request.language,
                coverage_percentage=test_result["coverage_estimate"],
                status="generated"
            )
            db.add(db_test)
            db.commit()
            tests_result = {
                "test_id": db_test.id,
                "test_code": test_result["test_code"],
                "coverage": test_result["coverage_estimate"],
                "test_count": test_result["test_count"]
            }
            review.tests_generated = 1
        
        # 3. Regression Prediction (if requested)
        prediction_result = None
        if request.predict_regression:
            pred_result = predictor.predict_regression(
                request.code,
                request.file_path or "unknown"
            )
            db_prediction = RegressionPrediction(
                repository_id=request.repository_id,
                file_path=request.file_path or "unknown",
                prediction_type="regression",
                risk_score=pred_result["risk_score"],
                confidence=pred_result["confidence"],
                predicted_issues=pred_result["predicted_issues"]
            )
            db.add(db_prediction)
            db.commit()
            prediction_result = {
                "prediction_id": db_prediction.id,
                "risk_score": pred_result["risk_score"],
                "risk_level": pred_result["risk_level"],
                "recommendations": pred_result["recommendations"]
            }
        
        # 4. Automated Actions (if requested)
        actions_result = None
        if request.trigger_actions:
            actions = action_engine.determine_actions(
                analysis_result,
                prediction_result,
                tests_result["coverage"] if tests_result else None
            )
            
            executed_actions = []
            for action_data in actions[:3]:  # Limit to 3 actions for demo
                result = action_engine.execute_action(action_data)
                db_action = AutomatedAction(
                    action_type=action_data["action_type"],
                    trigger_reason=action_data["trigger_reason"],
                    target_file=request.file_path or "unknown",
                    action_data=action_data.get("context", {}),
                    status=result.get("status", "completed"),
                    result=result
                )
                db.add(db_action)
                executed_actions.append({
                    "action_type": action_data["action_type"],
                    "status": result.get("status"),
                    "result": result
                })
            
            db.commit()
            actions_result = executed_actions
            review.actions_triggered = len(executed_actions)
        
        # Complete review
        review.status = "completed"
        review.review_result = {
            "analysis_id": db_analysis.id,
            "quality_score": analysis_result["quality_score"],
            "issues_found": analysis_result["total_issues"]
        }
        db.commit()
        
        # Generate summary
        summary = {
            "quality_score": analysis_result["quality_score"],
            "issues_found": analysis_result["total_issues"],
            "tests_generated": 1 if tests_result else 0,
            "regression_risk": prediction_result["risk_level"] if prediction_result else "unknown",
            "actions_taken": len(actions_result) if actions_result else 0
        }
        
        return ReviewResponse(
            review_id=review.id,
            analysis=analysis_result,
            tests=tests_result,
            prediction=prediction_result,
            actions=actions_result,
            summary=summary
        )
    
    except Exception as e:
        if review:
            review.status = "failed"
            db.commit()
        raise HTTPException(status_code=500, detail=f"Review failed: {str(e)}")


class RepositoryReviewRequest(BaseModel):
    """Request model for repository-wide review"""
    generate_tests: bool = True
    predict_regression: bool = True
    trigger_actions: bool = True
    ai_model: Optional[str] = None
    ai_provider: Optional[str] = None
    max_files: Optional[int] = 50  # Limit number of files to review


@router.post("/repository/{repo_id}", response_model=ReviewResponse)
async def review_repository(
    repo_id: int,
    request: RepositoryReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Review an entire repository - analyzes all files in the repository
    """
    import os
    from pathlib import Path
    from app.api.v1.endpoints.repositories import list_files_in_directory
    
    review = None
    try:
        # Get repository
        repo = db.query(Repository).filter(Repository.id == repo_id).first()
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        if repo.repo_type != "local":
            raise HTTPException(
                status_code=400,
                detail="Currently only local repositories can be fully reviewed"
            )
        
        if not repo.path or not os.path.exists(repo.path):
            raise HTTPException(
                status_code=400,
                detail="Repository path does not exist"
            )
        
        # Create review session
        review = Review(
            repository_id=repo_id,
            review_type="repository",
            status="in_progress"
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        
        # Get all code files from repository
        all_files = list_files_in_directory(repo.path, max_depth=5)
        
        # Filter to code files only and limit
        code_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php'}
        code_files = [f for f in all_files if f.get("extension", "").lower() in code_extensions]
        code_files = code_files[:request.max_files] if request.max_files else code_files
        
        if not code_files:
            raise HTTPException(
                status_code=400,
                detail="No code files found in repository"
            )
        
        # Review each file
        all_issues = []
        all_analyses = []
        total_quality_score = 0
        files_reviewed = 0
        
        for file_info in code_files:
            try:
                file_path = file_info["path"]
                relative_path = file_info["relative_path"]
                
                # Read file content
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
                
                if not file_content.strip():
                    continue
                
                # Detect language from extension
                ext = file_info.get("extension", "").lower()
                file_language = "python"  # default
                if ext in ['.js', '.jsx', '.mjs', '.cjs']:
                    file_language = "javascript"
                elif ext in ['.ts', '.tsx']:
                    file_language = "typescript"
                elif ext == '.java':
                    file_language = "java"
                elif ext in ['.cpp', '.cc', '.cxx', '.hpp']:
                    file_language = "cpp"
                elif ext in ['.c', '.h']:
                    file_language = "c"
                elif ext == '.cs':
                    file_language = "csharp"
                elif ext == '.go':
                    file_language = "go"
                elif ext == '.rs':
                    file_language = "rust"
                elif ext == '.rb':
                    file_language = "ruby"
                elif ext in ['.php', '.phtml']:
                    file_language = "php"
                
                # Analyze file
                analysis_result = agent.analyze_code(
                    file_content,
                    file_language,
                    ai_model=request.ai_model,
                    ai_provider=request.ai_provider
                )
                
                # Debug: Check analysis result structure
                if analysis_result.get("total_issues", 0) > 0:
                    print(f"🔍 Analysis result for {relative_path}:")
                    print(f"   total_issues: {analysis_result.get('total_issues')}")
                    print(f"   issues list length: {len(analysis_result.get('issues', []))}")
                    if analysis_result.get("issues"):
                        print(f"   First issue: {analysis_result.get('issues')[0]}")
                
                # Save analysis
                db_analysis = CodeAnalysis(
                    file_path=relative_path,
                    language=file_language,
                    code_content=file_content[:1000],  # Store first 1000 chars
                    analysis_result=analysis_result,
                    issues_found=analysis_result["total_issues"],
                    quality_score=analysis_result["quality_score"]
                )
                db.add(db_analysis)
                db.commit()
                db.refresh(db_analysis)
                
                # Save issues to database
                issues_to_save = analysis_result.get("issues", [])
                print(f"🔍 Analysis for {relative_path}: total_issues={analysis_result.get('total_issues', 0)}, issues_list_length={len(issues_to_save)}")
                if issues_to_save:
                    print(f"📝 Saving {len(issues_to_save)} issues for analysis {db_analysis.id}")
                    print(f"   First issue sample: {issues_to_save[0] if issues_to_save else 'N/A'}")
                    saved_count = 0
                    failed_count = 0
                    
                    # Save issues in smaller batches to avoid losing all on error
                    batch_size = 10
                    for batch_start in range(0, len(issues_to_save), batch_size):
                        batch = issues_to_save[batch_start:batch_start + batch_size]
                        batch_saved = 0
                        
                        for idx, issue_dict in enumerate(batch):
                            try:
                                # Handle both dict format and string format for issue_type/severity
                                issue_type = issue_dict.get("issue_type", "unknown")
                                if hasattr(issue_type, 'value'):  # If it's an Enum
                                    issue_type = issue_type.value
                                
                                severity = issue_dict.get("severity", "low")
                                if hasattr(severity, 'value'):  # If it's an Enum
                                    severity = severity.value
                                
                                # Ensure we have valid values
                                issue_type_str = str(issue_type).lower() if issue_type else "unknown"
                                severity_str = str(severity).lower() if severity else "low"
                                
                                db_issue = Issue(
                                    analysis_id=db_analysis.id,
                                    issue_type=issue_type_str,
                                    severity=severity_str,
                                    line_number=issue_dict.get("line_number"),
                                    message=str(issue_dict.get("message", ""))[:500],  # Limit message length
                                    suggestion=str(issue_dict.get("suggestion", ""))[:1000],  # Limit suggestion length
                                    code_snippet=issue_dict.get("code_snippet")
                                )
                                db.add(db_issue)
                                batch_saved += 1
                                
                            except Exception as issue_err:
                                print(f"❌ Error preparing issue {batch_start + idx}: {str(issue_err)}")
                                failed_count += 1
                                continue
                        
                        # Commit this batch
                        if batch_saved > 0:
                            try:
                                db.commit()
                                saved_count += batch_saved
                                print(f"   ✅ Committed batch: {batch_saved} issues (total: {saved_count}/{len(issues_to_save)})")
                            except Exception as commit_err:
                                print(f"   ❌ Batch commit error: {str(commit_err)}")
                                db.rollback()
                                # Try to save each issue individually
                                for idx, issue_dict in enumerate(batch):
                                    try:
                                        issue_type = issue_dict.get("issue_type", "unknown")
                                        if hasattr(issue_type, 'value'):
                                            issue_type = issue_type.value
                                        severity = issue_dict.get("severity", "low")
                                        if hasattr(severity, 'value'):
                                            severity = severity.value
                                        
                                        db_issue = Issue(
                                            analysis_id=db_analysis.id,
                                            issue_type=str(issue_type).lower(),
                                            severity=str(severity).lower(),
                                            line_number=issue_dict.get("line_number"),
                                            message=str(issue_dict.get("message", ""))[:500],
                                            suggestion=str(issue_dict.get("suggestion", ""))[:1000],
                                            code_snippet=issue_dict.get("code_snippet")
                                        )
                                        db.add(db_issue)
                                        db.commit()
                                        saved_count += 1
                                    except Exception as individual_err:
                                        print(f"   ❌ Failed to save issue individually: {str(individual_err)}")
                                        failed_count += 1
                                        db.rollback()
                                        continue
                    
                    # Final summary (batches already committed)
                    if saved_count > 0:
                        print(f"✅ Saved {saved_count}/{len(issues_to_save)} issues for analysis {db_analysis.id} (file: {relative_path})")
                        if failed_count > 0:
                            print(f"⚠️  {failed_count} issues failed to save")
                    else:
                        print(f"❌ Failed to save any issues for analysis {db_analysis.id} - all {len(issues_to_save)} issues failed to save")
                else:
                    print(f"⚠️  No issues to save for analysis {db_analysis.id} (file: {relative_path})")
                all_issues.extend(analysis_result.get("issues", []))
                all_analyses.append({
                    "file": relative_path,
                    "language": file_language,
                    "issues": analysis_result["total_issues"],
                    "quality_score": analysis_result["quality_score"]
                })
                total_quality_score += analysis_result["quality_score"]
                files_reviewed += 1
                
            except Exception as e:
                print(f"Error reviewing file {file_info.get('relative_path', 'unknown')}: {str(e)}")
                continue
        
        if files_reviewed == 0:
            raise HTTPException(
                status_code=400,
                detail="No files could be reviewed"
            )
        
        # Aggregate results
        avg_quality_score = total_quality_score / files_reviewed if files_reviewed > 0 else 0
        
        # Group issues
        issues_by_type = {}
        issues_by_severity = {}
        for issue in all_issues:
            issue_type = issue.get("issue_type", "unknown")
            severity = issue.get("severity", "unknown")
            issues_by_type[issue_type] = issues_by_type.get(issue_type, 0) + 1
            issues_by_severity[severity] = issues_by_severity.get(severity, 0) + 1
        
        aggregated_analysis = {
            "issues": all_issues[:100],  # Limit to first 100 issues
            "quality_score": avg_quality_score,
            "total_issues": len(all_issues),
            "issues_by_type": issues_by_type,
            "issues_by_severity": issues_by_severity,
            "files_reviewed": files_reviewed,
            "file_analyses": all_analyses
        }
        
        # Generate tests for repository (sample from first file)
        tests_result = None
        if request.generate_tests and code_files:
            try:
                first_file = code_files[0]
                with open(first_file["path"], 'r', encoding='utf-8', errors='ignore') as f:
                    sample_code = f.read()
                
                ext = first_file.get("extension", "").lower()
                sample_language = "python"
                if ext in ['.js', '.jsx']:
                    sample_language = "javascript"
                elif ext in ['.ts', '.tsx']:
                    sample_language = "typescript"
                elif ext == '.java':
                    sample_language = "java"
                
                test_result = test_generator.generate_tests(
                    sample_code,
                    sample_language,
                    "unit",
                    function_name=None,
                    ai_model=request.ai_model,
                    ai_provider=request.ai_provider
                )
                tests_result = {
                    "test_code": test_result["test_code"],
                    "coverage": test_result["coverage_estimate"],
                    "test_count": test_result["test_count"]
                }
                review.tests_generated = 1
            except Exception as e:
                print(f"Error generating tests: {str(e)}")
        
        # Regression prediction
        prediction_result = None
        if request.predict_regression:
            try:
                pred_result = predictor.predict_regression(
                    f"Repository review: {files_reviewed} files",
                    repo.path
                )
                db_prediction = RegressionPrediction(
                    repository_id=repo_id,
                    file_path=repo.path,
                    prediction_type="regression",
                    risk_score=pred_result["risk_score"],
                    confidence=pred_result["confidence"],
                    predicted_issues=pred_result["predicted_issues"]
                )
                db.add(db_prediction)
                db.commit()
                prediction_result = {
                    "risk_score": pred_result["risk_score"],
                    "risk_level": pred_result["risk_level"],
                    "recommendations": pred_result["recommendations"]
                }
            except Exception as e:
                print(f"Error predicting regression: {str(e)}")
        
        # Update review
        review.files_reviewed = files_reviewed
        review.issues_found = len(all_issues)
        review.status = "completed"
        # Store full review result including all issues for later retrieval
        review.review_result = {
            "quality_score": avg_quality_score,
            "issues_found": len(all_issues),
            "files_reviewed": files_reviewed,
            "analysis": aggregated_analysis,  # Include full analysis with all issues
            "all_issues": all_issues[:500]  # Store up to 500 issues in review_result
        }
        db.commit()
        print(f"💾 Saved review result with {len(all_issues)} issues to review.review_result")
        
        # Summary
        summary = {
            "quality_score": avg_quality_score,
            "issues_found": len(all_issues),
            "tests_generated": 1 if tests_result else 0,
            "regression_risk": prediction_result["risk_level"] if prediction_result else "unknown",
            "actions_taken": 0,
            "files_reviewed": files_reviewed
        }
        
        return ReviewResponse(
            review_id=review.id,
            analysis=aggregated_analysis,
            tests=tests_result,
            prediction=prediction_result,
            actions=[],
            summary=summary
        )
    
    except HTTPException:
        raise
    except Exception as e:
        if review:
            review.status = "failed"
            db.commit()
        raise HTTPException(status_code=500, detail=f"Repository review failed: {str(e)}")


@router.get("/{review_id}")
async def get_review(review_id: int, db: Session = Depends(get_db)):
    """Get review by ID"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return {
        "id": review.id,
        "repository_id": review.repository_id,
        "review_type": review.review_type,
        "status": review.status,
        "files_reviewed": review.files_reviewed,
        "issues_found": review.issues_found,
        "tests_generated": review.tests_generated,
        "actions_triggered": review.actions_triggered,
        "review_result": review.review_result,
        "started_at": review.started_at,
        "completed_at": review.completed_at
    }

