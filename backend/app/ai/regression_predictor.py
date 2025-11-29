"""
Regression Prediction Module
Predicts potential regressions using ML and pattern analysis
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta


class RegressionPredictor:
    """ML-based regression prediction system"""
    
    def __init__(self):
        self.pattern_weights = {
            "recent_changes": 0.3,
            "similar_issues": 0.25,
            "complexity": 0.2,
            "test_coverage": 0.15,
            "dependencies": 0.1
        }
    
    def predict_regression(
        self,
        code: str,
        file_path: str,
        change_history: Optional[List[Dict[str, Any]]] = None,
        previous_issues: Optional[List[Dict[str, Any]]] = None,
        test_coverage: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Predict regression risk for code
        
        Args:
            code: Source code to analyze
            file_path: Path to the file
            change_history: History of changes to this file
            previous_issues: Previous issues found in this file
            test_coverage: Current test coverage percentage
            
        Returns:
            Dictionary with prediction results
        """
        risk_factors = self._analyze_risk_factors(
            code, file_path, change_history, previous_issues, test_coverage
        )
        
        risk_score = self._calculate_risk_score(risk_factors)
        confidence = self._calculate_confidence(risk_factors)
        
        predicted_issues = self._predict_specific_issues(code, risk_factors)
        
        return {
            "risk_score": risk_score,
            "confidence": confidence,
            "risk_level": self._get_risk_level(risk_score),
            "predicted_issues": predicted_issues,
            "risk_factors": risk_factors,
            "recommendations": self._generate_recommendations(risk_factors, risk_score)
        }
    
    def _analyze_risk_factors(
        self,
        code: str,
        file_path: str,
        change_history: Optional[List[Dict[str, Any]]],
        previous_issues: Optional[List[Dict[str, Any]]],
        test_coverage: Optional[float]
    ) -> Dict[str, Any]:
        """Analyze various risk factors"""
        factors = {}
        
        # Recent changes factor
        if change_history:
            recent_changes = [c for c in change_history 
                            if datetime.fromisoformat(c.get('date', '')) > datetime.now() - timedelta(days=7)]
            factors["recent_changes"] = min(1.0, len(recent_changes) / 5.0)
        else:
            factors["recent_changes"] = 0.3  # Default moderate risk
        
        # Similar issues factor
        if previous_issues:
            similar_issues = len([i for i in previous_issues if i.get('severity') in ['critical', 'high']])
            factors["similar_issues"] = min(1.0, similar_issues / 3.0)
        else:
            factors["similar_issues"] = 0.0
        
        # Complexity factor
        complexity = self._calculate_complexity(code)
        factors["complexity"] = min(1.0, complexity / 50.0)  # Normalize to 0-1
        
        # Test coverage factor
        if test_coverage is not None:
            factors["test_coverage"] = max(0.0, (100 - test_coverage) / 100.0)
        else:
            factors["test_coverage"] = 0.5  # Unknown coverage = moderate risk
        
        # Dependencies factor
        dependencies = self._count_dependencies(code)
        factors["dependencies"] = min(1.0, dependencies / 10.0)
        
        return factors
    
    def _calculate_complexity(self, code: str) -> float:
        """Calculate code complexity"""
        lines = code.split('\n')
        complexity = 0
        
        # Count control structures
        complexity += code.count('if ') * 2
        complexity += code.count('for ') * 2
        complexity += code.count('while ') * 2
        complexity += code.count('try:') * 1.5
        complexity += code.count('except') * 1.5
        complexity += code.count('def ') * 1
        complexity += code.count('class ') * 2
        
        # Nesting depth (simplified)
        max_indent = 0
        for line in lines:
            if line.strip():
                indent = len(line) - len(line.lstrip())
                max_indent = max(max_indent, indent)
        
        complexity += max_indent / 4  # Add nesting complexity
        
        return complexity
    
    def _count_dependencies(self, code: str) -> int:
        """Count external dependencies"""
        imports = 0
        imports += code.count('import ')
        imports += code.count('from ')
        imports += code.count('require(')
        imports += code.count('import(')
        return imports
    
    def _calculate_risk_score(self, factors: Dict[str, float]) -> float:
        """Calculate overall risk score (0.0 to 1.0)"""
        score = 0.0
        for factor, weight in self.pattern_weights.items():
            if factor in factors:
                score += factors[factor] * weight
        return min(1.0, max(0.0, score))
    
    def _calculate_confidence(self, factors: Dict[str, float]) -> float:
        """Calculate prediction confidence"""
        # More data = higher confidence
        data_points = sum(1 for v in factors.values() if v > 0)
        confidence = min(1.0, data_points / len(factors))
        return round(confidence, 2)
    
    def _get_risk_level(self, risk_score: float) -> str:
        """Get human-readable risk level"""
        if risk_score >= 0.7:
            return "critical"
        elif risk_score >= 0.5:
            return "high"
        elif risk_score >= 0.3:
            return "medium"
        else:
            return "low"
    
    def _predict_specific_issues(
        self,
        code: str,
        risk_factors: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Predict specific types of issues"""
        predicted = []
        
        # High complexity -> potential bugs
        if risk_factors.get("complexity", 0) > 0.6:
            predicted.append({
                "type": "complexity_bug",
                "message": "High complexity increases risk of logic errors",
                "severity": "medium"
            })
        
        # Low test coverage -> regression risk
        if risk_factors.get("test_coverage", 0) > 0.5:
            predicted.append({
                "type": "regression_risk",
                "message": "Low test coverage increases regression risk",
                "severity": "high"
            })
        
        # Recent changes + similar issues -> regression
        if risk_factors.get("recent_changes", 0) > 0.5 and risk_factors.get("similar_issues", 0) > 0.3:
            predicted.append({
                "type": "regression",
                "message": "Recent changes in area with previous issues",
                "severity": "high"
            })
        
        # Many dependencies -> integration issues
        if risk_factors.get("dependencies", 0) > 0.7:
            predicted.append({
                "type": "integration_risk",
                "message": "High dependency count increases integration risk",
                "severity": "medium"
            })
        
        return predicted
    
    def _generate_recommendations(
        self,
        risk_factors: Dict[str, float],
        risk_score: float
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if risk_score > 0.7:
            recommendations.append("🚨 High regression risk detected. Consider additional review before merging.")
        
        if risk_factors.get("test_coverage", 0) > 0.5:
            recommendations.append("📝 Increase test coverage to reduce regression risk")
        
        if risk_factors.get("complexity", 0) > 0.6:
            recommendations.append("🔧 Refactor to reduce complexity and improve maintainability")
        
        if risk_factors.get("similar_issues", 0) > 0.3:
            recommendations.append("🔍 Review similar previous issues to prevent recurrence")
        
        if risk_factors.get("dependencies", 0) > 0.7:
            recommendations.append("📦 Review dependencies for potential integration issues")
        
        if not recommendations:
            recommendations.append("✅ Code looks good! Continue monitoring for changes.")
        
        return recommendations

