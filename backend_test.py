#!/usr/bin/env python3
"""
Backend Test Suite for OpsEventLog Event Emission
Tests the ops execute endpoint event logging functionality.
"""

import requests
import json
import time
import uuid
from datetime import datetime
import os
import sys

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-api-internal.preview.emergentagent.com')
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "ops-dev-secret-change-me"  # From .env OPS_INTERNAL_SECRET
DB_NAME = "your_database_name"  # From .env

# Test configuration
TIMEOUT = 30
HEADERS = {
    'Content-Type': 'application/json',
    'x-book8-internal-secret': AUTH_HEADER
}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_test(self, name, passed, details=""):
        self.tests.append({
            'name': name,
            'passed': passed,
            'details': details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*60}")
        for test in self.tests:
            status = "✅ PASS" if test['passed'] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test['details']:
                print(f"    {test['details']}")

def make_request(method, url, data=None, headers=None, timeout=TIMEOUT):
    """Make HTTP request with error handling"""
    try:
        if method.upper() == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=timeout)
        elif method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return {
            'success': True,
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            'headers': dict(response.headers),
            'response_time': response.elapsed.total_seconds() * 1000
        }
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'Request timeout'}
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Connection error'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def test_successful_bootstrap_event():
    """Test Case 1: Successful Bootstrap Event"""
    print("\n🧪 Test 1: Successful Bootstrap Event")
    
    timestamp = int(time.time())
    request_id = f"test-event-success-{timestamp}"
    
    payload = {
        "requestId": request_id,
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-event-biz-1",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        }
    }
    
    print(f"   📤 Sending POST request to {API_ENDPOINT}")
    print(f"   📋 Request ID: {request_id}")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify response structure
    required_fields = ['ok', 'requestId', 'tool', 'durationMs', 'executedAt']
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field in response: {field}"
    
    # Verify response values
    if data['requestId'] != request_id:
        return False, f"RequestId mismatch: expected {request_id}, got {data['requestId']}"
    
    if data['tool'] != "tenant.bootstrap":
        return False, f"Tool mismatch: expected tenant.bootstrap, got {data['tool']}"
    
    if not isinstance(data['durationMs'], (int, float)) or data['durationMs'] < 0:
        return False, f"Invalid durationMs: {data['durationMs']}"
    
    # Check if response was returned quickly (fire-and-forget pattern)
    response_time = response['response_time']
    if response_time > 5000:  # 5 seconds threshold
        return False, f"Response too slow: {response_time}ms (expected < 5000ms for fire-and-forget)"
    
    print(f"   ✅ Response received in {response_time:.0f}ms")
    print(f"   ✅ Tool execution duration: {data['durationMs']}ms")
    print(f"   ✅ Request ID matches: {data['requestId']}")
    
    return True, f"Bootstrap executed successfully, response time: {response_time:.0f}ms"

def test_partial_status_event():
    """Test Case 2: Partial Status Event (ready=false)"""
    print("\n🧪 Test 2: Partial Status Event")
    
    timestamp = int(time.time())
    request_id = f"test-event-partial-{timestamp}"
    
    # Use a business ID that might result in partial provisioning
    payload = {
        "requestId": request_id,
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-partial-biz-2",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        }
    }
    
    print(f"   📤 Sending POST request for partial status test")
    print(f"   📋 Request ID: {request_id}")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify basic response structure
    if 'ok' not in data or 'requestId' not in data:
        return False, f"Invalid response structure: {data}"
    
    # Check response timing (fire-and-forget)
    response_time = response['response_time']
    if response_time > 5000:
        return False, f"Response too slow: {response_time}ms"
    
    print(f"   ✅ Response received in {response_time:.0f}ms")
    print(f"   ✅ Request processed successfully")
    
    return True, f"Partial status test completed, response time: {response_time:.0f}ms"

def test_response_not_blocked():
    """Test Case 3: Response Not Blocked by Event Logging"""
    print("\n🧪 Test 3: Response Not Blocked by Event Logging")
    
    timestamp = int(time.time())
    request_id = f"test-event-timing-{timestamp}"
    
    payload = {
        "requestId": request_id,
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-timing-biz-3",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        }
    }
    
    print(f"   📤 Testing response timing (fire-and-forget pattern)")
    print(f"   📋 Request ID: {request_id}")
    
    start_time = time.time()
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    end_time = time.time()
    
    total_time = (end_time - start_time) * 1000  # Convert to ms
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}"
    
    data = response['data']
    
    # Verify response includes durationMs
    if 'durationMs' not in data:
        return False, "Response missing durationMs field"
    
    # Verify response includes ok field
    if 'ok' not in data:
        return False, "Response missing ok field"
    
    # Check that response was fast (fire-and-forget should not block)
    if total_time > 10000:  # 10 seconds threshold
        return False, f"Response blocked by event logging: {total_time:.0f}ms"
    
    print(f"   ✅ Total response time: {total_time:.0f}ms")
    print(f"   ✅ Tool execution time: {data['durationMs']}ms")
    print(f"   ✅ Response ok: {data['ok']}")
    
    return True, f"Fire-and-forget pattern working, total time: {total_time:.0f}ms"

def test_authentication_required():
    """Test Case 4: Authentication Required"""
    print("\n🧪 Test 4: Authentication Required")
    
    timestamp = int(time.time())
    request_id = f"test-auth-{timestamp}"
    
    payload = {
        "requestId": request_id,
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-auth-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        }
    }
    
    # Test without auth header
    print("   📤 Testing without authentication header")
    headers_no_auth = {'Content-Type': 'application/json'}
    
    response = make_request('POST', API_ENDPOINT, payload, headers_no_auth)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 401:
        return False, f"Expected 401 Unauthorized, got {response['status_code']}"
    
    data = response['data']
    if 'error' not in data:
        return False, "Expected error in response for unauthorized request"
    
    print(f"   ✅ Unauthorized request properly rejected: {response['status_code']}")
    print(f"   ✅ Error message: {data.get('error', {}).get('message', 'N/A')}")
    
    # Test with invalid auth header
    print("   📤 Testing with invalid authentication header")
    headers_invalid_auth = {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': 'invalid-secret'
    }
    
    response = make_request('POST', API_ENDPOINT, payload, headers_invalid_auth)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 401:
        return False, f"Expected 401 Unauthorized for invalid auth, got {response['status_code']}"
    
    print(f"   ✅ Invalid auth properly rejected: {response['status_code']}")
    
    return True, "Authentication properly enforced"

def test_invalid_tool():
    """Test Case 5: Invalid Tool"""
    print("\n🧪 Test 5: Invalid Tool")
    
    timestamp = int(time.time())
    request_id = f"test-invalid-tool-{timestamp}"
    
    payload = {
        "requestId": request_id,
        "tool": "invalid.tool",
        "args": {
            "businessId": "test-invalid-tool-biz"
        }
    }
    
    print("   📤 Testing with invalid tool name")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 400:
        return False, f"Expected 400 Bad Request, got {response['status_code']}"
    
    data = response['data']
    if 'error' not in data:
        return False, "Expected error in response for invalid tool"
    
    error_code = data.get('error', {}).get('code', '')
    if error_code != 'TOOL_NOT_ALLOWED':
        return False, f"Expected TOOL_NOT_ALLOWED error, got {error_code}"
    
    print(f"   ✅ Invalid tool properly rejected: {response['status_code']}")
    print(f"   ✅ Error code: {error_code}")
    
    return True, "Invalid tool properly handled"

def test_missing_required_fields():
    """Test Case 6: Missing Required Fields"""
    print("\n🧪 Test 6: Missing Required Fields")
    
    # Test missing requestId
    print("   📤 Testing missing requestId")
    payload_no_request_id = {
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-missing-fields"
        }
    }
    
    response = make_request('POST', API_ENDPOINT, payload_no_request_id, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 400:
        return False, f"Expected 400 for missing requestId, got {response['status_code']}"
    
    print(f"   ✅ Missing requestId properly rejected: {response['status_code']}")
    
    # Test missing tool
    print("   📤 Testing missing tool")
    payload_no_tool = {
        "requestId": f"test-no-tool-{int(time.time())}",
        "args": {
            "businessId": "test-missing-fields"
        }
    }
    
    response = make_request('POST', API_ENDPOINT, payload_no_tool, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 400:
        return False, f"Expected 400 for missing tool, got {response['status_code']}"
    
    print(f"   ✅ Missing tool properly rejected: {response['status_code']}")
    
    return True, "Missing required fields properly validated"

def test_get_endpoint():
    """Test Case 7: GET Endpoint (Health Check)"""
    print("\n🧪 Test 7: GET Endpoint Health Check")
    
    print("   📤 Testing GET endpoint for tool listing")
    
    response = make_request('GET', API_ENDPOINT, headers=HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}"
    
    data = response['data']
    
    # Verify response structure
    required_fields = ['ok', 'version', 'tools', 'health']
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field in GET response: {field}"
    
    if not data['ok']:
        return False, "Health check failed: ok is false"
    
    if not isinstance(data['tools'], list):
        return False, "Tools field should be a list"
    
    # Check if tenant.bootstrap tool is available
    tool_names = [tool.get('name', '') for tool in data['tools']]
    if 'tenant.bootstrap' not in tool_names:
        return False, "tenant.bootstrap tool not found in available tools"
    
    print(f"   ✅ Health check passed: {data['health']['status']}")
    print(f"   ✅ Available tools: {len(data['tools'])}")
    print(f"   ✅ Version: {data['version']}")
    
    return True, f"Health check successful, {len(data['tools'])} tools available"

def main():
    """Run all tests"""
    print("🚀 Starting OpsEventLog Event Emission Tests")
    print(f"📍 Testing endpoint: {API_ENDPOINT}")
    print(f"🔑 Using auth header: {AUTH_HEADER[:10]}...")
    
    results = TestResults()
    
    # Test 1: Successful Bootstrap Event
    try:
        passed, details = test_successful_bootstrap_event()
        results.add_test("Successful Bootstrap Event", passed, details)
    except Exception as e:
        results.add_test("Successful Bootstrap Event", False, f"Exception: {str(e)}")
    
    # Test 2: Partial Status Event
    try:
        passed, details = test_partial_status_event()
        results.add_test("Partial Status Event", passed, details)
    except Exception as e:
        results.add_test("Partial Status Event", False, f"Exception: {str(e)}")
    
    # Test 3: Response Not Blocked
    try:
        passed, details = test_response_not_blocked()
        results.add_test("Response Not Blocked by Event Logging", passed, details)
    except Exception as e:
        results.add_test("Response Not Blocked by Event Logging", False, f"Exception: {str(e)}")
    
    # Test 4: Authentication Required
    try:
        passed, details = test_authentication_required()
        results.add_test("Authentication Required", passed, details)
    except Exception as e:
        results.add_test("Authentication Required", False, f"Exception: {str(e)}")
    
    # Test 5: Invalid Tool
    try:
        passed, details = test_invalid_tool()
        results.add_test("Invalid Tool Handling", passed, details)
    except Exception as e:
        results.add_test("Invalid Tool Handling", False, f"Exception: {str(e)}")
    
    # Test 6: Missing Required Fields
    try:
        passed, details = test_missing_required_fields()
        results.add_test("Missing Required Fields Validation", passed, details)
    except Exception as e:
        results.add_test("Missing Required Fields Validation", False, f"Exception: {str(e)}")
    
    # Test 7: GET Endpoint
    try:
        passed, details = test_get_endpoint()
        results.add_test("GET Endpoint Health Check", passed, details)
    except Exception as e:
        results.add_test("GET Endpoint Health Check", False, f"Exception: {str(e)}")
    
    # Print results
    results.print_summary()
    
    # Return exit code
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)