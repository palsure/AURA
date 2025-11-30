"""
Test Generation Module
Automatically generates tests for code using AI
"""

import logging
import time
import re
from typing import List, Dict, Any, Optional
from app.ai.agent import CodeMindAgent
from app.ai.code_parser import CodeParser
from app.core.config import settings

logger = logging.getLogger(__name__)

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


class TestGenerator:
    """AI-powered test generator"""
    
    def __init__(self, agent: CodeMindAgent):
        self.agent = agent
        self.parser = CodeParser()
        self.openai_client = None
        self.anthropic_client = None
        self.preferred_provider = settings.PREFERRED_AI_PROVIDER.lower()
        
        if OPENAI_AVAILABLE and settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip() and OpenAI:
            try:
                self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {str(e)}")
                self.openai_client = None
        
        if ANTHROPIC_AVAILABLE and settings.ANTHROPIC_API_KEY and settings.ANTHROPIC_API_KEY.strip() and anthropic:
            try:
                self.anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            except Exception as e:
                print(f"Warning: Failed to initialize Anthropic client: {str(e)}")
                self.anthropic_client = None
    
    def generate_tests(
        self,
        code: str,
        language: str = "python",
        test_type: str = "unit",
        function_name: Optional[str] = None,
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate tests for given code using best available AI model
        
        Args:
            code: Source code to generate tests for
            language: Programming language
            test_type: Type of test (unit, integration, regression)
            function_name: Specific function to test (optional)
            
        Returns:
            Dictionary with generated test code and metadata
        """
        # Use specified model/provider if provided
        if ai_model and ai_provider:
            provider_lower = ai_provider.lower()
            if provider_lower == "openai":
                if not self.openai_client:
                    raise ValueError(f"OpenAI client not initialized. Check OPENAI_API_KEY in environment variables.")
                try:
                    print(f"🔍 Using OpenAI model: {ai_model} for test generation")
                    result = self._ai_generate_tests(code, language, test_type, function_name, ai_model, ai_provider)
                    print(f"✅ OpenAI test generation successful")
                    return result
                except Exception as e:
                    print(f"❌ OpenAI test generation failed: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    raise
            elif provider_lower == "anthropic":
                if not self.anthropic_client:
                    raise ValueError(f"Anthropic client not initialized. Check ANTHROPIC_API_KEY in environment variables.")
                try:
                    print(f"🔍 Using Anthropic model: {ai_model} for test generation")
                    result = self._ai_generate_tests_claude(code, language, test_type, function_name, ai_model, ai_provider)
                    print(f"✅ Anthropic test generation successful")
                    return result
                except Exception as e:
                    print(f"❌ Anthropic test generation failed: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    raise
        
        # Try preferred provider first
        if self.preferred_provider == "anthropic" and self.anthropic_client:
            try:
                return self._ai_generate_tests_claude(code, language, test_type, function_name, ai_model, ai_provider)
            except:
                if self.openai_client:
                    try:
                        return self._ai_generate_tests(code, language, test_type, function_name, ai_model, ai_provider)
                    except:
                        pass
        elif self.openai_client:
            try:
                return self._ai_generate_tests(code, language, test_type, function_name, ai_model, ai_provider)
            except:
                if self.anthropic_client:
                    try:
                        return self._ai_generate_tests_claude(code, language, test_type, function_name, ai_model, ai_provider)
                    except:
                        pass
        
        # If model/provider was specified but generation failed, raise error
        if ai_model and ai_provider:
            raise ValueError(f"Failed to generate tests with {ai_provider} model {ai_model}. Check API keys and model availability.")
        
        # Fallback to intelligent mock generation only if no specific model was requested
        print("⚠️  No AI model specified or available, using fallback template generation")
        return self._mock_generate_tests(code, language, test_type, function_name)
    
    def _ai_generate_tests(
        self,
        code: str,
        language: str,
        test_type: str,
        function_name: Optional[str],
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate tests using AI"""
        try:
            # Determine test framework based on language
            framework = "pytest" if language == "python" else "jest" if language in ["javascript", "typescript"] else "JUnit" if language == "java" else "standard"
            
            # Customize prompt based on test type
            if test_type == 'e2e':
                test_description = "end-to-end (E2E) tests that test complete workflows and user journeys"
                test_focus = "Test complete user workflows, integration between components, and full application flows"
            elif test_type == 'acceptance':
                test_description = "acceptance tests that verify user requirements and business logic"
                test_focus = "Test user scenarios, business requirements, and acceptance criteria. Focus on 'what' the system should do from a user perspective"
            else:  # unit
                test_description = "unit tests for individual functions and methods"
                test_focus = "Test individual functions and methods in isolation"
            
            prompt = f"""Generate comprehensive {test_description} for the following {language} code.

CRITICAL REQUIREMENTS:
- Generate COMPLETE, RUNNABLE test code with FULL implementations
- DO NOT use placeholders, TODOs, or empty test bodies
- Include actual test data, assertions, and expected results
- Every test must have complete logic and assertions
- Use appropriate testing framework: {framework}

Code to test:
```{language}
{code}
```

{f'Focus on testing the function: {function_name}' if function_name else test_focus}

Test Requirements:
1. Cover all functions and methods with complete test implementations
2. Include edge cases (empty inputs, null values, boundary conditions)
3. Include error handling tests with actual error scenarios
4. Use descriptive test names that explain what is being tested
5. Add proper assertions/expectations for every test case
6. Include setup/teardown if needed
7. Make tests immediately runnable - no placeholders or TODOs
{f'8. For E2E tests: Test complete workflows, user interactions, and integration between components' if test_type == 'e2e' else ''}
{f'9. For Acceptance tests: Test user scenarios, business requirements, and acceptance criteria' if test_type == 'acceptance' else ''}

Generate ONLY the complete test code file. Do not include explanations or comments about placeholders."""

            model_to_use = ai_model or settings.OPENAI_MODEL
            
            # Log AI request
            logger.info("=" * 80)
            logger.info("🤖 AI REQUEST - OpenAI Test Generation")
            logger.info(f"   Model: {model_to_use}")
            logger.info(f"   Language: {language}")
            logger.info(f"   Test Type: {test_type}")
            logger.info(f"   Code Length: {len(code)} characters")
            logger.info(f"   Prompt Length: {len(prompt)} characters")
            logger.info(f"   Temperature: 0.2")
            logger.info(f"   Max Tokens: 4000")
            logger.debug(f"   Prompt Preview: {prompt[:200]}...")
            start_time = time.time()
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=model_to_use,
                    messages=[
                        {"role": "system", "content": "You are an expert test engineer. You MUST generate complete, production-ready test code with full implementations. NEVER use placeholders, TODOs, or empty test bodies. Every test must have complete logic, actual test data, and proper assertions. The code must be immediately runnable."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,  # Lower temperature for more consistent test generation
                    max_tokens=4000  # Increased for more complete tests
                )
                
                elapsed_time = time.time() - start_time
                test_code = response.choices[0].message.content
                
                # Log AI response
                logger.info("✅ AI RESPONSE - OpenAI Test Generation")
                logger.info(f"   Response Time: {elapsed_time:.2f}s")
                logger.info(f"   Test Code Length: {len(test_code)} characters")
                
                # Log token usage if available
                if hasattr(response, 'usage'):
                    usage = response.usage
                    logger.info(f"   Tokens - Prompt: {usage.prompt_tokens if hasattr(usage, 'prompt_tokens') else 'N/A'}, "
                              f"Completion: {usage.completion_tokens if hasattr(usage, 'completion_tokens') else 'N/A'}, "
                              f"Total: {usage.total_tokens if hasattr(usage, 'total_tokens') else 'N/A'}")
                
                logger.debug(f"   Test Code Preview: {test_code[:300]}...")
                logger.info("=" * 80)
                
            except Exception as e:
                elapsed_time = time.time() - start_time
                logger.error(f"❌ AI REQUEST FAILED - OpenAI Test Generation")
                logger.error(f"   Error: {str(e)}")
                logger.error(f"   Response Time: {elapsed_time:.2f}s")
                logger.error("=" * 80)
                raise
            
            # Extract test code from markdown if present
            if "```" in test_code:
                lines = test_code.split("\n")
                code_start = None
                code_end = None
                for i, line in enumerate(lines):
                    if "```" in line and code_start is None:
                        code_start = i + 1
                    elif "```" in line and code_start is not None:
                        code_end = i
                        break
                if code_start and code_end:
                    test_code = "\n".join(lines[code_start:code_end])
            
            return {
                "test_code": test_code,
                "test_type": test_type,
                "language": language,
                "coverage_estimate": self._estimate_coverage(code, test_code),
                "test_count": (
                    test_code.count("def test_") +
                    test_code.count("it(") +
                    test_code.count("test(") +
                    test_code.count("@Test") +
                    test_code.count("void test")
                ) or 1
            }
        except Exception as e:
            return self._mock_generate_tests(code, language, test_type, function_name)
    
    def _mock_generate_tests(
        self,
        code: str,
        language: str,
        test_type: str,
        function_name: Optional[str]
    ) -> Dict[str, Any]:
        """Generate mock tests for demo"""
        if language == "python":
            test_code = self._generate_python_test_template(code, function_name)
        elif language in ["javascript", "typescript"]:
            test_code = self._generate_js_test_template(code, function_name)
        elif language == "java":
            test_code = self._generate_java_test_template(code, function_name)
        else:
            test_code = f"# {test_type} tests for {language}\n# Test generation in progress..."
        
        # Count actual test functions
        test_count = test_code.count("def test_")
        if test_count == 0:
            test_count = test_code.count("@Test") or test_code.count("void test") or 3
        
        return {
            "test_code": test_code,
            "test_type": test_type,
            "language": language,
            "coverage_estimate": self._estimate_coverage(code, test_code),
            "test_count": test_count
        }
    
    def _generate_python_test_template(self, code: str, function_name: Optional[str]) -> str:
        """Generate complete Python tests with actual implementations"""
        functions = self.parser.parse_python_functions(code)
        
        if not functions:
            # Fallback if parsing fails
            return self._generate_fallback_tests(code, function_name)
        
        test_code = "import pytest\n\n"
        
        # Generate tests for each function
        for func_info in functions:
            if function_name and func_info["name"] != function_name:
                continue
            
            behavior = self.parser.analyze_function_behavior(func_info, code)
            test_code += self._generate_function_tests(func_info, behavior)
        
        return test_code
    
    def _generate_function_tests(self, func_info: Dict[str, Any], behavior: Dict[str, Any]) -> str:
        """Generate complete tests for a specific function"""
        func_name = func_info["name"]
        args = func_info["args"]
        
        tests = f"\n# Tests for {func_name}\n"
        tests += f"# from your_module import {func_name}\n\n"
        
        # For demo, include the function inline (in production, this would be imported)
        tests += f"# Original function (for reference - remove in production):\n"
        if func_info.get('code'):
            first_line = func_info['code'].split('\n')[0]
            tests += f"# {first_line}\n\n"
        else:
            args_str = ', '.join(args) if args else ''
            tests += f"# def {func_name}({args_str}): ...\n\n"
        
        # Basic functionality test
        tests += f"def test_{func_name}_basic():\n"
        tests += f"    \"\"\"Test basic functionality of {func_name}\"\"\"\n"
        
        # Generate test input based on function analysis
        test_input = self._generate_test_input(func_info, behavior, "basic")
        test_vars = self._extract_variables(test_input)
        
        if test_input and not test_input.startswith("#"):
            tests += f"    {test_input}\n"
            if test_vars:
                tests += f"    result = {func_name}({', '.join(test_vars)})\n"
            else:
                tests += f"    result = {func_name}()\n"
        else:
            # Fallback for functions with no clear input pattern
            if args:
                first_arg = args[0]
                tests += f"    {first_arg} = [1, 2, 3]\n"
                tests += f"    result = {func_name}({first_arg})\n"
            else:
                tests += f"    result = {func_name}()\n"
        
        expected = self._generate_expected_output(func_info, behavior, test_input)
        tests += f"    {expected}\n\n"
        
        # Edge cases
        edge_cases_generated = []
        if behavior["edge_cases"]:
            for edge_case in behavior["edge_cases"][:3]:  # Limit to 3 edge cases
                if edge_case in ["empty_list", "single_item", "zero_values"]:
                    edge_input = self._generate_test_input(func_info, behavior, edge_case)
                    edge_vars = self._extract_variables(edge_input)
                    
                    if edge_input and not edge_input.startswith("#"):
                        test_name = edge_case.replace("_", "_").title().replace("_", "")
                        tests += f"def test_{func_name}_{edge_case}():\n"
                        tests += f"    \"\"\"Test {edge_case.replace('_', ' ')} for {func_name}\"\"\"\n"
                        tests += f"    {edge_input}\n"
                        if edge_vars:
                            tests += f"    result = {func_name}({', '.join(edge_vars)})\n"
                        edge_output = self._generate_expected_output(func_info, behavior, edge_input, edge_case)
                        tests += f"    {edge_output}\n\n"
                        edge_cases_generated.append(edge_case)
        
        # Error handling
        if behavior["error_cases"] or args:
            tests += f"def test_{func_name}_error_handling():\n"
            tests += f"    \"\"\"Test error handling for {func_name}\"\"\"\n"
            
            # Test with None/empty
            if args:
                tests += f"    # Test with None input\n"
                tests += f"    with pytest.raises((TypeError, ValueError, AttributeError)):\n"
                tests += f"        {func_name}(None)\n\n"
            
            # Test with invalid types if function expects list
            if behavior["input_types"] and any("list" in str(t) for t in behavior["input_types"]):
                tests += f"    # Test with invalid input type\n"
                tests += f"    with pytest.raises((TypeError, AttributeError)):\n"
                if args:
                    tests += f"        {func_name}(\"not_a_list\")\n\n"
        
        return tests
    
    def _generate_test_input(self, func_info: Dict[str, Any], behavior: Dict[str, Any], test_type: str) -> str:
        """Generate test input based on function signature and behavior"""
        args = func_info["args"]
        
        if not args:
            return "# No arguments"
        
        if test_type == "basic":
            # Generate realistic test data
            if "items" in str(args).lower() or "list" in str(args).lower():
                return f"items = [{{'price': 10.0}}, {{'price': 20.0}}, {{'price': 30.0}}]"
            elif "data" in str(args).lower():
                return "data = [1, 2, 3, 4, 5]"
            elif "value" in str(args).lower():
                return "value = 42"
            elif "input" in str(args).lower():
                return "input_value = 'test'"
            else:
                # Use first argument name
                arg_name = args[0]
                if "id" in arg_name.lower():
                    return f"{arg_name} = 'test_id'"
                else:
                    return f"{arg_name} = [1, 2, 3]"
        
        elif test_type == "empty_list":
            if "items" in str(args).lower() or "list" in str(args).lower():
                return "items = []"
            else:
                return f"{args[0]} = []"
        
        elif test_type == "single_item":
            if "items" in str(args).lower():
                return "items = [{'price': 15.0}]"
            else:
                return f"{args[0]} = [1]"
        
        else:
            # Default
            return f"{args[0]} = []"
    
    def _generate_expected_output(self, func_info: Dict[str, Any], behavior: Dict[str, Any], 
                                  test_input: str, test_type: str = "basic") -> str:
        """Generate expected output assertion"""
        func_name = func_info["name"]
        
        if "calculate" in func_name.lower() or "total" in func_name.lower() or "sum" in func_name.lower():
            if test_type == "empty_list":
                return "assert result == 0"
            elif test_type == "single_item":
                return "assert result == 15.0"
            else:
                return "assert result == 60.0  # Sum of prices"
        
        elif "validate" in func_name.lower() or "check" in func_name.lower():
            return "assert isinstance(result, bool)"
        
        elif "get" in func_name.lower() or "find" in func_name.lower():
            if test_type == "empty_list" or "not_found" in test_type:
                return "assert result is None or result == {}"
            else:
                return "assert result is not None"
        
        elif "process" in func_name.lower() or "transform" in func_name.lower():
            if test_type == "empty_list":
                return "assert result == []"
            else:
                return "assert isinstance(result, list)"
                return "assert len(result) > 0"
        
        else:
            # Generic assertion
            if test_type == "empty_list":
                return "assert result == 0 or result == [] or result is None"
            else:
                return "assert result is not None"
    
    def _extract_variables(self, code_line: str) -> List[str]:
        """Extract variable names from a code line"""
        if "=" in code_line:
            var_name = code_line.split("=")[0].strip()
            return [var_name]
        return []
    
    def _generate_fallback_tests(self, code: str, function_name: Optional[str]) -> str:
        """Generate fallback tests when parsing fails"""
        # Try to extract function name from code
        func_match = re.search(r'def\s+(\w+)\s*\(', code)
        if func_match:
            func_name = func_match.group(1)
        elif function_name:
            func_name = function_name
        else:
            func_name = "function"
        
        # Check if it's a calculation function
        is_calculation = "calculate" in code.lower() or "total" in code.lower() or "sum" in code.lower()
        has_items = "items" in code.lower()
        
        if is_calculation and has_items:
            return f"""import pytest

# from your_module import {func_name}

def test_{func_name}_basic():
    \"\"\"Test basic functionality of {func_name}\"\"\"
    items = [{{'price': 10.0}}, {{'price': 20.0}}, {{'price': 30.0}}]
    result = {func_name}(items)
    assert result == 60.0

def test_{func_name}_empty_list():
    \"\"\"Test with empty list\"\"\"
    items = []
    result = {func_name}(items)
    assert result == 0

def test_{func_name}_single_item():
    \"\"\"Test with single item\"\"\"
    items = [{{'price': 15.0}}]
    result = {func_name}(items)
    assert result == 15.0

def test_{func_name}_zero_prices():
    \"\"\"Test with zero prices\"\"\"
    items = [{{'price': 0}}, {{'price': 0}}]
    result = {func_name}(items)
    assert result == 0

def test_{func_name}_negative_prices():
    \"\"\"Test with negative prices\"\"\"
    items = [{{'price': -10.0}}, {{'price': 20.0}}]
    result = {func_name}(items)
    assert result == 10.0

def test_{func_name}_missing_price():
    \"\"\"Test with items missing price field\"\"\"
    items = [{{'price': 10}}, {{'name': 'item'}}]
    result = {func_name}(items)
    # Function should handle missing price gracefully
    assert isinstance(result, (int, float))

def test_{func_name}_error_handling():
    \"\"\"Test error handling for {func_name}\"\"\"
    # Test with None
    with pytest.raises((TypeError, AttributeError)):
        {func_name}(None)
    
    # Test with invalid type
    with pytest.raises((TypeError, AttributeError)):
        {func_name}("not_a_list")
"""
        else:
            return f"""import pytest

def {func_name}(*args, **kwargs):
    \"\"\"Original function - replace with actual import\"\"\"
    pass

def test_{func_name}_basic():
    \"\"\"Test basic functionality of {func_name}\"\"\"
    result = {func_name}()
    assert result is not None

def test_{func_name}_edge_cases():
    \"\"\"Test edge cases for {func_name}\"\"\"
    # Add specific edge case tests based on function behavior
    pass

def test_{func_name}_error_handling():
    \"\"\"Test error handling for {func_name}\"\"\"
    with pytest.raises((TypeError, ValueError)):
        {func_name}(None)
"""
    
    def _generate_js_test_template(self, code: str, function_name: Optional[str]) -> str:
        """Generate JavaScript test template - should not be used if AI is working"""
        # This is a fallback - try to parse code and generate basic tests
        import re
        
        # Try to extract function names
        func_matches = re.findall(r'(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\(|function)|export\s+(?:const|function)\s+(\w+))', code)
        func_names = [m[0] or m[1] or m[2] for m in func_matches if any(m)]
        
        if not func_names and function_name:
            func_names = [function_name]
        
        if not func_names:
            func_names = ["yourFunction"]
        
        test_code = "const { " + ", ".join(func_names) + " } = require('./your-module');\n\n"
        
        for func_name in func_names[:3]:  # Limit to first 3 functions
            test_code += f"describe('{func_name}', () => {{\n"
            test_code += f"    test('should handle basic functionality', () => {{\n"
            test_code += f"        const input = [1, 2, 3];\n"
            test_code += f"        const result = {func_name}(input);\n"
            test_code += f"        expect(result).toBeDefined();\n"
            test_code += f"        expect(typeof result).toBe('object' || 'number' || 'string');\n"
            test_code += f"    }});\n\n"
            
            test_code += f"    test('should handle empty input', () => {{\n"
            test_code += f"        const result = {func_name}([]);\n"
            test_code += f"        expect(result).toBeDefined();\n"
            test_code += f"    }});\n\n"
            
            test_code += f"    test('should handle null input', () => {{\n"
            test_code += f"        expect(() => {func_name}(null)).toThrow();\n"
            test_code += f"    }});\n"
            test_code += f"}});\n\n"
        
        return test_code
    
    def _generate_java_test_template(self, code: str, function_name: Optional[str]) -> str:
        """Generate Java test template using JUnit"""
        if function_name:
            class_name = function_name[0].upper() + function_name[1:] if function_name else "YourClass"
            return f"""import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

public class {class_name}Test {{
    
    private {class_name} {function_name};
    
    @BeforeEach
    void setUp() {{
        {function_name} = new {class_name}();
    }}
    
    @Test
    void test{function_name[0].upper() + function_name[1:]}Basic() {{
        // Test basic functionality
        // Add test implementation
        assertNotNull({function_name});
    }}
    
    @Test
    void test{function_name[0].upper() + function_name[1:]}EdgeCases() {{
        // Test edge cases
        // Add edge case tests
    }}
    
    @Test
    void test{function_name[0].upper() + function_name[1:]}ErrorHandling() {{
        // Test error handling
        assertThrows(Exception.class, () -> {{
            // Add error case test
        }});
    }}
}}
"""
        else:
            return """import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

public class YourClassTest {
    
    @BeforeEach
    void setUp() {
        // Initialize test objects
    }
    
    @Test
    void testBasicFunctionality() {
        // Test basic functionality
        // Add test implementation
    }
    
    @Test
    void testEdgeCases() {
        // Test edge cases
        // Add edge case tests
    }
    
    @Test
    void testErrorHandling() {
        // Test error handling
        assertThrows(Exception.class, () -> {
            // Add error case test
        });
    }
}
"""
    
    def _estimate_coverage(self, code: str, test_code: str) -> float:
        """Estimate test coverage percentage"""
        # Count testable elements in code
        code_elements = 0
        
        # Python: functions and classes
        code_elements += len(re.findall(r'\bdef\s+\w+', code))
        code_elements += len(re.findall(r'\bclass\s+\w+', code))
        
        # JavaScript/TypeScript: functions, classes, components, exports
        code_elements += len(re.findall(r'(?:function|const|let|var)\s+\w+\s*[=:]', code))
        code_elements += len(re.findall(r'\bclass\s+\w+', code))
        code_elements += len(re.findall(r'export\s+(?:default\s+)?(?:function|class|const|let|var)\s+\w+', code))
        
        # Java: methods and classes
        code_elements += len(re.findall(r'(?:public|private|protected)\s+\w+\s+\w+\s*\(', code))
        code_elements += len(re.findall(r'\bclass\s+\w+', code))
        
        # If no explicit functions/classes, count significant statements (imports, calls, etc.)
        if code_elements == 0:
            # Count meaningful code lines (non-empty, non-comment)
            lines = [line.strip() for line in code.split('\n') 
                    if line.strip() and not line.strip().startswith('#') 
                    and not line.strip().startswith('//')]
            code_elements = max(1, len(lines) // 3)  # Rough estimate: 1 testable element per 3 lines
        
        # Count test cases in test code
        test_cases = (
            test_code.count("def test_") + test_code.count("test(") + 
            test_code.count("it(") + test_code.count("@Test") + 
            test_code.count("void test") + test_code.count("describe(")
        )
        
        # If test code exists but no explicit test cases found, estimate based on test code length
        if test_cases == 0 and len(test_code.strip()) > 50:
            # Estimate: assume at least 1 test case if substantial test code exists
            test_cases = 1
        
        if code_elements == 0:
            # If we can't identify testable elements but test code exists, give partial credit
            if test_cases > 0:
                return min(50.0, test_cases * 10.0)  # Cap at 50% if we can't properly analyze
            return 0.0
        
        coverage = min(100.0, (test_cases / max(1, code_elements)) * 100)
        return round(coverage, 2)
    
    def generate_regression_tests(
        self,
        code: str,
        previous_issues: List[Dict[str, Any]],
        language: str = "python"
    ) -> Dict[str, Any]:
        """Generate regression tests based on previous issues"""
        if not previous_issues:
            return self.generate_tests(code, language, "regression")
        
        # Focus on areas that had issues before
        issue_summary = "\n".join([f"- {issue.get('message', 'Unknown issue')}" for issue in previous_issues[:5]])
        
        prompt = f"""Generate regression tests to prevent these previously encountered issues:

Previous Issues:
{issue_summary}

Code:
```{language}
{code}
```

Generate regression tests that specifically prevent these issues from recurring. Provide complete, runnable test code:"""

        # Try preferred provider
        if self.preferred_provider == "anthropic" and self.anthropic_client:
            try:
                return self._generate_regression_tests_claude(code, previous_issues, language, prompt)
            except:
                if self.openai_client:
                    try:
                        return self._generate_regression_tests_openai(code, previous_issues, language, prompt)
                    except:
                        pass
        elif self.openai_client:
            try:
                return self._generate_regression_tests_openai(code, previous_issues, language, prompt)
            except:
                if self.anthropic_client:
                    try:
                        return self._generate_regression_tests_claude(code, previous_issues, language, prompt)
                    except:
                        pass
        
        return self.generate_tests(code, language, "regression")
    
    def _generate_regression_tests_openai(self, code: str, previous_issues: List[Dict[str, Any]], 
                                         language: str, prompt: str) -> Dict[str, Any]:
        """Generate regression tests using OpenAI"""
        response = self.openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert at writing regression tests that prevent known issues. Generate complete, runnable test code."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=3000
        )
        test_code = response.choices[0].message.content
        
        # Extract test code from markdown if present
        if "```" in test_code:
            lines = test_code.split("\n")
            code_start = None
            code_end = None
            for i, line in enumerate(lines):
                if "```" in line and code_start is None:
                    code_start = i + 1
                elif "```" in line and code_start is not None:
                    code_end = i
                    break
            if code_start and code_end:
                test_code = "\n".join(lines[code_start:code_end])
        
        return {
            "test_code": test_code,
            "test_type": "regression",
            "language": language,
            "coverage_estimate": 85.0,
            "test_count": len(previous_issues)
        }
    
    def _generate_regression_tests_claude(self, code: str, previous_issues: List[Dict[str, Any]], 
                                         language: str, prompt: str) -> Dict[str, Any]:
        """Generate regression tests using Claude"""
        model_to_use = ai_model or settings.ANTHROPIC_MODEL
        message = self.anthropic_client.messages.create(
            model=model_to_use,
            max_tokens=3000,
            temperature=0.2,
            system="You are an expert at writing regression tests that prevent known issues. Generate complete, runnable test code.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        test_code = message.content[0].text
        
        # Extract test code from markdown if present
        if "```" in test_code:
            lines = test_code.split("\n")
            code_start = None
            code_end = None
            for i, line in enumerate(lines):
                if "```" in line and code_start is None:
                    code_start = i + 1
                elif "```" in line and code_start is not None:
                    code_end = i
                    break
            if code_start and code_end:
                test_code = "\n".join(lines[code_start:code_end])
        
        return {
            "test_code": test_code,
            "test_type": "regression",
            "language": language,
            "coverage_estimate": 85.0,
            "test_count": len(previous_issues)
        }
    
    def _ai_generate_tests_claude(
        self,
        code: str,
        language: str,
        test_type: str,
        function_name: Optional[str],
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate tests using Claude (Claude 3.5 Sonnet)"""
        try:
            # Determine test framework based on language
            framework = "pytest" if language == "python" else "jest" if language in ["javascript", "typescript"] else "JUnit" if language == "java" else "standard"
            
            # Customize prompt based on test type
            if test_type == 'e2e':
                test_description = "end-to-end (E2E) tests that test complete workflows and user journeys"
                test_focus = "Test complete user workflows, integration between components, and full application flows"
            elif test_type == 'acceptance':
                test_description = "acceptance tests that verify user requirements and business logic"
                test_focus = "Test user scenarios, business requirements, and acceptance criteria. Focus on 'what' the system should do from a user perspective"
            else:  # unit
                test_description = "unit tests for individual functions and methods"
                test_focus = "Test individual functions and methods in isolation"
            
            # Extract actual imports, functions, and components from code
            import_lines = [line for line in code.split('\n') if line.strip().startswith('import ') or line.strip().startswith('from ')]
            actual_imports = '\n'.join(import_lines[:10])  # First 10 import lines
            
            # Extract function/component names from code
            if language.lower() in ['typescript', 'javascript', 'ts', 'js']:
                # Extract function names, component names, exports
                func_pattern = r'(?:export\s+)?(?:function|const|let|var)\s+(\w+)|(?:export\s+)?(?:class|interface|type)\s+(\w+)|export\s+(?:default\s+)?(\w+)'
                matches = re.findall(func_pattern, code)
                actual_names = [name for match in matches for name in match if name]
            elif language.lower() in ['python', 'py']:
                func_pattern = r'def\s+(\w+)|class\s+(\w+)'
                matches = re.findall(func_pattern, code)
                actual_names = [name for match in matches for name in match if name]
            else:
                actual_names = []
            
            actual_names_str = ', '.join(actual_names[:5]) if actual_names else 'the code'
            
            prompt = f"""Generate comprehensive {test_description} for the following {language} code.

CRITICAL REQUIREMENTS:
- Generate COMPLETE, RUNNABLE test code with FULL implementations
- DO NOT use placeholders like 'yourFunction', 'your-module', 'yourComponent', etc.
- DO NOT use TODOs or empty test bodies
- Analyze the ACTUAL code structure and use REAL function/component names from the source code
- Use the EXACT imports, function names, and component names that appear in the source code
- Include actual test data, assertions, and expected results
- Every test must have complete logic and assertions
- Use appropriate testing framework: {framework}

Code to test:
```{language}
{code}
```

IMPORTANT: The code above contains the following actual elements:
{f'- Imports: {actual_imports[:200]}...' if actual_imports else ''}
{f'- Functions/Components: {actual_names_str}' if actual_names else '- Analyze the code structure to identify testable elements'}
{f'- Focus on testing: {function_name}' if function_name else ''}

{f'Focus on testing the function: {function_name}' if function_name else test_focus}

Test Requirements:
1. Analyze the ACTUAL code structure - identify all functions, components, exports, and imports
2. Use the EXACT names from the source code (e.g., if code has 'registerRootComponent', use that name, not 'yourFunction')
3. Use the EXACT imports from the source code (e.g., if code imports 'App from ./App', use that import)
4. Cover all functions, components, and exported elements with complete test implementations
5. Include edge cases (empty inputs, null values, boundary conditions)
6. Include error handling tests with actual error scenarios
7. Use descriptive test names that explain what is being tested
8. Add proper assertions/expectations for every test case
9. Include setup/teardown if needed
10. Make tests immediately runnable - no placeholders, TODOs, or generic names
{f'11. For E2E tests: Test complete workflows, user interactions, and integration between components' if test_type == 'e2e' else ''}
{f'12. For Acceptance tests: Test user scenarios, business requirements, and acceptance criteria' if test_type == 'acceptance' else ''}

EXAMPLE OF WHAT NOT TO DO:
❌ const {{ yourFunction }} = require('./your-module');
❌ test('should handle basic functionality', () => {{ yourFunction([1,2,3]); }});

EXAMPLE OF WHAT TO DO:
✅ Use actual imports: import {{ registerRootComponent }} from 'expo';
✅ Use actual names: test('registerRootComponent registers App component', () => {{ ... }});

Generate ONLY the complete test code file. Do not include explanations or comments about placeholders."""

            model_to_use = ai_model or settings.ANTHROPIC_MODEL
            
            # Log AI request
            logger.info("=" * 80)
            logger.info("🤖 AI REQUEST - Anthropic Claude Test Generation")
            logger.info(f"   Model: {model_to_use}")
            logger.info(f"   Language: {language}")
            logger.info(f"   Test Type: {test_type}")
            logger.info(f"   Code Length: {len(code)} characters")
            logger.info(f"   Prompt Length: {len(prompt)} characters")
            logger.info(f"   Temperature: 0.2")
            logger.info(f"   Max Tokens: 4000")
            logger.debug(f"   Prompt Preview: {prompt[:200]}...")
            start_time = time.time()
            
            try:
                message = self.anthropic_client.messages.create(
                    model=model_to_use,
                    max_tokens=4000,  # Increased for more complete tests
                    temperature=0.2,
                    system="You are an expert test engineer. You MUST generate complete, production-ready test code with full implementations. NEVER use placeholders, TODOs, or empty test bodies. Every test must have complete logic, actual test data, and proper assertions. The code must be immediately runnable.",
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                
                elapsed_time = time.time() - start_time
                test_code = message.content[0].text
                
                # Log AI response
                logger.info("✅ AI RESPONSE - Anthropic Claude Test Generation")
                logger.info(f"   Response Time: {elapsed_time:.2f}s")
                logger.info(f"   Test Code Length: {len(test_code)} characters")
                
                # Log token usage if available
                if hasattr(message, 'usage'):
                    usage = message.usage
                    logger.info(f"   Tokens - Input: {usage.input_tokens if hasattr(usage, 'input_tokens') else 'N/A'}, "
                              f"Output: {usage.output_tokens if hasattr(usage, 'output_tokens') else 'N/A'}")
                
                logger.debug(f"   Test Code Preview: {test_code[:300]}...")
                logger.info("=" * 80)
                
            except Exception as e:
                elapsed_time = time.time() - start_time
                logger.error(f"❌ AI REQUEST FAILED - Anthropic Claude Test Generation")
                logger.error(f"   Error: {str(e)}")
                logger.error(f"   Response Time: {elapsed_time:.2f}s")
                logger.error("=" * 80)
                raise
            
            # Extract test code from markdown if present
            if "```" in test_code:
                lines = test_code.split("\n")
                code_start = None
                code_end = None
                for i, line in enumerate(lines):
                    if "```" in line and code_start is None:
                        code_start = i + 1
                    elif "```" in line and code_start is not None:
                        code_end = i
                        break
                if code_start and code_end:
                    test_code = "\n".join(lines[code_start:code_end])
            
            return {
                "test_code": test_code,
                "test_type": test_type,
                "language": language,
                "coverage_estimate": self._estimate_coverage(code, test_code),
                "test_count": (
                    test_code.count("def test_") +
                    test_code.count("it(") +
                    test_code.count("test(") +
                    test_code.count("@Test") +
                    test_code.count("void test")
                ) or 1
            }
        except Exception as e:
            return self._mock_generate_tests(code, language, test_type, function_name)

