"""
Autonomous AI Agent Core
Handles code analysis, issue detection, and intelligent suggestions
"""

import ast
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    anthropic = None

from app.core.config import settings


class IssueType(Enum):
    """Issue type enumeration"""
    BUG = "bug"
    SECURITY = "security"
    PERFORMANCE = "performance"
    STYLE = "style"
    BEST_PRACTICE = "best_practice"


class Severity(Enum):
    """Severity level enumeration"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class CodeIssue:
    """Represents a code issue"""
    issue_type: IssueType
    severity: Severity
    line_number: int
    message: str
    suggestion: str
    code_snippet: Optional[str] = None


class CodeMindAgent:
    """Autonomous AI Agent for code analysis"""
    
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        self.preferred_provider = settings.PREFERRED_AI_PROVIDER.lower()
        
        # Initialize OpenAI client (only if API key is provided and not empty)
        if OPENAI_AVAILABLE and settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip() and OpenAI:
            try:
                self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {str(e)}")
                self.openai_client = None
        
        # Initialize Anthropic client (only if API key is provided and not empty)
        if ANTHROPIC_AVAILABLE and settings.ANTHROPIC_API_KEY and settings.ANTHROPIC_API_KEY.strip() and anthropic:
            try:
                self.anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize Anthropic client: {str(e)}")
                self.anthropic_client = None
    
    def analyze_code(self, code: str, language: str = "python", ai_model: Optional[str] = None, ai_provider: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze code and return comprehensive results
        
        Args:
            code: Source code to analyze
            language: Programming language
            
        Returns:
            Dictionary with analysis results
        """
        issues = []
        
        # Language-specific analysis
        if language.lower() == "python":
            issues.extend(self._analyze_python(code))
        else:
            issues.extend(self._analyze_generic(code, language))
        
        # AI-powered analysis
        ai_issues = self._ai_analyze(code, language, ai_model, ai_provider)
        issues.extend(ai_issues)
        
        # Calculate quality score
        quality_score = self._calculate_quality_score(issues)
        
        return {
            "issues": [self._issue_to_dict(issue) for issue in issues],
            "quality_score": quality_score,
            "total_issues": len(issues),
            "issues_by_type": self._group_issues_by_type(issues),
            "issues_by_severity": self._group_issues_by_severity(issues)
        }
    
    def _analyze_python(self, code: str) -> List[CodeIssue]:
        """Python-specific code analysis"""
        issues = []
        
        try:
            tree = ast.parse(code)
            
            # Check for common issues
            for node in ast.walk(tree):
                # Check for bare except
                if isinstance(node, ast.ExceptHandler) and node.type is None:
                    issues.append(CodeIssue(
                        issue_type=IssueType.BUG,
                        severity=Severity.HIGH,
                        line_number=node.lineno,
                        message="Bare except clause catches all exceptions, including system exits",
                        suggestion="Specify exception types: except ValueError as e:"
                    ))
                
                # Check for unused variables (future enhancement)
                # if isinstance(node, ast.Assign):
                #     for target in node.targets:
                #         if isinstance(target, ast.Name):
                #             # Check if variable is used elsewhere
                #             pass
                
                # Check for hardcoded values
                if isinstance(node, ast.Constant):
                    if isinstance(node.value, str) and len(node.value) > 50:
                        issues.append(CodeIssue(
                            issue_type=IssueType.STYLE,
                            severity=Severity.LOW,
                            line_number=node.lineno,
                            message="Consider extracting long string to a constant",
                            suggestion="Define as a module-level constant"
                        ))
        
        except SyntaxError as e:
            issues.append(CodeIssue(
                issue_type=IssueType.BUG,
                severity=Severity.CRITICAL,
                line_number=e.lineno or 0,
                message=f"Syntax error: {e.msg}",
                suggestion="Fix syntax error"
            ))
        
        # Security checks
        security_patterns = [
            (r'eval\s*\(', "Use of eval() is dangerous", IssueType.SECURITY, Severity.CRITICAL),
            (r'exec\s*\(', "Use of exec() is dangerous", IssueType.SECURITY, Severity.CRITICAL),
            (r'__import__\s*\(', "Use of __import__() is dangerous", IssueType.SECURITY, Severity.HIGH),
            (r'password\s*=\s*["\']', "Hardcoded password detected", IssueType.SECURITY, Severity.CRITICAL),
            (r'api_key\s*=\s*["\']', "Hardcoded API key detected", IssueType.SECURITY, Severity.CRITICAL),
        ]
        
        for line_num, line in enumerate(code.split('\n'), 1):
            for pattern, message, issue_type, severity in security_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append(CodeIssue(
                        issue_type=issue_type,
                        severity=severity,
                        line_number=line_num,
                        message=message,
                        suggestion="Use environment variables or secure configuration management"
                    ))
        
        # Performance checks
        perf_patterns = [
            (r'\.append\s*\([^)]*\)\s*$', "Consider list comprehension for better performance", IssueType.PERFORMANCE, Severity.LOW),
        ]
        
        for line_num, line in enumerate(code.split('\n'), 1):
            for pattern, message, issue_type, severity in perf_patterns:
                if re.search(pattern, line):
                    issues.append(CodeIssue(
                        issue_type=issue_type,
                        severity=severity,
                        line_number=line_num,
                        message=message,
                        suggestion="Use list comprehension: [x for x in iterable]"
                    ))
        
        return issues
    
    def _analyze_generic(self, code: str, language: str) -> List[CodeIssue]:
        """Generic code analysis for non-Python languages"""
        issues = []
        
        # Common security patterns
        security_patterns = [
            (r'password\s*=\s*["\']', "Hardcoded password detected", IssueType.SECURITY, Severity.CRITICAL),
            (r'api_key\s*=\s*["\']', "Hardcoded API key detected", IssueType.SECURITY, Severity.CRITICAL),
            (r'apiKey\s*=\s*["\']', "Hardcoded API key detected", IssueType.SECURITY, Severity.CRITICAL),
            (r'secret\s*=\s*["\']', "Hardcoded secret detected", IssueType.SECURITY, Severity.CRITICAL),
        ]
        
        # Java-specific patterns
        if language.lower() == "java":
            java_security_patterns = [
                (r'String\s+\w*[Pp]assword\s*=\s*["\']', "Hardcoded password detected", IssueType.SECURITY, Severity.CRITICAL),
                (r'String\s+\w*[Aa]pi[Kk]ey\s*=\s*["\']', "Hardcoded API key detected", IssueType.SECURITY, Severity.CRITICAL),
                (r'System\.getProperty\s*\([^)]*\)\s*==\s*null', "Potential null pointer exception", IssueType.BUG, Severity.HIGH),
                (r'\.equals\s*\([^)]*\)\s*==\s*true', "Redundant boolean comparison", IssueType.STYLE, Severity.LOW),
            ]
            security_patterns.extend(java_security_patterns)
            
            # Java-specific best practices
            for line_num, line in enumerate(code.split('\n'), 1):
                # Check for missing null checks
                if re.search(r'\.\w+\s*\([^)]*\)', line) and 'if' not in line.lower() and 'null' not in line.lower():
                    if re.search(r'String\s+\w+\s*=\s*\w+\.', line):
                        issues.append(CodeIssue(
                            issue_type=IssueType.BEST_PRACTICE,
                            severity=Severity.MEDIUM,
                            line_number=line_num,
                            message="Consider null check before method call",
                            suggestion="Add null check: if (obj != null) { ... }"
                        ))
                
                # Check for raw types
                if re.search(r'List\s+\w+\s*=', line) and '<' not in line:
                    issues.append(CodeIssue(
                        issue_type=IssueType.BEST_PRACTICE,
                        severity=Severity.LOW,
                        line_number=line_num,
                        message="Using raw type instead of generic",
                        suggestion="Use generic type: List<String> list = new ArrayList<>();"
                    ))
        
        for line_num, line in enumerate(code.split('\n'), 1):
            for pattern, message, issue_type, severity in security_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append(CodeIssue(
                        issue_type=issue_type,
                        severity=severity,
                        line_number=line_num,
                        message=message,
                        suggestion="Use environment variables or secure configuration"
                    ))
        
        return issues
    
    def _ai_analyze(self, code: str, language: str, model: Optional[str] = None, provider: Optional[str] = None) -> List[CodeIssue]:
        """AI-powered code analysis using best available model"""
        issues = []
        
        # Use specified model/provider if provided
        if model and provider:
            if provider.lower() == "openai" and self.openai_client:
                try:
                    return self._analyze_with_openai(code, language, model)
                except:
                    pass
            elif provider.lower() == "anthropic" and self.anthropic_client:
                try:
                    return self._analyze_with_claude(code, language, model)
                except:
                    pass
        
        # Try preferred provider first, then fallback
        if self.preferred_provider == "anthropic" and self.anthropic_client:
            try:
                return self._analyze_with_claude(code, language, model)
            except:
                if self.openai_client:
                    try:
                        return self._analyze_with_openai(code, language, model)
                    except:
                        pass
        
        elif self.openai_client:
            try:
                return self._analyze_with_openai(code, language, model)
            except:
                if self.anthropic_client:
                    try:
                        return self._analyze_with_claude(code, language, model)
                    except:
                        pass
        
        # Fallback to mock if all AI fails
        return self._mock_ai_analysis(code, language)
    
    def _analyze_with_openai(self, code: str, language: str, model: Optional[str] = None) -> List[CodeIssue]:
        """Analyze code using OpenAI (GPT-4o/GPT-4 Turbo)"""
        issues = []
        
        prompt = f"""Analyze the following {language} code and identify issues. Return a structured response with:
1. Potential bugs (with line numbers if possible)
2. Security vulnerabilities
3. Performance issues
4. Code style improvements
5. Best practice violations

For each issue, provide:
- Type (bug/security/performance/style/best_practice)
- Severity (critical/high/medium/low)
- Line number (if applicable)
- Message (brief description)
- Suggestion (specific fix recommendation)

Code:
```{language}
{code}
```

Provide specific, actionable suggestions in a clear format."""

        response = self.openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert code reviewer and security analyst. Analyze code thoroughly and provide specific, actionable feedback."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,  # Lower temperature for more consistent analysis
            max_tokens=2000
        )
        
        ai_text = response.choices[0].message.content
        
        # Enhanced parsing of AI response
        issues.extend(self._parse_ai_response(ai_text, code))
        
        return issues if issues else self._mock_ai_analysis(code, language)
    
    def _analyze_with_claude(self, code: str, language: str, model: Optional[str] = None) -> List[CodeIssue]:
        """Analyze code using Anthropic Claude (Claude 3.5 Sonnet)"""
        issues = []
        
        prompt = f"""Analyze the following {language} code and identify issues. Return a structured response with:
1. Potential bugs (with line numbers if possible)
2. Security vulnerabilities
3. Performance issues
4. Code style improvements
5. Best practice violations

For each issue, provide:
- Type (bug/security/performance/style/best_practice)
- Severity (critical/high/medium/low)
- Line number (if applicable)
- Message (brief description)
- Suggestion (specific fix recommendation)

Code:
```{language}
{code}
```

Provide specific, actionable suggestions in a clear format."""

        message = self.anthropic_client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2000,
            temperature=0.2,
            system="You are an expert code reviewer and security analyst. Analyze code thoroughly and provide specific, actionable feedback.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        ai_text = message.content[0].text
        
        # Enhanced parsing of AI response
        issues.extend(self._parse_ai_response(ai_text, code))
        
        return issues if issues else self._mock_ai_analysis(code, language)
    
    def _parse_ai_response(self, ai_text: str, code: str) -> List[CodeIssue]:
        """Parse AI response to extract structured issues"""
        issues = []
        lines = code.split('\n')
        
        # Look for security issues
        if any(keyword in ai_text.lower() for keyword in ['security', 'vulnerability', 'vulnerable', 'insecure', 'hardcoded', 'secret', 'password', 'api key']):
            # Try to extract line number
            line_num = 1
            for i, line in enumerate(lines, 1):
                if any(keyword in line.lower() for keyword in ['password', 'secret', 'api_key', 'apiKey', 'token']):
                    line_num = i
                    break
            
            issues.append(CodeIssue(
                issue_type=IssueType.SECURITY,
                severity=Severity.HIGH,
                line_number=line_num,
                message="AI detected security vulnerability",
                suggestion=ai_text[:300] if len(ai_text) > 300 else ai_text
            ))
        
        # Look for bugs
        if any(keyword in ai_text.lower() for keyword in ['bug', 'error', 'incorrect', 'wrong', 'issue', 'problem']):
            issues.append(CodeIssue(
                issue_type=IssueType.BUG,
                severity=Severity.MEDIUM,
                line_number=1,
                message="AI detected potential bug",
                suggestion=ai_text[:300] if len(ai_text) > 300 else ai_text
            ))
        
        # Look for performance issues
        if any(keyword in ai_text.lower() for keyword in ['performance', 'slow', 'inefficient', 'optimization', 'bottleneck']):
            issues.append(CodeIssue(
                issue_type=IssueType.PERFORMANCE,
                severity=Severity.MEDIUM,
                line_number=1,
                message="AI detected performance concern",
                suggestion=ai_text[:300] if len(ai_text) > 300 else ai_text
            ))
        
        # Look for best practices
        if any(keyword in ai_text.lower() for keyword in ['best practice', 'improvement', 'refactor', 'better', 'consider']):
            issues.append(CodeIssue(
                issue_type=IssueType.BEST_PRACTICE,
                severity=Severity.LOW,
                line_number=1,
                message="AI suggests code improvement",
                suggestion=ai_text[:300] if len(ai_text) > 300 else ai_text
            ))
        
        return issues
    
    def _mock_ai_analysis(self, code: str, language: str) -> List[CodeIssue]:
        """Mock AI analysis for demo purposes"""
        issues = []
        
        # Simulate AI finding issues
        if len(code) > 500:
            issues.append(CodeIssue(
                issue_type=IssueType.BEST_PRACTICE,
                severity=Severity.LOW,
                line_number=1,
                message="Consider breaking this into smaller functions",
                suggestion="Functions should ideally be under 50 lines for better maintainability"
            ))
        
        if "TODO" in code or "FIXME" in code:
            issues.append(CodeIssue(
                issue_type=IssueType.BEST_PRACTICE,
                severity=Severity.LOW,
                line_number=1,
                message="TODO/FIXME comments found",
                suggestion="Address pending tasks or remove outdated comments"
            ))
        
        return issues
    
    def _calculate_quality_score(self, issues: List[CodeIssue]) -> float:
        """Calculate code quality score (0-100)"""
        if not issues:
            return 100.0
        
        severity_weights = {
            Severity.CRITICAL: 20,
            Severity.HIGH: 10,
            Severity.MEDIUM: 5,
            Severity.LOW: 1
        }
        
        total_penalty = sum(severity_weights.get(issue.severity, 0) for issue in issues)
        score = max(0, 100 - total_penalty)
        
        return round(score, 2)
    
    def _group_issues_by_type(self, issues: List[CodeIssue]) -> Dict[str, int]:
        """Group issues by type"""
        grouped = {}
        for issue in issues:
            issue_type = issue.issue_type.value
            grouped[issue_type] = grouped.get(issue_type, 0) + 1
        return grouped
    
    def _group_issues_by_severity(self, issues: List[CodeIssue]) -> Dict[str, int]:
        """Group issues by severity"""
        grouped = {}
        for issue in issues:
            severity = issue.severity.value
            grouped[severity] = grouped.get(severity, 0) + 1
        return grouped
    
    def _issue_to_dict(self, issue: CodeIssue) -> Dict[str, Any]:
        """Convert CodeIssue to dictionary"""
        return {
            "issue_type": issue.issue_type.value,
            "severity": issue.severity.value,
            "line_number": issue.line_number,
            "message": issue.message,
            "suggestion": issue.suggestion,
            "code_snippet": issue.code_snippet
        }
    
    def suggest_fix(self, code: str, issue: CodeIssue, language: str = "python") -> str:
        """Generate a suggested fix for an issue"""
        # Try preferred provider first
        if self.preferred_provider == "anthropic" and self.anthropic_client:
            try:
                return self._suggest_fix_with_claude(code, issue, language)
            except:
                if self.openai_client:
                    try:
                        return self._suggest_fix_with_openai(code, issue, language)
                    except:
                        pass
        elif self.openai_client:
            try:
                return self._suggest_fix_with_openai(code, issue, language)
            except:
                if self.anthropic_client:
                    try:
                        return self._suggest_fix_with_claude(code, issue, language)
                    except:
                        pass
        
        # Fallback
        return f"# Fixed: {issue.suggestion}\n{code}"
    
    def _suggest_fix_with_openai(self, code: str, issue: CodeIssue, language: str) -> str:
        """Get fix suggestion using OpenAI"""
        prompt = f"""Given this {language} code and issue, provide a fixed version:

Original Code:
```{language}
{code}
```

Issue: {issue.message}
Line: {issue.line_number}
Suggestion: {issue.suggestion}

Provide the fixed code with explanation:"""

        response = self.openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert code fixer. Provide clean, correct, production-ready code."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        return response.choices[0].message.content
    
    def _suggest_fix_with_claude(self, code: str, issue: CodeIssue, language: str) -> str:
        """Get fix suggestion using Claude"""
        prompt = f"""Given this {language} code and issue, provide a fixed version:

Original Code:
```{language}
{code}
```

Issue: {issue.message}
Line: {issue.line_number}
Suggestion: {issue.suggestion}

Provide the fixed code with explanation:"""

        message = self.anthropic_client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2000,
            temperature=0.2,
            system="You are an expert code fixer. Provide clean, correct, production-ready code.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return message.content[0].text
        
        # Fallback to simple suggestions
        return f"# Fixed: {issue.suggestion}\n{code}"

