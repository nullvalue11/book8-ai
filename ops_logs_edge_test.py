#!/usr/bin/env python3
"""
Additional edge case tests for GET /api/internal/ops/logs endpoint
"""

import requests
import json

# Configuration
BASE_URL = "https://config-guardian-1.preview.emergentagent.com"
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

def test_invalid_auth():
    """Test with invalid auth token"""
    print("🔍 Edge Case: Invalid Auth Token")
    
    response = make_request(params={'limit': 5}, auth_secret="invalid-token-123")
    
    if response.get('error'):
        log_test_result("Invalid Auth Token", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 401:
        log_test_result("Invalid Auth Token", False, f"Expected 401, got {response['status_code']}")
        return False
    
    data = response['json']
    if data.get('error', {}).get('code') != 'AUTH_FAILED':
        log_test_result("Invalid Auth Token", False, f"Expected AUTH_FAILED, got {data.get('error', {}).get('code')}")
        return False
    
    log_test_result("Invalid Auth Token", True, "Invalid auth properly rejected")
    return True

def test_large_limit():
    """Test with limit larger than max (should be capped)"""
    print("🔍 Edge Case: Large Limit (should be capped at 100)")
    
    response = make_request(params={'limit': 500}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Large Limit", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Large Limit", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    if data['pagination']['limit'] != 100:
        log_test_result("Large Limit", False, f"Expected limit capped at 100, got {data['pagination']['limit']}")
        return False
    
    log_test_result("Large Limit", True, "Limit properly capped at 100")
    return True

def test_negative_skip():
    """Test with negative skip value"""
    print("🔍 Edge Case: Negative Skip Value")
    
    response = make_request(params={'skip': -5}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Negative Skip", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 400:
        log_test_result("Negative Skip", False, f"Expected 400, got {response['status_code']}")
        return False
    
    data = response['json']
    if data.get('error', {}).get('code') != 'INVALID_PARAMS':
        log_test_result("Negative Skip", False, f"Expected INVALID_PARAMS, got {data.get('error', {}).get('code')}")
        return False
    
    log_test_result("Negative Skip", True, "Negative skip properly rejected")
    return True

def test_invalid_actor():
    """Test with invalid actor value"""
    print("🔍 Edge Case: Invalid Actor Value")
    
    response = make_request(params={'actor': 'invalid_actor'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Invalid Actor", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 400:
        log_test_result("Invalid Actor", False, f"Expected 400, got {response['status_code']}")
        return False
    
    data = response['json']
    if data.get('error', {}).get('code') != 'INVALID_PARAMS':
        log_test_result("Invalid Actor", False, f"Expected INVALID_PARAMS, got {data.get('error', {}).get('code')}")
        return False
    
    log_test_result("Invalid Actor", True, "Invalid actor properly rejected")
    return True

def test_empty_results():
    """Test query that should return no results"""
    print("🔍 Edge Case: Query with No Results")
    
    response = make_request(params={'businessId': 'non-existent-business-id'}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Empty Results", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Empty Results", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    if len(data['logs']) != 0:
        log_test_result("Empty Results", False, f"Expected 0 logs, got {len(data['logs'])}")
        return False
    
    if data['pagination']['total'] != 0:
        log_test_result("Empty Results", False, f"Expected total 0, got {data['pagination']['total']}")
        return False
    
    log_test_result("Empty Results", True, "Empty results handled correctly")
    return True

def test_cors_options():
    """Test CORS OPTIONS request"""
    print("🔍 Edge Case: CORS OPTIONS Request")
    
    response = make_request(method="OPTIONS")
    
    if response.get('error'):
        log_test_result("CORS OPTIONS", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 204:
        log_test_result("CORS OPTIONS", False, f"Expected 204, got {response['status_code']}")
        return False
    
    headers = response['headers']
    if 'access-control-allow-methods' not in headers:
        log_test_result("CORS OPTIONS", False, "Missing Access-Control-Allow-Methods header")
        return False
    
    if 'access-control-allow-headers' not in headers:
        log_test_result("CORS OPTIONS", False, "Missing Access-Control-Allow-Headers header")
        return False
    
    log_test_result("CORS OPTIONS", True, "CORS OPTIONS properly handled")
    return True

def test_metadata_structure():
    """Test that metadata field contains expected structure"""
    print("🔍 Edge Case: Metadata Structure Validation")
    
    response = make_request(params={'limit': 1}, auth_secret=AUTH_SECRET)
    
    if response.get('error'):
        log_test_result("Metadata Structure", False, f"Request failed: {response['error']}")
        return False
    
    if response['status_code'] != 200:
        log_test_result("Metadata Structure", False, f"Expected 200, got {response['status_code']}")
        return False
    
    data = response['json']
    if len(data['logs']) == 0:
        log_test_result("Metadata Structure", True, "No logs to validate metadata")
        return True
    
    log_entry = data['logs'][0]
    metadata = log_entry.get('metadata', {})
    
    # Check for common metadata fields (these may vary by tool)
    expected_metadata_fields = ['dryRun', 'ready', 'checklist']
    found_fields = [field for field in expected_metadata_fields if field in metadata]
    
    if len(found_fields) == 0:
        log_test_result("Metadata Structure", False, f"No expected metadata fields found: {list(metadata.keys())}")
        return False
    
    log_test_result("Metadata Structure", True, f"Metadata contains expected fields: {found_fields}")
    return True

def main():
    """Run all edge case tests"""
    print("🚀 Starting GET /api/internal/ops/logs edge case testing")
    print(f"📍 Endpoint: {API_ENDPOINT}")
    print("=" * 80)
    print()
    
    test_functions = [
        test_invalid_auth,
        test_large_limit,
        test_negative_skip,
        test_invalid_actor,
        test_empty_results,
        test_cors_options,
        test_metadata_structure
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
    print(f"🎯 EDGE CASE TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ ALL EDGE CASE TESTS PASSED!")
    else:
        print(f"❌ {total - passed} edge case tests failed.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)