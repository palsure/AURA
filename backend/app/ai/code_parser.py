"""
Code Parser Module
Parses code to extract function information for test generation
"""

import ast
import re
from typing import List, Dict, Any, Optional


class CodeParser:
    """Parser for extracting function information from code"""
    
    def parse_python_functions(self, code: str) -> List[Dict[str, Any]]:
        """Parse Python code to extract function definitions"""
        functions = []
        
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    func_info = {
                        "name": node.name,
                        "args": [arg.arg for arg in node.args.args],
                        "defaults": len(node.args.defaults),
                        "has_return": any(isinstance(n, ast.Return) for n in ast.walk(node)),
                        "docstring": ast.get_docstring(node),
                        "line_number": node.lineno,
                        "code": ast.get_source_segment(code, node) or ""
                    }
                    
                    # Analyze function body for hints
                    func_info["uses_loops"] = any(
                        isinstance(n, (ast.For, ast.While)) for n in ast.walk(node)
                    )
                    func_info["uses_conditionals"] = any(
                        isinstance(n, ast.If) for n in ast.walk(node)
                    )
                    func_info["uses_lists"] = any(
                        isinstance(n, ast.List) for n in ast.walk(node)
                    )
                    
                    functions.append(func_info)
        except SyntaxError:
            # If parsing fails, try regex-based extraction
            functions = self._regex_parse_functions(code)
        
        return functions
    
    def _regex_parse_functions(self, code: str) -> List[Dict[str, Any]]:
        """Fallback regex-based function parsing"""
        functions = []
        
        # Match function definitions
        pattern = r'def\s+(\w+)\s*\(([^)]*)\)\s*:'
        matches = re.finditer(pattern, code)
        
        for match in matches:
            func_name = match.group(1)
            args_str = match.group(2)
            args = [arg.strip().split('=')[0].strip() for arg in args_str.split(',') if arg.strip()]
            
            # Find function body
            start_pos = match.end()
            lines = code[start_pos:].split('\n')
            body_lines = []
            indent_level = None
            
            for i, line in enumerate(lines):
                if i == 0:
                    # First line after function definition
                    stripped = line.lstrip()
                    if stripped:
                        indent_level = len(line) - len(stripped)
                        body_lines.append(line)
                elif line.strip():
                    current_indent = len(line) - len(line.lstrip())
                    if indent_level is not None and current_indent > indent_level:
                        body_lines.append(line)
                    else:
                        break
            
            func_info = {
                "name": func_name,
                "args": args,
                "defaults": 0,
                "has_return": "return" in '\n'.join(body_lines),
                "docstring": None,
                "line_number": code[:match.start()].count('\n') + 1,
                "code": match.group(0) + '\n' + '\n'.join(body_lines[:5])  # First few lines
            }
            
            functions.append(func_info)
        
        return functions
    
    def analyze_function_behavior(self, func_info: Dict[str, Any], code: str) -> Dict[str, Any]:
        """Analyze function to determine test scenarios"""
        behavior = {
            "input_types": [],
            "output_type": "unknown",
            "edge_cases": [],
            "error_cases": []
        }
        
        # Analyze function name and code for hints
        func_name = func_info["name"].lower()
        func_code = func_info.get("code", "").lower()
        
        # Determine input types from function name and code
        if "calculate" in func_name or "sum" in func_name or "total" in func_name:
            behavior["input_types"].append("numeric_list")
            behavior["output_type"] = "number"
            behavior["edge_cases"].extend(["empty_list", "single_item", "negative_numbers"])
        
        if "process" in func_name or "transform" in func_name:
            behavior["input_types"].append("list")
            behavior["output_type"] = "list"
            behavior["edge_cases"].extend(["empty_list", "single_item"])
        
        if "get" in func_name or "find" in func_name:
            behavior["input_types"].append("identifier")
            behavior["output_type"] = "object_or_none"
            behavior["error_cases"].extend(["not_found", "invalid_input"])
        
        if "validate" in func_name or "check" in func_name:
            behavior["input_types"].append("value")
            behavior["output_type"] = "boolean"
            behavior["edge_cases"].extend(["valid", "invalid", "empty", "null"])
        
        # Analyze code for specific patterns
        if "items" in func_code or "list" in func_code:
            behavior["input_types"].append("list")
            behavior["edge_cases"].append("empty_list")
        
        if "price" in func_code or "cost" in func_code:
            behavior["input_types"].append("numeric_list")
            behavior["edge_cases"].append("zero_values")
        
        if func_info["uses_conditionals"]:
            behavior["edge_cases"].append("conditional_branches")
        
        return behavior

