#!/usr/bin/env python3
"""
Focused Backend Testing - Test what's actually working
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os

BASE_URL = "http://localhost:3000"

def test_basic_functionality():
    """Test the basic functionality that should be working"""
    print("🔍 Testing Basic Functionality")
    print("=" * 50)
    
    results = {}
    
    # Test 1: App Router (Frontend)
    print("\n1. Testing App Router (Frontend)")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        if response.status_code == 200 and 'Book8-AI Dashboard' in response.text:
            print("✅ App Router working - Found 'Book8-AI Dashboard'")
            results['app_router'] = True
        else:
            print(f"❌ App Router issue - Status: {response.status_code}")
            results['app_router'] = False
    except Exception as e:
        print(f"❌ App Router error: {e}")
        results['app_router'] = False
    
    # Test 2: Catch-all API route
    print("\n2. Testing Catch-all API Route")
    try:
        response = requests.get(f"{BASE_URL}/api/test-search", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'Test search route working - DEBUG' in data.get('message', ''):
                print("✅ Catch-all route working")
                results['catch_all'] = True
            else:
                print(f"❌ Catch-all route unexpected response: {data}")
                results['catch_all'] = False
        else:
            print(f"❌ Catch-all route failed: {response.status_code}")
            results['catch_all'] = False
    except Exception as e:
        print(f"❌ Catch-all route error: {e}")
        results['catch_all'] = False
    
    # Test 3: Health endpoints
    print("\n3. Testing Health Endpoints")
    health_endpoints = ['/api/health', '/api', '/api/root']
    health_results = []
    
    for endpoint in health_endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') is True:
                    print(f"✅ {endpoint} working")
                    health_results.append(True)
                else:
                    print(f"❌ {endpoint} unexpected response: {data}")
                    health_results.append(False)
            else:
                print(f"❌ {endpoint} failed: {response.status_code}")
                health_results.append(False)
        except Exception as e:
            print(f"❌ {endpoint} error: {e}")
            health_results.append(False)
    
    results['health_endpoints'] = all(health_results)
    
    # Test 4: Authentication
    print("\n4. Testing Authentication")
    try:
        random_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
        register_data = {
            "email": random_email,
            "password": "testpass123",
            "name": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'token' in data:
                print("✅ Authentication working")
                results['auth'] = True
                results['auth_token'] = data['token']
            else:
                print(f"❌ Authentication missing token: {data}")
                results['auth'] = False
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            results['auth'] = False
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        results['auth'] = False
    
    # Test 5: Basic booking creation (if auth worked)
    if results.get('auth') and results.get('auth_token'):
        print("\n5. Testing Basic Booking Creation")
        try:
            headers = {"Authorization": f"Bearer {results['auth_token']}"}
            start_time = (datetime.now() + timedelta(days=1)).isoformat()
            end_time = (datetime.now() + timedelta(days=1, hours=1)).isoformat()
            
            booking_data = {
                "title": "Test Meeting",
                "customerName": "John Doe",
                "startTime": start_time,
                "endTime": end_time,
                "notes": "Test booking",
                "timeZone": "America/New_York"
            }
            
            response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if 'id' in data:
                    print("✅ Booking creation working")
                    results['booking_create'] = True
                else:
                    print(f"❌ Booking creation missing ID: {data}")
                    results['booking_create'] = False
            else:
                print(f"❌ Booking creation failed: {response.status_code}")
                results['booking_create'] = False
        except Exception as e:
            print(f"❌ Booking creation error: {e}")
            results['booking_create'] = False
    else:
        print("\n5. Skipping Booking Creation (auth failed)")
        results['booking_create'] = False
    
    # Test 6: Check if Tavily routes exist (even if they return errors)
    print("\n6. Testing Tavily Route Existence")
    tavily_routes = [
        '/api/search/_selftest',
        '/api/search',
        '/api/search/booking-assistant'
    ]
    
    tavily_results = []
    for route in tavily_routes:
        try:
            response = requests.get(f"{BASE_URL}{route}", timeout=5)
            if response.status_code == 404:
                print(f"❌ {route} not found (404)")
                tavily_results.append(False)
            else:
                print(f"✅ {route} exists (status: {response.status_code})")
                tavily_results.append(True)
        except Exception as e:
            print(f"❌ {route} error: {e}")
            tavily_results.append(False)
    
    results['tavily_routes_exist'] = any(tavily_results)
    
    # Test 7: CORS/OPTIONS
    print("\n7. Testing CORS/OPTIONS")
    try:
        response = requests.options(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ CORS/OPTIONS working")
            results['cors'] = True
        else:
            print(f"❌ CORS/OPTIONS failed: {response.status_code}")
            results['cors'] = False
    except Exception as e:
        print(f"❌ CORS/OPTIONS error: {e}")
        results['cors'] = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 FOCUSED TEST RESULTS")
    print("=" * 50)
    
    passed = 0
    total = 0
    
    for test_name, result in results.items():
        if test_name != 'auth_token':  # Skip the token field
            total += 1
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}: {test_name.replace('_', ' ').title()}")
            if result:
                passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    return results

if __name__ == "__main__":
    results = test_basic_functionality()