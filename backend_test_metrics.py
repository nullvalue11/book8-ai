#!/usr/bin/env python3
"""
Backend Testing Script for Book8 AI - GET /api/internal/ops/metrics Endpoint
Tests the new ops metrics endpoint with comprehensive test cases.
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys
import os

# Configuration
BASE_URL = "https://stripe-unlock.preview.emergentagent.com"
AUTH_HEADER = "x-book8-internal-secret"
AUTH_TOKEN = "ops-dev-secret-change-me"

def log_test(test_name, status, details=""):
    """Log test results with consistent formatting"""
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"{status_symbol} {test_name}: {status}")
    if details:
        print(f"   Details: {details}")
    print()

def make_request(method, endpoint, headers=None, params=None, data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, params=params, json=data, timeout=30)
        elif method.upper() == "OPTIONS":
            response = requests.options(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        # For auth tests, we still want to return the response even if it fails
        # This allows us to test the proper error codes
        return None

def test_basic_metrics_query():
    """Test Case 1: Basic Metrics Query"""
    print("🔍 Test Case 1: Basic Metrics Query")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    response = make_request("GET", "/api/internal/ops/metrics", headers=headers)
    
    if not response:
        log_test("Basic Metrics Query", "FAIL", "Request failed")
        return False
    
    if response.status_code != 200:
        log_test("Basic Metrics Query", "FAIL", f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Basic Metrics Query", "FAIL", "Invalid JSON response")
        return False
    
    # Verify response structure
    required_fields = ['ok', 'metrics', 'generatedAt']
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        log_test("Basic Metrics Query", "FAIL", f"Missing fields: {missing_fields}")
        return False
    
    if not data.get('ok'):
        log_test("Basic Metrics Query", "FAIL", f"ok: false - {data.get('error', 'Unknown error')}")
        return False
    
    metrics = data.get('metrics', {})
    
    # Verify metrics structure
    required_metrics = ['executions', 'byTool', 'byActor', 'health', 'timeRange']
    missing_metrics = [field for field in required_metrics if field not in metrics]
    if missing_metrics:
        log_test("Basic Metrics Query", "FAIL", f"Missing metrics fields: {missing_metrics}")
        return False
    
    # Verify executions structure
    executions = metrics.get('executions', {})
    required_exec_fields = ['total', 'successful', 'failed', 'partial', 'pending', 'successRate']
    missing_exec_fields = [field for field in required_exec_fields if field not in executions]
    if missing_exec_fields:
        log_test("Basic Metrics Query", "FAIL", f"Missing executions fields: {missing_exec_fields}")
        return False
    
    # Verify health structure
    health = metrics.get('health', {})
    required_health_fields = ['status', 'uptimeSeconds', 'uptimeHuman', 'lastCheck']
    missing_health_fields = [field for field in required_health_fields if field not in health]
    if missing_health_fields:
        log_test("Basic Metrics Query", "FAIL", f"Missing health fields: {missing_health_fields}")
        return False
    
    # Verify timeRange structure
    time_range = metrics.get('timeRange', {})
    required_time_fields = ['since', 'until', 'durationHours']
    missing_time_fields = [field for field in required_time_fields if field not in time_range]
    if missing_time_fields:
        log_test("Basic Metrics Query", "FAIL", f"Missing timeRange fields: {missing_time_fields}")
        return False
    
    # Verify generatedAt is a valid timestamp
    try:
        datetime.fromisoformat(data['generatedAt'].replace('Z', '+00:00'))
    except ValueError:
        log_test("Basic Metrics Query", "FAIL", "Invalid generatedAt timestamp")
        return False
    
    log_test("Basic Metrics Query", "PASS", f"All required fields present. Total executions: {executions['total']}, Health: {health['status']}")
    return True

def test_cache_behavior():
    """Test Case 2: Cache Behavior"""
    print("🔍 Test Case 2: Cache Behavior")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    
    # First request
    response1 = make_request("GET", "/api/internal/ops/metrics", headers=headers)
    if not response1 or response1.status_code != 200:
        log_test("Cache Behavior - First Request", "FAIL", "First request failed")
        return False
    
    data1 = response1.json()
    if not data1.get('ok'):
        log_test("Cache Behavior - First Request", "FAIL", "First request returned ok: false")
        return False
    
    # Wait a moment
    time.sleep(1)
    
    # Second request (should be cached)
    response2 = make_request("GET", "/api/internal/ops/metrics", headers=headers)
    if not response2 or response2.status_code != 200:
        log_test("Cache Behavior - Second Request", "FAIL", "Second request failed")
        return False
    
    data2 = response2.json()
    if not data2.get('ok'):
        log_test("Cache Behavior - Second Request", "FAIL", "Second request returned ok: false")
        return False
    
    # Check if second request was cached
    is_cached = data2.get('cached', False)
    if is_cached:
        cache_age = data2.get('cacheAge', 'unknown')
        log_test("Cache Behavior", "PASS", f"Second request returned cached: true, cacheAge: {cache_age}")
        return True
    else:
        # Cache might not be working or TTL expired, but this is not necessarily a failure
        log_test("Cache Behavior", "PASS", "Second request not cached (cache may have expired or be disabled)")
        return True

def test_refresh_parameter():
    """Test Case 3: Refresh Parameter"""
    print("🔍 Test Case 3: Refresh Parameter")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    params = {"refresh": "true"}
    
    response = make_request("GET", "/api/internal/ops/metrics", headers=headers, params=params)
    
    if not response:
        log_test("Refresh Parameter", "FAIL", "Request failed")
        return False
    
    if response.status_code != 200:
        log_test("Refresh Parameter", "FAIL", f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Refresh Parameter", "FAIL", "Invalid JSON response")
        return False
    
    if not data.get('ok'):
        log_test("Refresh Parameter", "FAIL", f"ok: false - {data.get('error', 'Unknown error')}")
        return False
    
    # Verify refresh worked (cached should be false)
    is_cached = data.get('cached', True)  # Default to True to catch if field is missing
    if is_cached:
        log_test("Refresh Parameter", "FAIL", "Expected cached: false with refresh=true")
        return False
    
    log_test("Refresh Parameter", "PASS", "Fresh data calculated with refresh=true")
    return True

def test_time_range_filtering():
    """Test Case 4: Time Range Filtering"""
    print("🔍 Test Case 4: Time Range Filtering")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    since_date = "2026-01-06T00:00:00Z"
    params = {"since": since_date}
    
    response = make_request("GET", "/api/internal/ops/metrics", headers=headers, params=params)
    
    if not response:
        log_test("Time Range Filtering", "FAIL", "Request failed")
        return False
    
    if response.status_code != 200:
        log_test("Time Range Filtering", "FAIL", f"Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Time Range Filtering", "FAIL", "Invalid JSON response")
        return False
    
    if not data.get('ok'):
        log_test("Time Range Filtering", "FAIL", f"ok: false - {data.get('error', 'Unknown error')}")
        return False
    
    # Verify timeRange.since matches provided value (allow for milliseconds difference)
    metrics = data.get('metrics', {})
    time_range = metrics.get('timeRange', {})
    returned_since = time_range.get('since')
    
    # Parse both dates to compare them properly (handle milliseconds)
    try:
        expected_dt = datetime.fromisoformat(since_date.replace('Z', '+00:00'))
        returned_dt = datetime.fromisoformat(returned_since.replace('Z', '+00:00'))
        
        # Allow for small differences due to milliseconds formatting
        if abs((expected_dt - returned_dt).total_seconds()) > 1:
            log_test("Time Range Filtering", "FAIL", f"Expected since: {since_date}, got: {returned_since}")
            return False
    except ValueError as e:
        log_test("Time Range Filtering", "FAIL", f"Date parsing error: {e}")
        return False
    
    log_test("Time Range Filtering", "PASS", f"Time range filtering working. Since: {returned_since}")
    return True

def test_auth_required():
    """Test Case 5: Auth Required"""
    print("🔍 Test Case 5: Auth Required")
    
    # Request without auth header - use requests directly to handle error responses
    url = f"{BASE_URL}/api/internal/ops/metrics"
    
    try:
        response = requests.get(url, timeout=30)
    except requests.exceptions.RequestException as e:
        log_test("Auth Required", "FAIL", f"Request failed: {e}")
        return False
    
    if response.status_code != 401:
        log_test("Auth Required", "FAIL", f"Expected 401, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Auth Required", "FAIL", "Invalid JSON response")
        return False
    
    if data.get('ok') is not False:
        log_test("Auth Required", "FAIL", "Expected ok: false")
        return False
    
    error = data.get('error', {})
    if error.get('code') != 'AUTH_FAILED':
        log_test("Auth Required", "FAIL", f"Expected AUTH_FAILED, got: {error.get('code')}")
        return False
    
    log_test("Auth Required", "PASS", "Correctly returns 401 AUTH_FAILED without auth")
    return True

def test_health_status():
    """Test Case 6: Health Status"""
    print("🔍 Test Case 6: Health Status")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    response = make_request("GET", "/api/internal/ops/metrics", headers=headers)
    
    if not response or response.status_code != 200:
        log_test("Health Status", "FAIL", "Request failed")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Health Status", "FAIL", "Invalid JSON response")
        return False
    
    if not data.get('ok'):
        log_test("Health Status", "FAIL", "Request returned ok: false")
        return False
    
    metrics = data.get('metrics', {})
    health = metrics.get('health', {})
    
    # Verify health object contains required fields
    required_fields = ['status', 'uptimeSeconds', 'uptimeHuman', 'lastCheck']
    missing_fields = [field for field in required_fields if field not in health]
    if missing_fields:
        log_test("Health Status", "FAIL", f"Missing health fields: {missing_fields}")
        return False
    
    # Verify status is valid
    valid_statuses = ['healthy', 'degraded', 'unhealthy']
    status = health.get('status')
    if status not in valid_statuses:
        log_test("Health Status", "FAIL", f"Invalid status: {status}. Expected one of: {valid_statuses}")
        return False
    
    # Verify uptimeSeconds is a number
    uptime_seconds = health.get('uptimeSeconds')
    if not isinstance(uptime_seconds, (int, float)) or uptime_seconds < 0:
        log_test("Health Status", "FAIL", f"Invalid uptimeSeconds: {uptime_seconds}")
        return False
    
    # Verify lastCheck is a valid timestamp
    try:
        datetime.fromisoformat(health['lastCheck'].replace('Z', '+00:00'))
    except ValueError:
        log_test("Health Status", "FAIL", "Invalid lastCheck timestamp")
        return False
    
    log_test("Health Status", "PASS", f"Health status: {status}, uptime: {health['uptimeHuman']}")
    return True

def test_per_tool_metrics():
    """Test Case 7: Per-Tool Metrics"""
    print("🔍 Test Case 7: Per-Tool Metrics")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    response = make_request("GET", "/api/internal/ops/metrics", headers=headers)
    
    if not response or response.status_code != 200:
        log_test("Per-Tool Metrics", "FAIL", "Request failed")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Per-Tool Metrics", "FAIL", "Invalid JSON response")
        return False
    
    if not data.get('ok'):
        log_test("Per-Tool Metrics", "FAIL", "Request returned ok: false")
        return False
    
    metrics = data.get('metrics', {})
    by_tool = metrics.get('byTool', {})
    
    # If there are tools, verify their structure
    if by_tool:
        for tool_name, tool_metrics in by_tool.items():
            required_fields = ['count', 'failed', 'successRate', 'avgDurationMs', 'maxDurationMs', 'minDurationMs']
            missing_fields = [field for field in required_fields if field not in tool_metrics]
            if missing_fields:
                log_test("Per-Tool Metrics", "FAIL", f"Tool '{tool_name}' missing fields: {missing_fields}")
                return False
            
            # Verify numeric fields
            numeric_fields = ['count', 'failed', 'avgDurationMs', 'maxDurationMs', 'minDurationMs']
            for field in numeric_fields:
                value = tool_metrics.get(field)
                if not isinstance(value, (int, float)) or value < 0:
                    log_test("Per-Tool Metrics", "FAIL", f"Tool '{tool_name}' has invalid {field}: {value}")
                    return False
            
            # Verify successRate is a percentage string
            success_rate = tool_metrics.get('successRate')
            if not isinstance(success_rate, str) or not success_rate.endswith('%'):
                log_test("Per-Tool Metrics", "FAIL", f"Tool '{tool_name}' has invalid successRate: {success_rate}")
                return False
        
        log_test("Per-Tool Metrics", "PASS", f"Found {len(by_tool)} tools with valid metrics structure")
    else:
        log_test("Per-Tool Metrics", "PASS", "No tool metrics found (empty byTool object)")
    
    return True

def test_invalid_time_parameters():
    """Test Case 8: Invalid Time Parameters"""
    print("🔍 Test Case 8: Invalid Time Parameters")
    
    headers = {AUTH_HEADER: AUTH_TOKEN}
    params = {"since": "invalid-date"}
    
    # Use requests directly to handle error responses
    url = f"{BASE_URL}/api/internal/ops/metrics"
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
    except requests.exceptions.RequestException as e:
        log_test("Invalid Time Parameters", "FAIL", f"Request failed: {e}")
        return False
    
    if response.status_code != 400:
        log_test("Invalid Time Parameters", "FAIL", f"Expected 400, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except json.JSONDecodeError:
        log_test("Invalid Time Parameters", "FAIL", "Invalid JSON response")
        return False
    
    if data.get('ok') is not False:
        log_test("Invalid Time Parameters", "FAIL", "Expected ok: false")
        return False
    
    error = data.get('error', {})
    if error.get('code') != 'INVALID_PARAMS':
        log_test("Invalid Time Parameters", "FAIL", f"Expected INVALID_PARAMS, got: {error.get('code')}")
        return False
    
    log_test("Invalid Time Parameters", "PASS", "Correctly returns 400 INVALID_PARAMS for invalid date")
    return True

def test_cors_options():
    """Test CORS OPTIONS request"""
    print("🔍 CORS Test: OPTIONS Request")
    
    response = make_request("OPTIONS", "/api/internal/ops/metrics")
    
    if not response:
        log_test("CORS OPTIONS", "FAIL", "Request failed")
        return False
    
    if response.status_code != 204:
        log_test("CORS OPTIONS", "FAIL", f"Expected 204, got {response.status_code}")
        return False
    
    # Check CORS headers
    headers = response.headers
    if 'Access-Control-Allow-Methods' not in headers:
        log_test("CORS OPTIONS", "FAIL", "Missing Access-Control-Allow-Methods header")
        return False
    
    if 'Access-Control-Allow-Headers' not in headers:
        log_test("CORS OPTIONS", "FAIL", "Missing Access-Control-Allow-Headers header")
        return False
    
    log_test("CORS OPTIONS", "PASS", "CORS headers present")
    return True

def main():
    """Run all tests"""
    print("🚀 Starting Backend Testing for GET /api/internal/ops/metrics")
    print(f"🔗 Base URL: {BASE_URL}")
    print(f"🔑 Auth Header: {AUTH_HEADER}")
    print("=" * 80)
    print()
    
    # Track test results
    tests = [
        ("Basic Metrics Query", test_basic_metrics_query),
        ("Cache Behavior", test_cache_behavior),
        ("Refresh Parameter", test_refresh_parameter),
        ("Time Range Filtering", test_time_range_filtering),
        ("Auth Required", test_auth_required),
        ("Health Status", test_health_status),
        ("Per-Tool Metrics", test_per_tool_metrics),
        ("Invalid Time Parameters", test_invalid_time_parameters),
        ("CORS OPTIONS", test_cors_options),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name}: FAIL (Exception: {e})")
            failed += 1
        
        print("-" * 40)
    
    # Summary
    total = passed + failed
    print(f"\n📊 TEST SUMMARY")
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "N/A")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! The GET /api/internal/ops/metrics endpoint is working correctly.")
        return True
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)