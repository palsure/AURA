"""
Automated Action Engine
Triggers automated actions based on analysis results
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class ActionType(Enum):
    """Types of automated actions"""
    AUTO_FIX = "auto_fix"
    GENERATE_TESTS = "generate_tests"
    BLOCK_DEPLOYMENT = "block_deployment"
    NOTIFY_TEAM = "notify_team"
    CREATE_ISSUE = "create_issue"
    RUN_TESTS = "run_tests"
    SUGGEST_REVIEW = "suggest_review"


class ActionEngine:
    """Engine for triggering automated actions"""
    
    def __init__(self):
        self.action_rules = self._initialize_rules()
    
    def _initialize_rules(self) -> Dict[str, List[Dict[str, Any]]]:
        """Initialize action rules"""
        return {
            "critical_security": [
                {"action": ActionType.AUTO_FIX, "priority": 1},
                {"action": ActionType.BLOCK_DEPLOYMENT, "priority": 2},
                {"action": ActionType.NOTIFY_TEAM, "priority": 3}
            ],
            "high_severity_bug": [
                {"action": ActionType.SUGGEST_REVIEW, "priority": 1},
                {"action": ActionType.GENERATE_TESTS, "priority": 2}
            ],
            "regression_risk": [
                {"action": ActionType.GENERATE_TESTS, "priority": 1},
                {"action": ActionType.RUN_TESTS, "priority": 2}
            ],
            "low_test_coverage": [
                {"action": ActionType.GENERATE_TESTS, "priority": 1}
            ],
            "code_quality_issues": [
                {"action": ActionType.AUTO_FIX, "priority": 1},
                {"action": ActionType.SUGGEST_REVIEW, "priority": 2}
            ]
        }
    
    def determine_actions(
        self,
        analysis_result: Dict[str, Any],
        regression_prediction: Optional[Dict[str, Any]] = None,
        test_coverage: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Determine which actions to trigger based on analysis
        
        Args:
            analysis_result: Result from code analysis
            regression_prediction: Regression prediction results
            test_coverage: Current test coverage
            
        Returns:
            List of actions to execute
        """
        actions = []
        
        # Check for critical security issues
        critical_security = [
            issue for issue in analysis_result.get("issues", [])
            if issue.get("issue_type") == "security" and issue.get("severity") == "critical"
        ]
        if critical_security:
            actions.extend(self._get_actions_for_rule("critical_security", critical_security))
        
        # Check for high severity bugs
        high_bugs = [
            issue for issue in analysis_result.get("issues", [])
            if issue.get("severity") in ["critical", "high"] and issue.get("issue_type") == "bug"
        ]
        if high_bugs:
            actions.extend(self._get_actions_for_rule("high_severity_bug", high_bugs))
        
        # Check regression risk
        if regression_prediction and regression_prediction.get("risk_score", 0) > 0.6:
            actions.extend(self._get_actions_for_rule("regression_risk", regression_prediction))
        
        # Check test coverage
        if test_coverage and test_coverage < 70:
            actions.extend(self._get_actions_for_rule("low_test_coverage", {"coverage": test_coverage}))
        
        # Check code quality
        quality_score = analysis_result.get("quality_score", 100)
        if quality_score < 70:
            actions.extend(self._get_actions_for_rule("code_quality_issues", analysis_result))
        
        # Sort by priority
        actions.sort(key=lambda x: x.get("priority", 99))
        
        return actions
    
    def _get_actions_for_rule(
        self,
        rule_name: str,
        context: Any
    ) -> List[Dict[str, Any]]:
        """Get actions for a specific rule"""
        if rule_name not in self.action_rules:
            return []
        
        actions = []
        for rule in self.action_rules[rule_name]:
            action = {
                "action_type": rule["action"].value,
                "priority": rule["priority"],
                "trigger_reason": rule_name,
                "context": self._serialize_context(context),
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            actions.append(action)
        
        return actions
    
    def _serialize_context(self, context: Any) -> Dict[str, Any]:
        """Serialize context for storage"""
        if isinstance(context, dict):
            return context
        elif isinstance(context, list):
            return {"items": context, "count": len(context)}
        else:
            return {"data": str(context)}
    
    def execute_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an automated action
        
        Args:
            action: Action to execute
            
        Returns:
            Execution result
        """
        action_type = action.get("action_type")
        
        try:
            if action_type == ActionType.AUTO_FIX.value:
                return self._execute_auto_fix(action)
            elif action_type == ActionType.GENERATE_TESTS.value:
                return self._execute_generate_tests(action)
            elif action_type == ActionType.BLOCK_DEPLOYMENT.value:
                return self._execute_block_deployment(action)
            elif action_type == ActionType.NOTIFY_TEAM.value:
                return self._execute_notify_team(action)
            elif action_type == ActionType.RUN_TESTS.value:
                return self._execute_run_tests(action)
            elif action_type == ActionType.SUGGEST_REVIEW.value:
                return self._execute_suggest_review(action)
            else:
                return {
                    "status": "failed",
                    "error": f"Unknown action type: {action_type}"
                }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def _execute_auto_fix(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute auto-fix action"""
        # In production, this would apply actual fixes
        return {
            "status": "completed",
            "message": "Auto-fix applied successfully",
            "fixed_issues": action.get("context", {}).get("count", 0),
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _execute_generate_tests(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute test generation action"""
        return {
            "status": "completed",
            "message": "Tests generated successfully",
            "tests_created": 3,  # Mock
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _execute_block_deployment(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute deployment blocking action"""
        return {
            "status": "completed",
            "message": "Deployment blocked due to critical issues",
            "blocked": True,
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _execute_notify_team(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute team notification action"""
        return {
            "status": "completed",
            "message": "Team notified successfully",
            "notified": True,
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _execute_run_tests(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute test running action"""
        return {
            "status": "completed",
            "message": "Tests executed successfully",
            "tests_passed": 10,  # Mock
            "tests_failed": 0,
            "executed_at": datetime.utcnow().isoformat()
        }
    
    def _execute_suggest_review(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute review suggestion action"""
        return {
            "status": "completed",
            "message": "Review suggested to team",
            "suggested": True,
            "executed_at": datetime.utcnow().isoformat()
        }

