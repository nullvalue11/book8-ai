#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Subscription Paywall Implementation
Tests all protected API routes to ensure proper subscription enforcement.
"""

import requests
import json
import uuid
import time
from datetime import datetime

# Configuration
BASE_URL = "https://meter-inspect.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, details=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "No tests run")

def test_subscription_paywall():
    """Test subscription paywall implementation across all protected routes"""
    results = TestResults()
    
    print("🔒 Testing Subscription Paywall Implementation")
    print("=" * 60)
    
    # Step 1: Register a new test user
    print("\n📝 Step 1: Register new test user")
    test_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    test_password = "TestPassword123!"
    
    register_data = {
        "email": test_email,
        "password": test_password,
        "name": "Test User"
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/register", json=register_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("token"):
                jwt_token = data["token"]
                results.add_result("User Registration", True, f"Registered {test_email}")
                print(f"   JWT Token: {jwt_token[:20]}...")
            else:
                results.add_result("User Registration", False, f"No token in response: {data}")
                return results
        else:
            results.add_result("User Registration", False, f"Status {response.status_code}: {response.text}")
            return results
    except Exception as e:
        results.add_result("User Registration", False, f"Exception: {str(e)}")
        return results
    
    # Headers for authenticated requests
    auth_headers = {"Authorization": f"Bearer {jwt_token}"}
    
    # Step 2: Verify user has no subscription
    print("\n🔍 Step 2: Verify user subscription status")
    try:
        response = requests.get(f"{API_BASE}/billing/me", headers=auth_headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("subscribed") == False:
                results.add_result("User Not Subscribed", True, f"subscribed: {data.get('subscribed')}")
            else:
                results.add_result("User Not Subscribed", False, f"Unexpected subscription status: {data}")
        else:
            results.add_result("User Not Subscribed", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        results.add_result("User Not Subscribed", False, f"Exception: {str(e)}")
    
    # Step 3: Test protected routes that should return 402 SUBSCRIPTION_REQUIRED
    print("\n🚫 Step 3: Test protected routes (should return 402)")
    
    protected_routes = [
        {
            "name": "Google Calendar Sync Status",
            "method": "GET",
            "url": f"{API_BASE}/integrations/google/sync",
            "feature": "calendar"
        },
        {
            "name": "Google Calendar Sync Trigger",
            "method": "POST", 
            "url": f"{API_BASE}/integrations/google/sync",
            "feature": "calendar"
        },
        {
            "name": "Google Calendar List",
            "method": "GET",
            "url": f"{API_BASE}/integrations/google/calendars",
            "feature": "calendar"
        },
        {
            "name": "Event Types List",
            "method": "GET",
            "url": f"{API_BASE}/event-types",
            "feature": "event-types"
        },
        {
            "name": "Event Types Create",
            "method": "POST",
            "url": f"{API_BASE}/event-types",
            "feature": "event-types",
            "data": {"name": "Test Event", "durationMinutes": 30}
        },
        {
            "name": "Scheduling Settings",
            "method": "GET",
            "url": f"{API_BASE}/settings/scheduling",
            "feature": "scheduling"
        },
        {
            "name": "Analytics Summary",
            "method": "GET",
            "url": f"{API_BASE}/analytics/summary",
            "feature": "analytics"
        }
    ]
    
    for route in protected_routes:
        try:
            if route["method"] == "GET":
                response = requests.get(route["url"], headers=auth_headers, timeout=10)
            elif route["method"] == "POST":
                data = route.get("data", {})
                response = requests.post(route["url"], headers=auth_headers, json=data, timeout=10)
            
            if response.status_code == 402:
                try:
                    data = response.json()
                    expected_structure = {
                        "ok": False,
                        "error": "Subscription required",
                        "code": "SUBSCRIPTION_REQUIRED",
                        "feature": route["feature"]
                    }
                    
                    # Check response structure
                    valid_structure = True
                    missing_fields = []
                    
                    for key, expected_value in expected_structure.items():
                        if key not in data:
                            missing_fields.append(key)
                            valid_structure = False
                        elif key == "feature" and data[key] != expected_value:
                            missing_fields.append(f"{key} (expected '{expected_value}', got '{data[key]}')")
                            valid_structure = False
                        elif key in ["ok", "error", "code"] and data[key] != expected_value:
                            missing_fields.append(f"{key} (expected '{expected_value}', got '{data[key]}')")
                            valid_structure = False
                    
                    if valid_structure:
                        results.add_result(f"Protected Route: {route['name']}", True, 
                                         f"402 with correct structure, feature: {data.get('feature')}")
                    else:
                        results.add_result(f"Protected Route: {route['name']}", False, 
                                         f"402 but invalid structure. Missing/wrong: {missing_fields}")
                except json.JSONDecodeError:
                    results.add_result(f"Protected Route: {route['name']}", False, 
                                     f"402 but invalid JSON response")
            else:
                results.add_result(f"Protected Route: {route['name']}", False, 
                                 f"Expected 402, got {response.status_code}: {response.text[:200]}")
        except Exception as e:
            results.add_result(f"Protected Route: {route['name']}", False, f"Exception: {str(e)}")
    
    # Step 4: Test routes that should NOT be protected
    print("\n✅ Step 4: Test unprotected routes (should work normally)")
    
    unprotected_routes = [
        {
            "name": "Billing Status Check",
            "method": "GET",
            "url": f"{API_BASE}/billing/me",
            "expected_status": 200
        },
        {
            "name": "User Info",
            "method": "GET", 
            "url": f"{API_BASE}/user",
            "expected_status": 200
        },
        {
            "name": "Billing Plans",
            "method": "GET",
            "url": f"{API_BASE}/billing/plans", 
            "expected_status": 200
        }
    ]
    
    for route in unprotected_routes:
        try:
            if route["method"] == "GET":
                response = requests.get(route["url"], headers=auth_headers, timeout=10)
            elif route["method"] == "POST":
                data = route.get("data", {})
                response = requests.post(route["url"], headers=auth_headers, json=data, timeout=10)
            
            if response.status_code == route["expected_status"]:
                try:
                    data = response.json()
                    if route["name"] == "Billing Status Check":
                        # Verify subscription status is false
                        if data.get("ok") and data.get("subscribed") == False:
                            results.add_result(f"Unprotected Route: {route['name']}", True, 
                                             f"Status {response.status_code}, subscribed: {data.get('subscribed')}")
                        else:
                            results.add_result(f"Unprotected Route: {route['name']}", False, 
                                             f"Unexpected response structure: {data}")
                    elif route["name"] == "Billing Plans":
                        # Verify plans structure
                        if data.get("ok") and "plans" in data:
                            results.add_result(f"Unprotected Route: {route['name']}", True, 
                                             f"Status {response.status_code}, plans available")
                        else:
                            results.add_result(f"Unprotected Route: {route['name']}", False, 
                                             f"Missing plans in response: {data}")
                    else:
                        results.add_result(f"Unprotected Route: {route['name']}", True, 
                                         f"Status {response.status_code}")
                except json.JSONDecodeError:
                    results.add_result(f"Unprotected Route: {route['name']}", False, 
                                     f"Status {response.status_code} but invalid JSON")
            else:
                results.add_result(f"Unprotected Route: {route['name']}", False, 
                                 f"Expected {route['expected_status']}, got {response.status_code}: {response.text[:200]}")
        except Exception as e:
            results.add_result(f"Unprotected Route: {route['name']}", False, f"Exception: {str(e)}")
    
    # Step 5: Test authentication requirements
    print("\n🔐 Step 5: Test authentication requirements")
    
    # Test without auth header
    try:
        response = requests.get(f"{API_BASE}/billing/me", timeout=10)
        if response.status_code == 401:
            data = response.json()
            if "Missing Authorization header" in data.get("error", ""):
                results.add_result("No Auth Header", True, "401 with correct error message")
            else:
                results.add_result("No Auth Header", False, f"401 but wrong error: {data}")
        else:
            results.add_result("No Auth Header", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        results.add_result("No Auth Header", False, f"Exception: {str(e)}")
    
    # Test with invalid token
    try:
        invalid_headers = {"Authorization": "Bearer invalid-token-123"}
        response = requests.get(f"{API_BASE}/billing/me", headers=invalid_headers, timeout=10)
        if response.status_code == 401:
            data = response.json()
            if "Invalid or expired token" in data.get("error", ""):
                results.add_result("Invalid Token", True, "401 with correct error message")
            else:
                results.add_result("Invalid Token", False, f"401 but wrong error: {data}")
        else:
            results.add_result("Invalid Token", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        results.add_result("Invalid Token", False, f"Exception: {str(e)}")
    
    return results

if __name__ == "__main__":
    print("🚀 Starting Book8 AI Subscription Paywall Tests")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = test_subscription_paywall()
    results.summary()
    
    print(f"\n⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Exit with appropriate code
    exit(0 if results.failed == 0 else 1)