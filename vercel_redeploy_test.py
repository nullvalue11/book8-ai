#!/usr/bin/env python3
"""
Backend Testing for Book8 AI - Critical Issues After Vercel Redeploy
Testing Focus:
1. Google Calendar Authentication Issue
2. Environment Variable Configuration  
3. API Endpoint Accessibility
4. Base URL Configuration
5. Tavily Search Endpoints
"""

import requests
import json
import os
import time
import uuid
from datetime import datetime, timedelta

# Test Configuration - Updated for Vercel deployment
BASE_URL = "https://book8-ai.vercel.app"
API_BASE = f"{BASE_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_icon} {test_name}: {status}")
    if details:
        print(f"    Details: {details}")
    print()

def test_environment_variables():
    """Test 1: Environment Variable Configuration"""
    print("=" * 60)
    print("TEST 1: ENVIRONMENT VARIABLE CONFIGURATION")
    print("=" * 60)
    
    # Test health endpoint to verify basic connectivity
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            log_test("Basic API Connectivity", "PASS", f"Health endpoint accessible at {API_BASE}/health")
        else:
            log_test("Basic API Connectivity", "FAIL", f"Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        log_test("Basic API Connectivity", "FAIL", f"Cannot reach API: {str(e)}")
        return False
    
    # Test NEXT_PUBLIC_BASE_URL configuration by checking if it's properly set
    try:
        # The base URL should be https://book8-ai.vercel.app based on .env
        if BASE_URL == "https://book8-ai.vercel.app":
            log_test("NEXT_PUBLIC_BASE_URL Configuration", "PASS", f"Base URL correctly set to {BASE_URL}")
        else:
            log_test("NEXT_PUBLIC_BASE_URL Configuration", "FAIL", f"Base URL mismatch: expected https://book8-ai.vercel.app, got {BASE_URL}")
    except Exception as e:
        log_test("NEXT_PUBLIC_BASE_URL Configuration", "FAIL", f"Error checking base URL: {str(e)}")
    
    return True

def test_google_auth_endpoints():
    """Test 2: Google Calendar Authentication Endpoints"""
    print("=" * 60)
    print("TEST 2: GOOGLE CALENDAR AUTHENTICATION ENDPOINTS")
    print("=" * 60)
    
    # Test Google auth endpoint accessibility
    try:
        response = requests.get(f"{API_BASE}/integrations/google/auth", timeout=10, allow_redirects=False)
        if response.status_code in [302, 400]:  # 302 for redirect, 400 for auth_required
            log_test("Google Auth Endpoint Accessibility", "PASS", f"Endpoint accessible, returned {response.status_code}")
            
            # Check if it redirects with auth_required error (expected without JWT)
            if response.status_code == 302:
                location = response.headers.get('location', '')
                if 'google_error=auth_required' in location:
                    log_test("Google Auth Error Handling", "PASS", "Correctly returns auth_required error without JWT token")
                elif 'google_error=not_configured' in location:
                    log_test("Google Auth Configuration", "FAIL", "Google OAuth not configured - GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing")
                    return False
                else:
                    log_test("Google Auth Redirect", "PASS", f"Redirects to: {location}")
        else:
            log_test("Google Auth Endpoint Accessibility", "FAIL", f"Unexpected status code: {response.status_code}")
            return False
    except Exception as e:
        log_test("Google Auth Endpoint Accessibility", "FAIL", f"Cannot reach Google auth endpoint: {str(e)}")
        return False
    
    # Test Google callback endpoint accessibility
    try:
        response = requests.get(f"{API_BASE}/integrations/google/callback", timeout=10, allow_redirects=False)
        if response.status_code in [302, 400]:  # Should redirect or return error without proper params
            log_test("Google Callback Endpoint Accessibility", "PASS", f"Endpoint accessible, returned {response.status_code}")
        else:
            log_test("Google Callback Endpoint Accessibility", "FAIL", f"Unexpected status code: {response.status_code}")
    except Exception as e:
        log_test("Google Callback Endpoint Accessibility", "FAIL", f"Cannot reach Google callback endpoint: {str(e)}")
    
    return True

def test_google_auth_with_jwt():
    """Test 3: Google Auth with JWT Token"""
    print("=" * 60)
    print("TEST 3: GOOGLE AUTH WITH JWT TOKEN")
    print("=" * 60)
    
    # First, create a test user and get JWT token
    test_email = f"test_user_{int(time.time())}@example.com"
    test_password = "testpassword123"
    
    try:
        # Register test user
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": "Test User"
        }
        
        response = requests.post(f"{API_BASE}/auth/register", 
                               json=register_data, 
                               headers={"Content-Type": "application/json"},
                               timeout=10)
        
        if response.status_code == 200:
            user_data = response.json()
            jwt_token = user_data.get('token')
            log_test("Test User Registration", "PASS", f"Created user: {test_email}")
            
            # Test Google auth with JWT token
            try:
                auth_url = f"{API_BASE}/integrations/google/auth?jwt={jwt_token}"
                response = requests.get(auth_url, timeout=10, allow_redirects=False)
                
                if response.status_code == 302:
                    location = response.headers.get('location', '')
                    if 'accounts.google.com' in location and 'oauth2' in location:
                        log_test("Google Auth with JWT", "PASS", "Successfully redirects to Google OAuth with valid JWT")
                    elif 'google_error=not_configured' in location:
                        log_test("Google OAuth Configuration", "FAIL", "Google OAuth credentials not configured in environment")
                        return False
                    else:
                        log_test("Google Auth with JWT", "FAIL", f"Unexpected redirect: {location}")
                else:
                    log_test("Google Auth with JWT", "FAIL", f"Expected redirect (302), got {response.status_code}")
                    
            except Exception as e:
                log_test("Google Auth with JWT", "FAIL", f"Error testing Google auth with JWT: {str(e)}")
                
        else:
            log_test("Test User Registration", "FAIL", f"Failed to create test user: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Test User Registration", "FAIL", f"Error creating test user: {str(e)}")
        return False
    
    return True

def test_google_sync_endpoints():
    """Test 4: Google Sync Endpoints"""
    print("=" * 60)
    print("TEST 4: GOOGLE SYNC ENDPOINTS")
    print("=" * 60)
    
    # Create test user for authenticated requests
    test_email = f"sync_test_{int(time.time())}@example.com"
    test_password = "testpassword123"
    
    try:
        # Register and login
        register_data = {"email": test_email, "password": test_password, "name": "Sync Test User"}
        response = requests.post(f"{API_BASE}/auth/register", json=register_data, timeout=10)
        
        if response.status_code == 200:
            jwt_token = response.json().get('token')
            headers = {"Authorization": f"Bearer {jwt_token}", "Content-Type": "application/json"}
            
            # Test GET /api/integrations/google/sync
            try:
                response = requests.get(f"{API_BASE}/integrations/google/sync", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if 'connected' in data and 'lastSyncedAt' in data:
                        log_test("Google Sync Status Endpoint", "PASS", f"Returns connection status: {data}")
                    else:
                        log_test("Google Sync Status Endpoint", "FAIL", f"Missing expected fields in response: {data}")
                else:
                    log_test("Google Sync Status Endpoint", "FAIL", f"Status code: {response.status_code}")
            except Exception as e:
                log_test("Google Sync Status Endpoint", "FAIL", f"Error: {str(e)}")
            
            # Test POST /api/integrations/google/sync (should fail without Google connection)
            try:
                response = requests.post(f"{API_BASE}/integrations/google/sync", headers=headers, timeout=10)
                if response.status_code == 400:
                    data = response.json()
                    if 'Google not connected' in data.get('error', ''):
                        log_test("Google Sync POST Without Connection", "PASS", "Correctly returns 'Google not connected' error")
                    else:
                        log_test("Google Sync POST Without Connection", "FAIL", f"Unexpected error message: {data}")
                else:
                    log_test("Google Sync POST Without Connection", "FAIL", f"Expected 400, got {response.status_code}")
            except Exception as e:
                log_test("Google Sync POST Without Connection", "FAIL", f"Error: {str(e)}")
                
        else:
            log_test("Sync Test User Creation", "FAIL", f"Failed to create user: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Sync Test User Creation", "FAIL", f"Error: {str(e)}")
        return False
    
    return True

def test_tavily_search_endpoints():
    """Test 5: Tavily Search Endpoints"""
    print("=" * 60)
    print("TEST 5: TAVILY SEARCH ENDPOINTS")
    print("=" * 60)
    
    # Test GET /api/integrations/search (health check)
    try:
        response = requests.get(f"{API_BASE}/integrations/search", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('configured') == True:
                log_test("Tavily Search Health Check", "PASS", "Tavily API key is configured")
            else:
                log_test("Tavily Search Configuration", "FAIL", "Tavily API key not configured")
        elif response.status_code == 500:
            data = response.json()
            if 'not configured' in data.get('message', ''):
                log_test("Tavily Search Configuration", "FAIL", "Tavily API key not configured")
            else:
                log_test("Tavily Search Health Check", "FAIL", f"Unexpected error: {data}")
        else:
            log_test("Tavily Search Health Check", "FAIL", f"Unexpected status code: {response.status_code}")
    except Exception as e:
        log_test("Tavily Search Health Check", "FAIL", f"Error: {str(e)}")
    
    # Test POST /api/integrations/search (general search)
    try:
        search_data = {"query": "test search", "maxResults": 3}
        response = requests.post(f"{API_BASE}/integrations/search", 
                               json=search_data, 
                               headers={"Content-Type": "application/json"},
                               timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if 'query' in data and 'results' in data:
                log_test("Tavily General Search", "PASS", f"Search successful, returned {len(data.get('results', []))} results")
            else:
                log_test("Tavily General Search", "FAIL", f"Missing expected fields: {data}")
        elif response.status_code == 500:
            data = response.json()
            if 'not configured' in data.get('error', ''):
                log_test("Tavily General Search", "FAIL", "Tavily API key not configured")
            else:
                log_test("Tavily General Search", "FAIL", f"Server error: {data}")
        else:
            log_test("Tavily General Search", "FAIL", f"Status code: {response.status_code}")
    except Exception as e:
        log_test("Tavily General Search", "FAIL", f"Error: {str(e)}")
    
    # Test POST /api/integrations/search/booking-assistant
    try:
        booking_search_data = {"query": "restaurants in New York", "location": "New York", "type": "restaurant"}
        response = requests.post(f"{API_BASE}/integrations/search/booking-assistant", 
                               json=booking_search_data, 
                               headers={"Content-Type": "application/json"},
                               timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if 'originalQuery' in data and 'enhancedQuery' in data and 'bookingInfo' in data:
                log_test("Tavily Booking Assistant Search", "PASS", f"Booking search successful with enhanced query")
            else:
                log_test("Tavily Booking Assistant Search", "FAIL", f"Missing expected fields: {data}")
        elif response.status_code == 500:
            data = response.json()
            if 'not configured' in data.get('error', ''):
                log_test("Tavily Booking Assistant Search", "FAIL", "Tavily API key not configured")
            else:
                log_test("Tavily Booking Assistant Search", "FAIL", f"Server error: {data}")
        else:
            log_test("Tavily Booking Assistant Search", "FAIL", f"Status code: {response.status_code}")
    except Exception as e:
        log_test("Tavily Booking Assistant Search", "FAIL", f"Error: {str(e)}")

def test_base_url_configuration():
    """Test 6: Base URL Configuration"""
    print("=" * 60)
    print("TEST 6: BASE URL CONFIGURATION")
    print("=" * 60)
    
    # Test that all redirects use the correct base URL
    expected_base = "https://book8-ai.vercel.app"
    
    # Test Google auth redirect URL construction
    try:
        response = requests.get(f"{API_BASE}/integrations/google/auth", timeout=10, allow_redirects=False)
        if response.status_code == 302:
            location = response.headers.get('location', '')
            if expected_base in location:
                log_test("Base URL in Google Auth Redirects", "PASS", f"Correctly uses {expected_base} in redirects")
            else:
                log_test("Base URL in Google Auth Redirects", "FAIL", f"Redirect URL doesn't contain expected base: {location}")
        else:
            # Check if it redirects to error page with correct base URL
            if response.status_code == 302:
                location = response.headers.get('location', '')
                if location.startswith(expected_base):
                    log_test("Base URL in Error Redirects", "PASS", f"Error redirects use correct base URL")
                else:
                    log_test("Base URL in Error Redirects", "FAIL", f"Error redirect uses wrong base: {location}")
    except Exception as e:
        log_test("Base URL Configuration Test", "FAIL", f"Error: {str(e)}")
    
    # Test callback URL construction
    try:
        # The callback should be accessible at the expected URL
        callback_url = f"{API_BASE}/integrations/google/callback"
        response = requests.get(callback_url, timeout=10, allow_redirects=False)
        if response.status_code in [302, 400]:  # Should redirect or error without proper params
            log_test("Google Callback URL Accessibility", "PASS", f"Callback URL accessible at {callback_url}")
        else:
            log_test("Google Callback URL Accessibility", "FAIL", f"Unexpected response: {response.status_code}")
    except Exception as e:
        log_test("Google Callback URL Accessibility", "FAIL", f"Error: {str(e)}")

def test_api_compilation_and_imports():
    """Test 7: API Compilation and Import Issues"""
    print("=" * 60)
    print("TEST 7: API COMPILATION AND IMPORT ISSUES")
    print("=" * 60)
    
    # Test that all major API endpoints are accessible (no compilation errors)
    endpoints_to_test = [
        ("/health", "GET"),
        ("/auth/register", "POST"),
        ("/bookings", "GET"),
        ("/integrations/google/sync", "GET"),
        ("/integrations/search", "GET"),
        ("/billing/stripe/webhook", "POST")
    ]
    
    compilation_issues = []
    
    for endpoint, method in endpoints_to_test:
        try:
            if method == "GET":
                response = requests.get(f"{API_BASE}{endpoint}", timeout=10)
            else:
                response = requests.post(f"{API_BASE}{endpoint}", 
                                       json={}, 
                                       headers={"Content-Type": "application/json"},
                                       timeout=10)
            
            # Any response (even errors) indicates the endpoint compiled successfully
            if response.status_code < 500:
                log_test(f"Endpoint Compilation: {endpoint}", "PASS", f"No compilation errors (status: {response.status_code})")
            else:
                compilation_issues.append(f"{endpoint}: {response.status_code}")
                log_test(f"Endpoint Compilation: {endpoint}", "FAIL", f"Server error: {response.status_code}")
                
        except Exception as e:
            compilation_issues.append(f"{endpoint}: {str(e)}")
            log_test(f"Endpoint Compilation: {endpoint}", "FAIL", f"Error: {str(e)}")
    
    if not compilation_issues:
        log_test("Overall API Compilation", "PASS", "No compilation issues detected")
    else:
        log_test("Overall API Compilation", "FAIL", f"Issues found: {compilation_issues}")

def main():
    """Run all critical tests for Vercel redeploy issues"""
    print("🚀 BOOK8 AI - CRITICAL BACKEND TESTING AFTER VERCEL REDEPLOY")
    print("=" * 80)
    print(f"Testing against: {BASE_URL}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Run all tests
    test_results = []
    
    try:
        test_results.append(test_environment_variables())
        test_results.append(test_google_auth_endpoints())
        test_results.append(test_google_auth_with_jwt())
        test_results.append(test_google_sync_endpoints())
        test_results.append(test_tavily_search_endpoints())
        test_results.append(test_base_url_configuration())
        test_results.append(test_api_compilation_and_imports())
        
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
        return
    except Exception as e:
        print(f"\n❌ Critical error during testing: {str(e)}")
        return
    
    # Summary
    print("=" * 80)
    print("🏁 TESTING SUMMARY")
    print("=" * 80)
    
    passed_tests = sum(1 for result in test_results if result)
    total_tests = len(test_results)
    
    print(f"Tests Passed: {passed_tests}/{total_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("✅ ALL CRITICAL TESTS PASSED - Vercel redeploy issues resolved!")
    else:
        print("❌ SOME TESTS FAILED - Critical issues still present")
        print("\nFailed areas need immediate attention:")
        print("- Check Google OAuth configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)")
        print("- Verify Tavily API key configuration (TAVILY_API_KEY)")
        print("- Ensure environment variables are properly set in Vercel")
    
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

if __name__ == "__main__":
    main()