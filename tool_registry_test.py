#!/usr/bin/env python3
"""
Tool Registry API Testing Script
Tests the new GET /api/internal/ops/tools endpoint (Tool Registry)

Test Cases:
1. Basic Tool Registry Query
2. Include Deprecated Tools  
3. Filter by Category
4. Minimal Format
5. Filter by Caller Type
6. Auth Required
7. Tool Schema Validation
8. Invalid Category
"""

import requests
import json
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://tenant-provision.preview.emergentagent.com')
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/tools"
AUTH_HEADER = "x-book8-internal-secret"
AUTH_SECRET = "ops-dev-secret-change-me"  # From .env file

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌"
    print(f"{timestamp} {status_emoji} {test_name}")
    if details:
        print(f"    {details}")

def make_request(method="GET", params=None, headers=None):
    """Make HTTP request to the tool registry endpoint"""
    try:
        if headers is None:
            headers = {}
        
        response = requests.request(
            method=method,
            url=API_ENDPOINT,
            params=params,
            headers=headers,
            timeout=10
        )
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'json': response.json() if response.headers.get('content-type', '').startswith('application/json') else None,
            'text': response.text
        }
    except Exception as e:
        return {
            'error': str(e),
            'status_code': None
        }

def test_basic_tool_registry():
    """Test Case 1: Basic Tool Registry Query"""
    print("\n" + "="*60)
    print("TEST 1: Basic Tool Registry Query")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    response = make_request(headers=headers)
    
    if response.get('error'):
        log_test("Basic Tool Registry Query", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Basic Tool Registry Query", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check required fields
    required_fields = ['ok', 'tools', 'categories', 'riskLevels', 'summary', 'guidance']
    for field in required_fields:
        if field not in data:
            log_test("Basic Tool Registry Query", "FAIL", f"Missing required field: {field}")
            return False
    
    # Check ok: true
    if not data['ok']:
        log_test("Basic Tool Registry Query", "FAIL", f"Expected ok: true, got {data['ok']}")
        return False
    
    # Check tools array has at least 1 tool (tenant.bootstrap)
    if not isinstance(data['tools'], list) or len(data['tools']) < 1:
        log_test("Basic Tool Registry Query", "FAIL", f"Expected at least 1 tool, got {len(data.get('tools', []))}")
        return False
    
    # Check for tenant.bootstrap tool
    bootstrap_tool = next((t for t in data['tools'] if t['name'] == 'tenant.bootstrap'), None)
    if not bootstrap_tool:
        log_test("Basic Tool Registry Query", "FAIL", "tenant.bootstrap tool not found")
        return False
    
    # Check categories object
    expected_categories = ['tenant', 'billing', 'voice', 'system']
    for cat in expected_categories:
        if cat not in data['categories']:
            log_test("Basic Tool Registry Query", "FAIL", f"Missing category: {cat}")
            return False
    
    # Check riskLevels object
    expected_risk_levels = ['low', 'medium', 'high']
    for risk in expected_risk_levels:
        if risk not in data['riskLevels']:
            log_test("Basic Tool Registry Query", "FAIL", f"Missing risk level: {risk}")
            return False
    
    # Check summary structure
    summary = data['summary']
    summary_fields = ['total', 'byCategory', 'deprecated', 'canonical']
    for field in summary_fields:
        if field not in summary:
            log_test("Basic Tool Registry Query", "FAIL", f"Missing summary field: {field}")
            return False
    
    # Check guidance object
    if not isinstance(data['guidance'], dict):
        log_test("Basic Tool Registry Query", "FAIL", "guidance should be an object")
        return False
    
    log_test("Basic Tool Registry Query", "PASS", f"Found {len(data['tools'])} tools, all required fields present")
    print(f"    Tools: {[t['name'] for t in data['tools']]}")
    print(f"    Categories: {list(data['categories'].keys())}")
    print(f"    Summary: {summary}")
    return True

def test_include_deprecated():
    """Test Case 2: Include Deprecated Tools"""
    print("\n" + "="*60)
    print("TEST 2: Include Deprecated Tools")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    params = {'includeDeprecated': 'true'}
    response = make_request(headers=headers, params=params)
    
    if response.get('error'):
        log_test("Include Deprecated Tools", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Include Deprecated Tools", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Should have 5 tools total (1 canonical + 4 deprecated)
    if len(data['tools']) != 5:
        log_test("Include Deprecated Tools", "FAIL", f"Expected 5 tools, got {len(data['tools'])}")
        return False
    
    # Check for deprecated tools
    deprecated_tools = [t for t in data['tools'] if t.get('deprecated')]
    if len(deprecated_tools) != 4:
        log_test("Include Deprecated Tools", "FAIL", f"Expected 4 deprecated tools, got {len(deprecated_tools)}")
        return False
    
    # Check that deprecated tools have replacedBy: "tenant.bootstrap"
    for tool in deprecated_tools:
        if tool.get('replacedBy') != 'tenant.bootstrap':
            log_test("Include Deprecated Tools", "FAIL", f"Tool {tool['name']} should have replacedBy: 'tenant.bootstrap'")
            return False
    
    log_test("Include Deprecated Tools", "PASS", f"Found {len(deprecated_tools)} deprecated tools, all have replacedBy: 'tenant.bootstrap'")
    print(f"    Deprecated tools: {[t['name'] for t in deprecated_tools]}")
    return True

def test_filter_by_category():
    """Test Case 3: Filter by Category"""
    print("\n" + "="*60)
    print("TEST 3: Filter by Category")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    params = {'category': 'tenant', 'includeDeprecated': 'true'}
    response = make_request(headers=headers, params=params)
    
    if response.get('error'):
        log_test("Filter by Category", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Filter by Category", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Should only have tenant category tools
    tenant_tools = [t for t in data['tools'] if t['category'] == 'tenant']
    if len(tenant_tools) != len(data['tools']):
        log_test("Filter by Category", "FAIL", f"All tools should be tenant category")
        return False
    
    # Should include tenant.bootstrap, tenant.ensure, tenant.provisioningSummary
    expected_tenant_tools = ['tenant.bootstrap', 'tenant.ensure', 'tenant.provisioningSummary']
    found_tools = [t['name'] for t in data['tools']]
    
    for expected_tool in expected_tenant_tools:
        if expected_tool not in found_tools:
            log_test("Filter by Category", "FAIL", f"Missing expected tenant tool: {expected_tool}")
            return False
    
    log_test("Filter by Category", "PASS", f"Found {len(data['tools'])} tenant tools")
    print(f"    Tenant tools: {found_tools}")
    return True

def test_minimal_format():
    """Test Case 4: Minimal Format"""
    print("\n" + "="*60)
    print("TEST 4: Minimal Format")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    params = {'format': 'minimal'}
    response = make_request(headers=headers, params=params)
    
    if response.get('error'):
        log_test("Minimal Format", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Minimal Format", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that tools have only minimal fields
    expected_minimal_fields = ['name', 'description', 'category', 'deprecated', 'risk', 'mutates']
    
    for tool in data['tools']:
        # Should have only the expected minimal fields
        for field in expected_minimal_fields:
            if field not in tool:
                log_test("Minimal Format", "FAIL", f"Tool {tool.get('name')} missing minimal field: {field}")
                return False
        
        # Should not have full fields like inputSchema, outputSchema, examples
        full_fields = ['inputSchema', 'outputSchema', 'examples', 'documentation']
        for field in full_fields:
            if field in tool:
                log_test("Minimal Format", "FAIL", f"Tool {tool['name']} should not have full field: {field} in minimal format")
                return False
    
    log_test("Minimal Format", "PASS", f"All {len(data['tools'])} tools have only minimal fields")
    print(f"    Minimal fields: {expected_minimal_fields}")
    return True

def test_filter_by_caller():
    """Test Case 5: Filter by Caller Type"""
    print("\n" + "="*60)
    print("TEST 5: Filter by Caller Type")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    params = {'caller': 'mcp'}
    response = make_request(headers=headers, params=params)
    
    if response.get('error'):
        log_test("Filter by Caller Type", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Filter by Caller Type", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all returned tools have 'mcp' in allowedCallers
    for tool in data['tools']:
        if 'mcp' not in tool.get('allowedCallers', []):
            log_test("Filter by Caller Type", "FAIL", f"Tool {tool['name']} should allow 'mcp' caller")
            return False
    
    log_test("Filter by Caller Type", "PASS", f"All {len(data['tools'])} tools allow 'mcp' caller")
    print(f"    MCP-compatible tools: {[t['name'] for t in data['tools']]}")
    return True

def test_auth_required():
    """Test Case 6: Auth Required"""
    print("\n" + "="*60)
    print("TEST 6: Auth Required")
    print("="*60)
    
    # Test without auth header
    response = make_request()
    
    if response.get('error'):
        log_test("Auth Required", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 401:
        log_test("Auth Required", "FAIL", f"Expected 401, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check error structure
    if not data.get('error') or data['error'].get('code') != 'AUTH_FAILED':
        log_test("Auth Required", "FAIL", f"Expected AUTH_FAILED error, got {data}")
        return False
    
    log_test("Auth Required", "PASS", "Correctly returns 401 AUTH_FAILED without auth header")
    print(f"    Error: {data['error']['message']}")
    return True

def test_tool_schema_validation():
    """Test Case 7: Tool Schema Validation"""
    print("\n" + "="*60)
    print("TEST 7: Tool Schema Validation")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    response = make_request(headers=headers)
    
    if response.get('error'):
        log_test("Tool Schema Validation", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test("Tool Schema Validation", "FAIL", f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Find tenant.bootstrap tool
    bootstrap_tool = next((t for t in data['tools'] if t['name'] == 'tenant.bootstrap'), None)
    if not bootstrap_tool:
        log_test("Tool Schema Validation", "FAIL", "tenant.bootstrap tool not found")
        return False
    
    # Check inputSchema has required businessId
    input_schema = bootstrap_tool.get('inputSchema', {})
    if 'businessId' not in input_schema.get('required', []):
        log_test("Tool Schema Validation", "FAIL", "inputSchema should require businessId")
        return False
    
    # Check outputSchema has expected fields
    output_schema = bootstrap_tool.get('outputSchema', {})
    expected_output_fields = ['ready', 'checklist', 'recommendations']
    output_properties = output_schema.get('properties', {})
    
    for field in expected_output_fields:
        if field not in output_properties:
            log_test("Tool Schema Validation", "FAIL", f"outputSchema missing field: {field}")
            return False
    
    # Check examples array exists
    if not isinstance(bootstrap_tool.get('examples'), list):
        log_test("Tool Schema Validation", "FAIL", "examples should be an array")
        return False
    
    # Check documentation link exists
    if not bootstrap_tool.get('documentation'):
        log_test("Tool Schema Validation", "FAIL", "documentation link should exist")
        return False
    
    log_test("Tool Schema Validation", "PASS", "tenant.bootstrap tool has complete schema")
    print(f"    Input required: {input_schema.get('required', [])}")
    print(f"    Output fields: {list(output_properties.keys())}")
    print(f"    Examples: {len(bootstrap_tool['examples'])}")
    print(f"    Documentation: {bootstrap_tool['documentation']}")
    return True

def test_invalid_category():
    """Test Case 8: Invalid Category"""
    print("\n" + "="*60)
    print("TEST 8: Invalid Category")
    print("="*60)
    
    headers = {AUTH_HEADER: AUTH_SECRET}
    params = {'category': 'invalid'}
    response = make_request(headers=headers, params=params)
    
    if response.get('error'):
        log_test("Invalid Category", "FAIL", f"Request error: {response['error']}")
        return False
    
    if response['status_code'] != 400:
        log_test("Invalid Category", "FAIL", f"Expected 400, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check error structure
    error = data.get('error', {})
    if error.get('code') != 'INVALID_PARAMS':
        log_test("Invalid Category", "FAIL", f"Expected INVALID_PARAMS error, got {error.get('code')}")
        return False
    
    # Check validCategories are provided
    if 'validCategories' not in error:
        log_test("Invalid Category", "FAIL", "validCategories should be provided in error")
        return False
    
    expected_categories = ['tenant', 'billing', 'voice', 'system']
    valid_categories = error['validCategories']
    
    for cat in expected_categories:
        if cat not in valid_categories:
            log_test("Invalid Category", "FAIL", f"Missing valid category: {cat}")
            return False
    
    log_test("Invalid Category", "PASS", "Correctly returns 400 INVALID_PARAMS with validCategories")
    print(f"    Valid categories: {valid_categories}")
    return True

def main():
    """Run all test cases"""
    print("🔧 TOOL REGISTRY API TESTING")
    print(f"Endpoint: {API_ENDPOINT}")
    print(f"Auth: {AUTH_HEADER}: {AUTH_SECRET}")
    
    test_results = []
    
    # Run all test cases
    test_cases = [
        test_basic_tool_registry,
        test_include_deprecated,
        test_filter_by_category,
        test_minimal_format,
        test_filter_by_caller,
        test_auth_required,
        test_tool_schema_validation,
        test_invalid_category
    ]
    
    for test_case in test_cases:
        try:
            result = test_case()
            test_results.append(result)
        except Exception as e:
            print(f"❌ {test_case.__name__} FAILED with exception: {e}")
            test_results.append(False)
    
    # Summary
    print("\n" + "="*60)
    print("TOOL REGISTRY API TEST SUMMARY")
    print("="*60)
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"✅ PASSED: {passed}/{total} tests")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Tool Registry API is working correctly.")
        return True
    else:
        print(f"❌ {total - passed} tests failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)