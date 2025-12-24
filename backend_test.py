#!/usr/bin/env python3
"""
Backend Test Suite for Book8 Stripe Backfill Endpoint

This test suite validates the Stripe backfill endpoint:
- POST /api/admin/stripe/backfill-call-minutes - Backfill call minutes for existing subscriptions

Focus on authentication and response structure validation.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://meter-inspect.preview.emergentagent.com')

# Get admin token from environment (placeholder value expected in test environment)
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'your_admin_token_here')

def test_stripe_backfill_endpoint():
    """Test POST /api/admin/stripe/backfill-call-minutes endpoint"""
    print("\n=== Testing POST /api/admin/stripe/backfill-call-minutes ===")
    
    url = f"{BASE_URL}/api/admin/stripe/backfill-call-minutes"
    
    # Test 1: Missing x-admin-token header
    print("\n1. Testing without x-admin-token header (should return 401)")
    try:
        response = requests.post(url, json={}, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if 'Missing x-admin-token header' in data.get('error', ''):
                print("   ✅ PASS: Correctly returns 401 with missing token error")
            else:
                print(f"   ❌ FAIL: Expected 'Missing x-admin-token header' error, got: {data.get('error')}")
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 2: Invalid x-admin-token
    print("\n2. Testing with invalid x-admin-token (should return 401)")
    try:
        headers = {'x-admin-token': 'invalid-token-123'}
        response = requests.post(url, json={}, headers=headers, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if 'Invalid admin token' in data.get('error', ''):
                print("   ✅ PASS: Correctly returns 401 with invalid token error")
            else:
                print(f"   ❌ FAIL: Expected 'Invalid admin token' error, got: {data.get('error')}")
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 3: Valid x-admin-token (using environment value)
    print(f"\n3. Testing with valid x-admin-token ('{ADMIN_TOKEN}') (should return 200)")
    try:
        headers = {'x-admin-token': ADMIN_TOKEN}
        response = requests.post(url, json={}, headers=headers, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required response fields
            required_fields = ['ok', 'total', 'updated', 'skipped', 'failed', 'failedIds', 'debug']
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                print("   ✅ PASS: Response has all required fields")
                
                # Check debug object structure
                debug = data.get('debug', {})
                debug_fields = ['hasSubId', 'activeOrTrialingOrPastDue', 'hasMinutesItemId', 'missingMinutesItemId', 'selected']
                missing_debug_fields = [field for field in debug_fields if field not in debug]
                
                if not missing_debug_fields:
                    print("   ✅ PASS: Debug object has all required fields")
                    print(f"   Debug counts: {debug}")
                    
                    # Verify all debug values are numbers
                    all_numbers = all(isinstance(debug[field], int) for field in debug_fields)
                    if all_numbers:
                        print("   ✅ PASS: All debug counts are numbers")
                    else:
                        print("   ❌ FAIL: Some debug counts are not numbers")
                        
                    # Check main response structure
                    print(f"   Total: {data.get('total')}")
                    print(f"   Updated: {data.get('updated')}")
                    print(f"   Skipped: {data.get('skipped')}")
                    print(f"   Failed: {data.get('failed')}")
                    print(f"   Failed IDs: {data.get('failedIds')}")
                    
                    # Verify response consistency
                    if data.get('ok') == True:
                        print("   ✅ PASS: Response indicates success (ok: true)")
                    else:
                        print(f"   ❌ FAIL: Expected ok: true, got ok: {data.get('ok')}")
                        
                else:
                    print(f"   ❌ FAIL: Debug object missing fields: {missing_debug_fields}")
            else:
                print(f"   ❌ FAIL: Response missing required fields: {missing_fields}")
                
        elif response.status_code == 400:
            # Might be Stripe configuration issue
            data = response.json()
            error = data.get('error', '')
            if 'Stripe not configured' in error or 'STRIPE_PRICE_CALL_MINUTE_METERED not configured' in error:
                print(f"   ⚠️  EXPECTED: Stripe not configured in test environment - {error}")
            else:
                print(f"   ❌ FAIL: Unexpected 400 error: {error}")
        else:
            print(f"   ❌ FAIL: Expected 200 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 4: OPTIONS request (CORS support)
    print("\n4. Testing OPTIONS request (CORS support)")
    try:
        response = requests.options(url, timeout=10)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 204:
            print("   ✅ PASS: OPTIONS request handled correctly")
        else:
            print(f"   ❌ FAIL: Expected 204 status for OPTIONS, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

def main():
    """Run all tests"""
    print("🔧 Book8 Stripe Backfill Endpoint Test Suite")
    print("=" * 50)
    print(f"Testing against: {BASE_URL}")
    print(f"Using ADMIN_TOKEN: {ADMIN_TOKEN}")
    
    # Test Stripe backfill endpoint
    test_stripe_backfill_endpoint()
    
    print("\n" + "=" * 50)
    print("🏁 Test Suite Complete")
    print("\nNote: This test focuses on authentication and response structure validation.")
    print("The endpoint may return Stripe configuration errors in test environment, which is expected.")

if __name__ == "__main__":
    main()