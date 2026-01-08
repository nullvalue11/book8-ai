#!/usr/bin/env python3

import requests
import json
import sys
import os
from datetime import datetime, timedelta

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-admin-tools.preview.emergentagent.com')

def test_endpoint(method, endpoint, expected_status=200, expected_content=None, headers=None, data=None):
    """Test a single endpoint and return result"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == 'OPTIONS':
            response = requests.options(url, headers=headers, timeout=10)
        else:
            return False, f"Unsupported method: {method}"
        
        # Check status code
        if response.status_code != expected_status:
            return False, f"Expected status {expected_status}, got {response.status_code}. Response: {response.text[:200]}"
        
        # Check content if specified
        if expected_content:
            response_text = response.text
            if expected_content not in response_text:
                return False, f"Expected content '{expected_content}' not found in response: {response_text[:200]}"
        
        return True, response.text
        
    except requests.exceptions.RequestException as e:
        return False, f"Request failed: {str(e)}"

def run_focused_review_tests():
    """Run the specific tests requested in the review"""
    
    print("🔍 FOCUSED REVIEW TESTS - App Router Structure and Tavily Endpoints")
    print("=" * 80)
    
    tests = []
    
    # Test 1: GET / -> 200 and contains 'Book8 AI Dashboard'
    print("\n1. Testing GET / -> 200 and contains 'Book8 AI Dashboard'")
    success, result = test_endpoint('GET', '/', 200, 'Book8 AI Dashboard')
    tests.append(('GET /', success, result))
    print(f"   ✅ PASS: Root endpoint working" if success else f"   ❌ FAIL: {result}")
    
    # Test 2: GET /api/search/_selftest -> 200 and JSON with ok:true
    print("\n2. Testing GET /api/search/_selftest -> 200 and JSON with ok:true")
    success, result = test_endpoint('GET', '/api/search/_selftest', 200)
    if success:
        try:
            json_data = json.loads(result)
            if json_data.get('ok') == True:
                print(f"   ✅ PASS: Tavily self-test endpoint working - {json_data}")
            else:
                success = False
                print(f"   ❌ FAIL: JSON response missing ok:true - {json_data}")
        except json.JSONDecodeError:
            success = False
            print(f"   ❌ FAIL: Invalid JSON response - {result[:200]}")
    else:
        print(f"   ❌ FAIL: {result}")
    tests.append(('GET /api/search/_selftest', success, result))
    
    # Test 3: GET /api/test-search -> 200 JSON with 'Test search route working - DEBUG'
    print("\n3. Testing GET /api/test-search -> 200 JSON with 'Test search route working - DEBUG'")
    success, result = test_endpoint('GET', '/api/test-search', 200, 'Test search route working - DEBUG')
    tests.append(('GET /api/test-search', success, result))
    print(f"   ✅ PASS: Test search route working" if success else f"   ❌ FAIL: {result}")
    
    # Test 4: Auth + Booking POST/GET basic flow works
    print("\n4. Testing Auth + Booking POST/GET basic flow")
    
    # Register a test user
    register_data = {
        "email": f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
        "password": "testpass123",
        "name": "Test User"
    }
    
    success, result = test_endpoint('POST', '/api/auth/register', 200, data=register_data)
    if success:
        try:
            auth_response = json.loads(result)
            token = auth_response.get('token')
            if token:
                print(f"   ✅ PASS: User registration successful")
                
                # Test booking creation
                headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
                booking_data = {
                    "title": "Test Booking",
                    "customerName": "Test Customer",
                    "startTime": (datetime.now() + timedelta(hours=1)).isoformat(),
                    "endTime": (datetime.now() + timedelta(hours=2)).isoformat(),
                    "timeZone": "America/New_York"
                }
                
                success, result = test_endpoint('POST', '/api/bookings', 200, headers=headers, data=booking_data)
                if success:
                    try:
                        booking_response = json.loads(result)
                        booking_id = booking_response.get('id')
                        if booking_id:
                            print(f"   ✅ PASS: Booking creation successful - ID: {booking_id}")
                            
                            # Test booking retrieval
                            success, result = test_endpoint('GET', '/api/bookings', 200, headers=headers)
                            if success:
                                try:
                                    bookings = json.loads(result)
                                    if isinstance(bookings, list) and len(bookings) > 0:
                                        print(f"   ✅ PASS: Booking retrieval successful - Found {len(bookings)} bookings")
                                        tests.append(('Auth + Booking Flow', True, 'Complete flow working'))
                                    else:
                                        tests.append(('Auth + Booking Flow', False, 'No bookings found after creation'))
                                        print(f"   ❌ FAIL: No bookings found after creation")
                                except json.JSONDecodeError:
                                    tests.append(('Auth + Booking Flow', False, 'Invalid JSON in bookings response'))
                                    print(f"   ❌ FAIL: Invalid JSON in bookings response")
                            else:
                                tests.append(('Auth + Booking Flow', False, f'Booking retrieval failed: {result}'))
                                print(f"   ❌ FAIL: Booking retrieval failed: {result}")
                        else:
                            tests.append(('Auth + Booking Flow', False, 'No booking ID in response'))
                            print(f"   ❌ FAIL: No booking ID in response")
                    except json.JSONDecodeError:
                        tests.append(('Auth + Booking Flow', False, 'Invalid JSON in booking response'))
                        print(f"   ❌ FAIL: Invalid JSON in booking response")
                else:
                    tests.append(('Auth + Booking Flow', False, f'Booking creation failed: {result}'))
                    print(f"   ❌ FAIL: Booking creation failed: {result}")
            else:
                tests.append(('Auth + Booking Flow', False, 'No token in registration response'))
                print(f"   ❌ FAIL: No token in registration response")
        except json.JSONDecodeError:
            tests.append(('Auth + Booking Flow', False, 'Invalid JSON in registration response'))
            print(f"   ❌ FAIL: Invalid JSON in registration response")
    else:
        tests.append(('Auth + Booking Flow', False, f'Registration failed: {result}'))
        print(f"   ❌ FAIL: Registration failed: {result}")
    
    # Test 5: OPTIONS /api/health -> 200
    print("\n5. Testing OPTIONS /api/health -> 200")
    success, result = test_endpoint('OPTIONS', '/api/health', 200)
    tests.append(('OPTIONS /api/health', success, result))
    print(f"   ✅ PASS: CORS preflight working" if success else f"   ❌ FAIL: {result}")
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 FOCUSED REVIEW TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, success, _ in tests if success)
    total = len(tests)
    
    for test_name, success, result in tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not success:
            print(f"      Error: {result[:100]}...")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL FOCUSED REVIEW TESTS PASSED!")
        return True
    else:
        print("⚠️  SOME FOCUSED REVIEW TESTS FAILED")
        return False

if __name__ == "__main__":
    success = run_focused_review_tests()
    sys.exit(0 if success else 1)