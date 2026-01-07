#!/usr/bin/env python3
"""
Backend Test Suite for Ops Console Proxy API Endpoints and Basic Auth Protection

Tests the Ops Console proxy API endpoints and Basic Auth protection as specified in the review request.

Test Cases:
1. Basic Auth Protection - No Credentials
2. Basic Auth Protection - Wrong Credentials  
3. Basic Auth Protection - Valid Credentials
4. Proxy - Tools Endpoint
5. Proxy - Logs Endpoint
6. Proxy - Logs with Filters
7. Proxy - Requests Endpoint
8. Proxy - Create Request
9. Proxy - Approve Request
10. UI Page Access - With Auth
11. UI Page Access - Without Auth

Authentication: admin:book8ops2024
Header format: Authorization: Basic YWRtaW46Ym9vazhhb3BzMjAyNA==
"""

import requests
import json
import base64
import os
import time
from typing import Dict, Any, Optional

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-command-9.preview.emergentagent.com')

# Basic Auth credentials
VALID_USERNAME = "admin"
VALID_PASSWORD = "book8ops2024"
VALID_AUTH_HEADER = base64.b64encode(f"{VALID_USERNAME}:{VALID_PASSWORD}".encode()).decode()

# Invalid credentials for testing
INVALID_AUTH_HEADER = base64.b64encode("wrong:credentials".encode()).decode()

class TestResult:
    def __init__(self, name: str, passed: bool, details: str = "", response_data: Any = None):
        self.name = name
        self.passed = passed
        self.details = details
        self.response_data = response_data

def make_request(method: str, url: str, headers: Optional[Dict] = None, data: Optional[Dict] = None, timeout: int = 30) -> requests.Response:
    """Make HTTP request with error handling"""
    try:
        if method.upper() == 'GET':
            return requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == 'POST':
            return requests.post(url, headers=headers, json=data, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def test_basic_auth_no_credentials():
    """Test Case 1: Basic Auth Protection - No Credentials"""
    print("\n🔒 Test Case 1: Basic Auth Protection - No Credentials")
    
    try:
        url = f"{BASE_URL}/api/ops/tools"
        response = make_request('GET', url)
        
        if response.status_code == 401:
            if "Authentication required" in response.text:
                return TestResult("Basic Auth - No Credentials", True, 
                                f"✅ Correctly returned 401 with 'Authentication required' message")
            else:
                return TestResult("Basic Auth - No Credentials", False, 
                                f"❌ Returned 401 but wrong message: {response.text}")
        else:
            return TestResult("Basic Auth - No Credentials", False, 
                            f"❌ Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Basic Auth - No Credentials", False, f"❌ Exception: {str(e)}")

def test_basic_auth_wrong_credentials():
    """Test Case 2: Basic Auth Protection - Wrong Credentials"""
    print("\n🔒 Test Case 2: Basic Auth Protection - Wrong Credentials")
    
    try:
        url = f"{BASE_URL}/api/ops/tools"
        headers = {"Authorization": f"Basic {INVALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 401:
            return TestResult("Basic Auth - Wrong Credentials", True, 
                            f"✅ Correctly returned 401 for invalid credentials")
        else:
            return TestResult("Basic Auth - Wrong Credentials", False, 
                            f"❌ Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Basic Auth - Wrong Credentials", False, f"❌ Exception: {str(e)}")

def test_basic_auth_valid_credentials():
    """Test Case 3: Basic Auth Protection - Valid Credentials"""
    print("\n🔒 Test Case 3: Basic Auth Protection - Valid Credentials")
    
    try:
        url = f"{BASE_URL}/api/ops/tools"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'tools' in data:
                    return TestResult("Basic Auth - Valid Credentials", True, 
                                    f"✅ Correctly returned 200 with tools array containing {len(data['tools'])} tools")
                else:
                    return TestResult("Basic Auth - Valid Credentials", False, 
                                    f"❌ Got 200 but missing 'tools' in response: {data}")
            except json.JSONDecodeError:
                return TestResult("Basic Auth - Valid Credentials", False, 
                                f"❌ Got 200 but invalid JSON: {response.text}")
        else:
            return TestResult("Basic Auth - Valid Credentials", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Basic Auth - Valid Credentials", False, f"❌ Exception: {str(e)}")

def test_proxy_tools_endpoint():
    """Test Case 4: Proxy - Tools Endpoint"""
    print("\n🛠️ Test Case 4: Proxy - Tools Endpoint")
    
    try:
        url = f"{BASE_URL}/api/ops/tools?format=full"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'tools' in data and isinstance(data['tools'], list):
                    tools_count = len(data['tools'])
                    if tools_count >= 1:  # Should have at least tenant.bootstrap
                        return TestResult("Proxy - Tools Endpoint", True, 
                                        f"✅ Successfully retrieved {tools_count} tools from internal ops endpoint")
                    else:
                        return TestResult("Proxy - Tools Endpoint", False, 
                                        f"❌ Tools array is empty: {data}")
                else:
                    return TestResult("Proxy - Tools Endpoint", False, 
                                    f"❌ Missing or invalid 'tools' array: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Tools Endpoint", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Tools Endpoint", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Tools Endpoint", False, f"❌ Exception: {str(e)}")

def test_proxy_logs_endpoint():
    """Test Case 5: Proxy - Logs Endpoint"""
    print("\n📋 Test Case 5: Proxy - Logs Endpoint")
    
    try:
        url = f"{BASE_URL}/api/ops/logs?limit=5"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'logs' in data and isinstance(data['logs'], list):
                    return TestResult("Proxy - Logs Endpoint", True, 
                                    f"✅ Successfully retrieved logs array with {len(data['logs'])} entries")
                else:
                    return TestResult("Proxy - Logs Endpoint", False, 
                                    f"❌ Missing or invalid 'logs' array: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Logs Endpoint", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Logs Endpoint", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Logs Endpoint", False, f"❌ Exception: {str(e)}")

def test_proxy_logs_with_filters():
    """Test Case 6: Proxy - Logs with Filters"""
    print("\n📋 Test Case 6: Proxy - Logs with Filters")
    
    try:
        url = f"{BASE_URL}/api/ops/logs?tool=tenant.status&status=success&limit=3"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'logs' in data and isinstance(data['logs'], list):
                    return TestResult("Proxy - Logs with Filters", True, 
                                    f"✅ Successfully retrieved filtered logs with {len(data['logs'])} entries")
                else:
                    return TestResult("Proxy - Logs with Filters", False, 
                                    f"❌ Missing or invalid 'logs' array: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Logs with Filters", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Logs with Filters", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Logs with Filters", False, f"❌ Exception: {str(e)}")

def test_proxy_requests_endpoint():
    """Test Case 7: Proxy - Requests Endpoint"""
    print("\n✅ Test Case 7: Proxy - Requests Endpoint")
    
    try:
        url = f"{BASE_URL}/api/ops/requests?status=pending"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'requests' in data and isinstance(data['requests'], list):
                    return TestResult("Proxy - Requests Endpoint", True, 
                                    f"✅ Successfully retrieved pending requests array with {len(data['requests'])} entries")
                else:
                    return TestResult("Proxy - Requests Endpoint", False, 
                                    f"❌ Missing or invalid 'requests' array: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Requests Endpoint", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Requests Endpoint", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Requests Endpoint", False, f"❌ Exception: {str(e)}")

def test_proxy_create_request():
    """Test Case 8: Proxy - Create Request"""
    print("\n✅ Test Case 8: Proxy - Create Request")
    
    try:
        url = f"{BASE_URL}/api/ops/requests"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        request_data = {
            "tool": "tenant.bootstrap",
            "payload": {"businessId": "proxy-test-123"},
            "requestedBy": "proxy-test"
        }
        response = make_request('POST', url, headers=headers, data=request_data)
        
        if response.status_code == 201:
            try:
                data = response.json()
                if 'requestId' in data and 'status' in data:
                    if data['status'] == 'pending':
                        return TestResult("Proxy - Create Request", True, 
                                        f"✅ Successfully created request with ID: {data['requestId']}", 
                                        response_data=data)
                    else:
                        return TestResult("Proxy - Create Request", False, 
                                        f"❌ Expected status 'pending', got '{data['status']}': {data}")
                else:
                    return TestResult("Proxy - Create Request", False, 
                                    f"❌ Missing requestId or status in response: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Create Request", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Create Request", False, 
                            f"❌ Expected 201, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Create Request", False, f"❌ Exception: {str(e)}")

def test_proxy_approve_request(request_id: str):
    """Test Case 9: Proxy - Approve Request"""
    print(f"\n✅ Test Case 9: Proxy - Approve Request (ID: {request_id})")
    
    try:
        url = f"{BASE_URL}/api/ops/requests/{request_id}/approve"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        approve_data = {"approvedBy": "proxy-admin"}
        response = make_request('POST', url, headers=headers, data=approve_data)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if 'status' in data:
                    if data['status'] == 'approved':
                        return TestResult("Proxy - Approve Request", True, 
                                        f"✅ Successfully approved request, status: {data['status']}")
                    else:
                        return TestResult("Proxy - Approve Request", False, 
                                        f"❌ Expected status 'approved', got '{data['status']}': {data}")
                else:
                    return TestResult("Proxy - Approve Request", False, 
                                    f"❌ Missing status in response: {data}")
            except json.JSONDecodeError:
                return TestResult("Proxy - Approve Request", False, 
                                f"❌ Invalid JSON response: {response.text}")
        else:
            return TestResult("Proxy - Approve Request", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("Proxy - Approve Request", False, f"❌ Exception: {str(e)}")

def test_ui_page_access_with_auth():
    """Test Case 10: UI Page Access - With Auth"""
    print("\n🌐 Test Case 10: UI Page Access - With Auth")
    
    try:
        url = f"{BASE_URL}/ops"
        headers = {"Authorization": f"Basic {VALID_AUTH_HEADER}"}
        response = make_request('GET', url, headers=headers)
        
        if response.status_code == 200:
            if "Ops Control Plane" in response.text:
                return TestResult("UI Page Access - With Auth", True, 
                                f"✅ Successfully accessed /ops page with valid auth")
            else:
                return TestResult("UI Page Access - With Auth", False, 
                                f"❌ Got 200 but page content doesn't contain expected text")
        else:
            return TestResult("UI Page Access - With Auth", False, 
                            f"❌ Expected 200, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("UI Page Access - With Auth", False, f"❌ Exception: {str(e)}")

def test_ui_page_access_without_auth():
    """Test Case 11: UI Page Access - Without Auth"""
    print("\n🌐 Test Case 11: UI Page Access - Without Auth")
    
    try:
        url = f"{BASE_URL}/ops"
        response = make_request('GET', url)
        
        if response.status_code == 401:
            if "Authentication required" in response.text:
                return TestResult("UI Page Access - Without Auth", True, 
                                f"✅ Correctly returned 401 with 'Authentication required' for /ops page")
            else:
                return TestResult("UI Page Access - Without Auth", False, 
                                f"❌ Returned 401 but wrong message: {response.text}")
        else:
            return TestResult("UI Page Access - Without Auth", False, 
                            f"❌ Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        return TestResult("UI Page Access - Without Auth", False, f"❌ Exception: {str(e)}")

def run_all_tests():
    """Run all test cases and return results"""
    print(f"🚀 Starting Ops Console Proxy API Tests")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🔐 Auth: {VALID_USERNAME}:{'*' * len(VALID_PASSWORD)}")
    print("=" * 80)
    
    results = []
    request_id = None
    
    # Test 1: Basic Auth - No Credentials
    results.append(test_basic_auth_no_credentials())
    
    # Test 2: Basic Auth - Wrong Credentials
    results.append(test_basic_auth_wrong_credentials())
    
    # Test 3: Basic Auth - Valid Credentials
    results.append(test_basic_auth_valid_credentials())
    
    # Test 4: Proxy - Tools Endpoint
    results.append(test_proxy_tools_endpoint())
    
    # Test 5: Proxy - Logs Endpoint
    results.append(test_proxy_logs_endpoint())
    
    # Test 6: Proxy - Logs with Filters
    results.append(test_proxy_logs_with_filters())
    
    # Test 7: Proxy - Requests Endpoint
    results.append(test_proxy_requests_endpoint())
    
    # Test 8: Proxy - Create Request
    create_result = test_proxy_create_request()
    results.append(create_result)
    
    # Extract request ID for approval test
    if create_result.passed and create_result.response_data:
        request_id = create_result.response_data.get('requestId')
    
    # Test 9: Proxy - Approve Request (only if we have a request ID)
    if request_id:
        results.append(test_proxy_approve_request(request_id))
    else:
        results.append(TestResult("Proxy - Approve Request", False, 
                                "❌ Skipped - no request ID from create test"))
    
    # Test 10: UI Page Access - With Auth
    results.append(test_ui_page_access_with_auth())
    
    # Test 11: UI Page Access - Without Auth
    results.append(test_ui_page_access_without_auth())
    
    return results

def print_summary(results):
    """Print test summary"""
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    
    for i, result in enumerate(results, 1):
        status = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"{i:2d}. {status} - {result.name}")
        if result.details:
            print(f"    {result.details}")
    
    print("\n" + "=" * 80)
    print(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Ops Console proxy API endpoints and Basic Auth are working correctly.")
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please review the failures above.")
    
    return passed == total

if __name__ == "__main__":
    try:
        results = run_all_tests()
        all_passed = print_summary(results)
        exit(0 if all_passed else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        exit(1)