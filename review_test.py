#!/usr/bin/env python3
"""
Review-specific Backend Testing for Book8 AI MVP
Tests the specific requirements from the review request:
1. App Router presence: GET / should return 200 with 'Book8 AI Dashboard' text
2. Tavily self-test endpoint: GET /api/search/_selftest returns JSON { ok: true, tavilyKeyPresent: boolean } and HTTP 200
3. Catch-all placeholder: GET /api/test-search returns JSON with message containing 'Test search route working - DEBUG'
4. Booking CRUD smoke without external keys
5. CORS/OPTIONS: OPTIONS /api/health (or /api) returns 200
"""

import requests
import json
import uuid
import time
from datetime import datetime, timedelta
import os

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://book8-success.preview.emergentagent.com')
print(f"Testing against: {BASE_URL}")

def test_app_router_presence():
    """Test 1: App Router presence - GET / should return 200 with 'Book8 AI Dashboard' text"""
    print("\n=== Test 1: App Router Presence ===")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        print(f"GET / -> Status: {response.status_code}")
        
        if response.status_code == 200:
            content = response.text
            if 'Book8 AI Dashboard' in content:
                print("✅ PASS: Found 'Book8 AI Dashboard' text in response")
                return True
            else:
                print("❌ FAIL: 'Book8 AI Dashboard' text not found in response")
                print(f"Response content preview: {content[:500]}...")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_tavily_selftest():
    """Test 2: Tavily self-test endpoint"""
    print("\n=== Test 2: Tavily Self-Test Endpoint ===")
    try:
        response = requests.get(f"{BASE_URL}/api/search/_selftest", timeout=10)
        print(f"GET /api/search/_selftest -> Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            if data.get('ok') is True and 'tavilyKeyPresent' in data:
                print("✅ PASS: Self-test endpoint returns correct JSON structure")
                print(f"   - ok: {data.get('ok')}")
                print(f"   - tavilyKeyPresent: {data.get('tavilyKeyPresent')}")
                return True
            else:
                print("❌ FAIL: Missing required fields (ok: true, tavilyKeyPresent)")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            try:
                print(f"Response: {response.text}")
            except:
                pass
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_catch_all_placeholder():
    """Test 3: Catch-all placeholder route"""
    print("\n=== Test 3: Catch-all Placeholder Route ===")
    try:
        response = requests.get(f"{BASE_URL}/api/test-search", timeout=10)
        print(f"GET /api/test-search -> Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            message = data.get('message', '')
            if 'Test search route working - DEBUG' in message:
                print("✅ PASS: Catch-all route returns expected debug message")
                return True
            else:
                print(f"❌ FAIL: Expected message containing 'Test search route working - DEBUG', got: {message}")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            try:
                print(f"Response: {response.text}")
            except:
                pass
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_cors_options():
    """Test 5: CORS/OPTIONS support"""
    print("\n=== Test 5: CORS/OPTIONS Support ===")
    try:
        response = requests.options(f"{BASE_URL}/api/health", timeout=10)
        print(f"OPTIONS /api/health -> Status: {response.status_code}")
        
        if response.status_code == 200:
            headers = response.headers
            print("✅ PASS: OPTIONS request returns 200")
            print(f"   - Access-Control-Allow-Origin: {headers.get('Access-Control-Allow-Origin', 'Not set')}")
            print(f"   - Access-Control-Allow-Methods: {headers.get('Access-Control-Allow-Methods', 'Not set')}")
            return True
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_booking_crud_smoke():
    """Test 4: Booking CRUD smoke test without external keys"""
    print("\n=== Test 4: Booking CRUD Smoke Test ===")
    
    # Step 1: Register a user
    print("\n--- Step 1: User Registration ---")
    random_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    register_data = {
        "email": random_email,
        "password": "testpass123",
        "name": "Test User"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data, timeout=10)
        print(f"POST /api/auth/register -> Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print("✅ PASS: User registration successful, token received")
                print(f"   - Email: {random_email}")
                print(f"   - Token: {token[:20]}...")
            else:
                print("❌ FAIL: No token in registration response")
                return False
        else:
            print(f"❌ FAIL: Registration failed with status {response.status_code}")
            try:
                print(f"Response: {response.text}")
            except:
                pass
            return False
    except Exception as e:
        print(f"❌ ERROR during registration: {e}")
        return False
    
    # Step 2: Create a booking
    print("\n--- Step 2: Create Booking ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create booking with valid ISO times
    start_time = (datetime.now() + timedelta(days=1)).isoformat()
    end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
    
    booking_data = {
        "title": "Test Meeting",
        "customerName": "John Doe",
        "startTime": start_time,
        "endTime": end_time,
        "notes": "Test booking for backend verification",
        "timeZone": "America/New_York"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers, timeout=10)
        print(f"POST /api/bookings -> Status: {response.status_code}")
        
        if response.status_code == 200:
            booking = response.json()
            booking_id = booking.get('id')
            if booking_id:
                print("✅ PASS: Booking creation successful")
                print(f"   - Booking ID: {booking_id}")
                print(f"   - Title: {booking.get('title')}")
                print(f"   - Status: {booking.get('status')}")
            else:
                print("❌ FAIL: No booking ID in response")
                return False
        else:
            print(f"❌ FAIL: Booking creation failed with status {response.status_code}")
            try:
                print(f"Response: {response.text}")
            except:
                pass
            return False
    except Exception as e:
        print(f"❌ ERROR during booking creation: {e}")
        return False
    
    # Step 3: Get bookings list
    print("\n--- Step 3: Get Bookings List ---")
    try:
        response = requests.get(f"{BASE_URL}/api/bookings", headers=headers, timeout=10)
        print(f"GET /api/bookings -> Status: {response.status_code}")
        
        if response.status_code == 200:
            bookings = response.json()
            if isinstance(bookings, list):
                print(f"✅ PASS: Retrieved bookings list with {len(bookings)} items")
                
                # Check if our created booking is in the list
                created_booking = next((b for b in bookings if b.get('id') == booking_id), None)
                if created_booking:
                    print("✅ PASS: Created booking found in list")
                    print(f"   - Title: {created_booking.get('title')}")
                    print(f"   - Status: {created_booking.get('status')}")
                else:
                    print("❌ FAIL: Created booking not found in list")
                    return False
            else:
                print("❌ FAIL: Expected array response")
                return False
        else:
            print(f"❌ FAIL: Get bookings failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ ERROR during get bookings: {e}")
        return False
    
    print("✅ PASS: All booking CRUD operations successful")
    return True

def run_review_tests():
    """Run all review-specific backend tests"""
    print("🚀 Starting Review-Specific Backend Testing Suite")
    print("=" * 60)
    
    tests = [
        ("App Router Presence", test_app_router_presence),
        ("Tavily Self-Test", test_tavily_selftest),
        ("Catch-all Placeholder", test_catch_all_placeholder),
        ("Booking CRUD Smoke", test_booking_crud_smoke),
        ("CORS/OPTIONS", test_cors_options),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ CRITICAL ERROR in {test_name}: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 REVIEW TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL REVIEW TESTS PASSED! Backend verification successful.")
        return True
    else:
        print("⚠️  Some tests failed. Check logs above for details.")
        return False

if __name__ == "__main__":
    success = run_review_tests()
    exit(0 if success else 1)