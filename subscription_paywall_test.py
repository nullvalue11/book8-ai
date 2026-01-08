#!/usr/bin/env python3
"""
Subscription Paywall Test Suite for Book8 AI

This test suite validates the subscription paywall implementation:
1. GET /api/billing/me - Subscription status endpoint
2. GET /api/integrations/google/auth - Google OAuth endpoint (should block non-subscribed users)

Test Cases:
1. Billing Me - Missing Token: GET /api/billing/me without Authorization header
2. Billing Me - Valid Token: GET /api/billing/me with valid Bearer token
3. Google Auth - Non-subscribed User: GET /api/integrations/google/auth?jwt=<token> for user without subscription

Focus on authentication, subscription status validation, and paywall enforcement.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os
import uuid

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-admin-tools.preview.emergentagent.com')

def register_test_user():
    """Register a new test user and return JWT token"""
    print("\n=== Registering Test User ===")
    
    # Generate unique email for test user
    test_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    test_password = "TestPassword123!"
    
    url = f"{BASE_URL}/api/auth/register"
    payload = {
        "email": test_email,
        "password": test_password,
        "name": "Test User"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"   Registration Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('token'):
                print(f"   ✅ User registered successfully: {test_email}")
                print(f"   JWT Token: {data['token'][:20]}...")
                return data['token'], test_email
            else:
                print(f"   ❌ Registration failed: {data}")
                return None, None
        else:
            print(f"   ❌ Registration failed with status {response.status_code}: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"   ❌ Registration error: {e}")
        return None, None

def test_billing_me_missing_token():
    """Test GET /api/billing/me without Authorization header"""
    print("\n=== Test 1: Billing Me - Missing Token ===")
    
    url = f"{BASE_URL}/api/billing/me"
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if 'Missing Authorization header' in data.get('error', ''):
                print("   ✅ PASS: Correctly returns 401 with missing Authorization header error")
                return True
            else:
                print(f"   ❌ FAIL: Expected 'Missing Authorization header' error, got: {data.get('error')}")
                return False
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False

def test_billing_me_valid_token(jwt_token):
    """Test GET /api/billing/me with valid Bearer token"""
    print("\n=== Test 2: Billing Me - Valid Token ===")
    
    url = f"{BASE_URL}/api/billing/me"
    headers = {
        "Authorization": f"Bearer {jwt_token}"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Validate response structure
            required_fields = ['ok', 'subscribed', 'subscription']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"   ❌ FAIL: Missing required fields: {missing_fields}")
                return False
            
            if data.get('ok') != True:
                print(f"   ❌ FAIL: Expected ok=true, got ok={data.get('ok')}")
                return False
            
            # For new user, should have subscribed=false
            if data.get('subscribed') != False:
                print(f"   ❌ FAIL: Expected subscribed=false for new user, got subscribed={data.get('subscribed')}")
                return False
            
            # Validate subscription object structure
            subscription = data.get('subscription', {})
            expected_subscription_fields = [
                'subscribed', 'status', 'stripeCustomerId', 'stripeSubscriptionId',
                'stripeCallMinutesItemId', 'stripePriceId', 'currentPeriodStart', 'currentPeriodEnd'
            ]
            
            missing_sub_fields = [field for field in expected_subscription_fields if field not in subscription]
            if missing_sub_fields:
                print(f"   ❌ FAIL: Missing subscription fields: {missing_sub_fields}")
                return False
            
            # For new user, subscription fields should be null/false
            if subscription.get('subscribed') != False:
                print(f"   ❌ FAIL: Expected subscription.subscribed=false, got {subscription.get('subscribed')}")
                return False
            
            print("   ✅ PASS: Valid response structure with ok=true and subscription details")
            print(f"   Subscription Status: {subscription}")
            return True
            
        else:
            print(f"   ❌ FAIL: Expected 200 status, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False

def test_google_auth_non_subscribed_user(jwt_token):
    """Test GET /api/integrations/google/auth?jwt=<token> for non-subscribed user"""
    print("\n=== Test 3: Google Auth - Non-subscribed User ===")
    
    url = f"{BASE_URL}/api/integrations/google/auth?jwt={jwt_token}"
    
    try:
        # Don't follow redirects so we can check the Location header
        response = requests.get(url, allow_redirects=False, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code in [302, 307]:  # Redirect status codes
            location = response.headers.get('Location', '')
            print(f"   Redirect Location: {location}")
            
            # Should redirect to /pricing?paywall=1&feature=calendar
            expected_redirect_path = "/pricing?paywall=1&feature=calendar"
            
            if expected_redirect_path in location:
                print("   ✅ PASS: Correctly redirects non-subscribed user to pricing page with paywall parameters")
                return True
            else:
                print(f"   ❌ FAIL: Expected redirect to contain '{expected_redirect_path}', got: {location}")
                return False
        elif response.status_code == 520:
            # 520 might be a temporary server error, let's retry once
            print("   ⚠️  Got 520 error, retrying once...")
            import time
            time.sleep(2)
            response = requests.get(url, allow_redirects=False, timeout=30)
            
            if response.status_code in [302, 307]:
                location = response.headers.get('Location', '')
                print(f"   Retry Status: {response.status_code}")
                print(f"   Retry Redirect Location: {location}")
                
                expected_redirect_path = "/pricing?paywall=1&feature=calendar"
                if expected_redirect_path in location:
                    print("   ✅ PASS: Correctly redirects non-subscribed user to pricing page with paywall parameters (after retry)")
                    return True
                else:
                    print(f"   ❌ FAIL: Expected redirect to contain '{expected_redirect_path}', got: {location}")
                    return False
            else:
                print(f"   ❌ FAIL: Still getting error after retry: {response.status_code}")
                return False
        else:
            print(f"   ❌ FAIL: Expected redirect status (302/307), got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False

def test_google_auth_missing_jwt():
    """Test GET /api/integrations/google/auth without JWT token"""
    print("\n=== Test 4: Google Auth - Missing JWT ===")
    
    url = f"{BASE_URL}/api/integrations/google/auth"
    
    try:
        # Don't follow redirects so we can check the Location header
        response = requests.get(url, allow_redirects=False, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code in [302, 307]:  # Redirect status codes
            location = response.headers.get('Location', '')
            print(f"   Redirect Location: {location}")
            
            # Should redirect with auth_required error
            if "google_error=auth_required" in location:
                print("   ✅ PASS: Correctly redirects with auth_required error when JWT missing")
                return True
            else:
                print(f"   ❌ FAIL: Expected redirect with 'google_error=auth_required', got: {location}")
                return False
        elif response.status_code == 520:
            # 520 might be a temporary server error, let's retry once
            print("   ⚠️  Got 520 error, retrying once...")
            import time
            time.sleep(2)
            response = requests.get(url, allow_redirects=False, timeout=30)
            
            if response.status_code in [302, 307]:
                location = response.headers.get('Location', '')
                print(f"   Retry Status: {response.status_code}")
                print(f"   Retry Redirect Location: {location}")
                
                if "google_error=auth_required" in location:
                    print("   ✅ PASS: Correctly redirects with auth_required error when JWT missing (after retry)")
                    return True
                else:
                    print(f"   ❌ FAIL: Expected redirect with 'google_error=auth_required', got: {location}")
                    return False
            else:
                print(f"   ❌ FAIL: Still getting error after retry: {response.status_code}")
                return False
        else:
            print(f"   ❌ FAIL: Expected redirect status (302/307), got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        return False

def run_all_tests():
    """Run all subscription paywall tests"""
    print("🔒 SUBSCRIPTION PAYWALL TEST SUITE")
    print("=" * 50)
    
    # Step 1: Register test user
    jwt_token, test_email = register_test_user()
    if not jwt_token:
        print("\n❌ CRITICAL: Cannot proceed without valid JWT token")
        return False
    
    # Step 2: Run all tests
    test_results = []
    
    test_results.append(test_billing_me_missing_token())
    test_results.append(test_billing_me_valid_token(jwt_token))
    test_results.append(test_google_auth_non_subscribed_user(jwt_token))
    test_results.append(test_google_auth_missing_jwt())
    
    # Summary
    passed = sum(test_results)
    total = len(test_results)
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Subscription paywall implementation is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)