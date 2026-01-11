#!/usr/bin/env python3
"""
Comprehensive test for GET /api/internal/ops/logs endpoint

Tests all the scenarios specified in the review request:
1. Basic Query (No Filters)
2. Filter by businessId
3. Filter by tool
4. Filter by status
5. Filter by actor
6. Pagination
7. Combined Filters
8. Auth Required
9. Invalid Parameters
10. Response Structure
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://tenant-provision.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/logs"
AUTH_HEADER = "x-book8-internal-secret"
AUTH_SECRET = "ops-dev-secret-change-me"

def log_test_result(test_name, success, details=""):
    """Log test results with consistent formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(params=None, auth_secret=None, method="GET"):
    """Make HTTP request to the logs endpoint"""
    headers = {}
    if auth_secret is not None:
        headers[AUTH_HEADER] = auth_secret
    
    try:
        if method == "GET":
            response = requests.get(API_ENDPOINT, params=params, headers=headers, timeout=10)
        else:
            response = requests.request(method, API_ENDPOINT, headers=headers, timeout=10)
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'json': response.json() if response.headers.get('content-type', '').startswith('application/json') else None,
            'text': response.text
        }
    except requests.exceptions.RequestException as e:
        return {
            'error': str(e),
            'status_code': None
        }

def test_basic_query():
    """Test Case 1: Basic Query (No Filters)"""
    print("🔍 Test Case 1: Basic Query (No Filters)")
    
    response = make_request(params={'limit': 5}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Basic Query", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Basic Query", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check response structure
    required_fields = ['ok', 'logs', 'pagination']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        log_test_result("Basic Query", False, f"Missing fields: {missing_fields}")
        return False
    
    # Check ok field
    if data['ok'] != True:
        log_test_result("Basic Query", False, f"Expected ok: true, got ok: {data['ok']}")
        return False
    
    # Check logs is array
    if not isinstance(data['logs'], list):
        log_test_result("Basic Query", False, f"Expected logs to be array, got {type(data['logs'])}")
        return False
    
    # Check pagination structure
    pagination = data['pagination']
    pagination_fields = ['total', 'limit', 'skip', 'returned', 'hasMore']
    missing_pagination = [field for field in pagination_fields if field not in pagination]
    if missing_pagination:
        log_test_result("Basic Query", False, f"Missing pagination fields: {missing_pagination}")
        return False
    
    # Check limit is respected
    if pagination['limit'] != 5:
        log_test_result("Basic Query", False, f"Expected limit 5, got {pagination['limit']}")
        return False
    
    log_test_result("Basic Query", True, f"Returned {len(data['logs'])} logs, total: {pagination['total']}")
    return True

def test_filter_by_business_id():
    """Test Case 2: Filter by businessId"""
    print("🔍 Test Case 2: Filter by businessId")
    
    response = make_request(params={'businessId': 'test-event-biz-1'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Filter by businessId", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Filter by businessId", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all returned logs have the correct businessId
    for log_entry in data['logs']:
        if log_entry.get('businessId') != 'test-event-biz-1':
            log_test_result("Filter by businessId", False, f"Found log with wrong businessId: {log_entry.get('businessId')}")
            return False
    
    log_test_result("Filter by businessId", True, f"All {len(data['logs'])} logs have businessId: test-event-biz-1")
    return True

def test_filter_by_tool():
    """Test Case 3: Filter by tool"""
    print("🔍 Test Case 3: Filter by tool")
    
    response = make_request(params={'tool': 'tenant.bootstrap'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Filter by tool", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Filter by tool", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all returned logs have the correct tool
    for log_entry in data['logs']:
        if log_entry.get('tool') != 'tenant.bootstrap':
            log_test_result("Filter by tool", False, f"Found log with wrong tool: {log_entry.get('tool')}")
            return False
    
    log_test_result("Filter by tool", True, f"All {len(data['logs'])} logs have tool: tenant.bootstrap")
    return True

def test_filter_by_status():
    """Test Case 4: Filter by status"""
    print("🔍 Test Case 4: Filter by status")
    
    response = make_request(params={'status': 'success'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Filter by status", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Filter by status", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all returned logs have the correct status
    for log_entry in data['logs']:
        if log_entry.get('status') != 'success':
            log_test_result("Filter by status", False, f"Found log with wrong status: {log_entry.get('status')}")
            return False
    
    log_test_result("Filter by status", True, f"All {len(data['logs'])} logs have status: success")
    return True

def test_filter_by_actor():
    """Test Case 5: Filter by actor"""
    print("🔍 Test Case 5: Filter by actor")
    
    response = make_request(params={'actor': 'system'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Filter by actor", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Filter by actor", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all returned logs have the correct actor
    for log_entry in data['logs']:
        if log_entry.get('actor') != 'system':
            log_test_result("Filter by actor", False, f"Found log with wrong actor: {log_entry.get('actor')}")
            return False
    
    log_test_result("Filter by actor", True, f"All {len(data['logs'])} logs have actor: system")
    return True

def test_pagination():
    """Test Case 6: Pagination"""
    print("🔍 Test Case 6: Pagination")
    
    response = make_request(params={'limit': 2, 'skip': 2}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Pagination", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Pagination", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    pagination = data['pagination']
    
    # Check pagination values
    if pagination['skip'] != 2:
        log_test_result("Pagination", False, f"Expected skip=2, got {pagination['skip']}")
        return False
    
    if pagination['limit'] != 2:
        log_test_result("Pagination", False, f"Expected limit=2, got {pagination['limit']}")
        return False
    
    # Check that returned count matches expected
    if pagination['returned'] != len(data['logs']):
        log_test_result("Pagination", False, f"Returned count mismatch: {pagination['returned']} vs {len(data['logs'])}")
        return False
    
    log_test_result("Pagination", True, f"Pagination working: skip=2, limit=2, returned={pagination['returned']}")
    return True

def test_combined_filters():
    """Test Case 7: Combined Filters"""
    print("🔍 Test Case 7: Combined Filters")
    
    response = make_request(params={
        'tool': 'tenant.bootstrap',
        'status': 'success',
        'limit': 3
    }, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Combined Filters", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Combined Filters", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check that all filters are applied correctly
    for log_entry in data['logs']:
        if log_entry.get('tool') != 'tenant.bootstrap':
            log_test_result("Combined Filters", False, f"Tool filter failed: {log_entry.get('tool')}")
            return False
        if log_entry.get('status') != 'success':
            log_test_result("Combined Filters", False, f"Status filter failed: {log_entry.get('status')}")
            return False
    
    # Check limit
    if data['pagination']['limit'] != 3:
        log_test_result("Combined Filters", False, f"Limit filter failed: {data['pagination']['limit']}")
        return False
    
    log_test_result("Combined Filters", True, f"Combined filters working: {len(data['logs'])} logs match all criteria")
    return True

def test_auth_required():
    """Test Case 8: Auth Required"""
    print("🔍 Test Case 8: Auth Required")
    
    # Test without auth header
    response = make_request(params={'limit': 5})
    
    if response.get('error'):
        log_test_result("Auth Required", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 401:
        log_test_result("Auth Required", False, f"Expected 401, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check error structure
    if data.get('ok') != False:
        log_test_result("Auth Required", False, f"Expected ok: false, got {data.get('ok')}")
        return False
    
    if 'error' not in data:
        log_test_result("Auth Required", False, "Missing error field in response")
        return False
    
    error = data['error']
    if error.get('code') != 'AUTH_FAILED':
        log_test_result("Auth Required", False, f"Expected code: AUTH_FAILED, got {error.get('code')}")
        return False
    
    log_test_result("Auth Required", True, f"Auth properly required: {error.get('message')}")
    return True

def test_invalid_parameters():
    """Test Case 9: Invalid Parameters"""
    print("🔍 Test Case 9: Invalid Parameters")
    
    response = make_request(params={'status': 'invalid'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Invalid Parameters", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 400:
        log_test_result("Invalid Parameters", False, f"Expected 400, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check error structure
    if data.get('ok') != False:
        log_test_result("Invalid Parameters", False, f"Expected ok: false, got {data.get('ok')}")
        return False
    
    if 'error' not in data:
        log_test_result("Invalid Parameters", False, "Missing error field in response")
        return False
    
    error = data['error']
    if error.get('code') != 'INVALID_PARAMS':
        log_test_result("Invalid Parameters", False, f"Expected code: INVALID_PARAMS, got {error.get('code')}")
        return False
    
    # Check that details are provided
    if 'details' not in error:
        log_test_result("Invalid Parameters", False, "Missing error details")
        return False
    
    log_test_result("Invalid Parameters", True, f"Invalid params properly rejected: {error.get('message')}")
    return True

def test_response_structure():
    """Test Case 10: Response Structure"""
    print("🔍 Test Case 10: Response Structure")
    
    response = make_request(params={'limit': 1}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Response Structure", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Response Structure", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    
    # Check if we have at least one log to verify structure
    if len(data['logs']) == 0:
        log_test_result("Response Structure", True, "No logs available to verify structure")
        return True
    
    log_entry = data['logs'][0]
    
    # Required fields for each log object
    required_log_fields = [
        'requestId', 'tool', 'businessId', 'status', 'durationMs', 
        'executedAt', 'actor', 'metadata', 'createdAt'
    ]
    
    missing_fields = []
    for field in required_log_fields:
        if field not in log_entry:
            missing_fields.append(field)
    
    if missing_fields:
        log_test_result("Response Structure", False, f"Missing log fields: {missing_fields}")
        return False
    
    # Check field types
    type_checks = [
        ('requestId', str),
        ('tool', str),
        ('status', str),
        ('durationMs', (int, float)),
        ('actor', str),
        ('metadata', dict)
    ]
    
    for field, expected_type in type_checks:
        if not isinstance(log_entry[field], expected_type):
            log_test_result("Response Structure", False, f"Field {field} has wrong type: {type(log_entry[field])}")
            return False
    
    # Check status is valid enum value
    valid_statuses = ['success', 'failed', 'partial']
    if log_entry['status'] not in valid_statuses:
        log_test_result("Response Structure", False, f"Invalid status: {log_entry['status']}")
        return False
    
    # Check actor is valid enum value
    valid_actors = ['n8n', 'human', 'system', 'api']
    if log_entry['actor'] not in valid_actors:
        log_test_result("Response Structure", False, f"Invalid actor: {log_entry['actor']}")
        return False
    
    log_test_result("Response Structure", True, "All required fields present with correct types")
    return True

def main():
    """Run all test cases"""
    print("🚀 Starting GET /api/internal/ops/logs endpoint testing")
    print(f"📍 Endpoint: {API_ENDPOINT}")
    print(f"🔐 Auth Header: {AUTH_HEADER}")
    print("=" * 80)
    print()
    
    test_functions = [
        test_basic_query,
        test_filter_by_business_id,
        test_filter_by_tool,
        test_filter_by_status,
        test_filter_by_actor,
        test_pagination,
        test_combined_filters,
        test_auth_required,
        test_invalid_parameters,
        test_response_structure
    ]
    
    passed = 0
    total = len(test_functions)
    
    for test_func in test_functions:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            log_test_result(test_func.__name__, False, f"Exception: {str(e)}")
    
    print("=" * 80)
    print(f"🎯 TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ ALL TESTS PASSED! The GET /api/internal/ops/logs endpoint is working correctly.")
    else:
        print(f"❌ {total - passed} tests failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)