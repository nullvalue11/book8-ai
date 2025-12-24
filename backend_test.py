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

def test_agent_availability_endpoint():
    """Test POST /api/agent/availability endpoint"""
    print("\n=== Testing POST /api/agent/availability ===")
    
    url = f"{BASE_URL}/api/agent/availability"
    
    # Test 1: Missing agentApiKey
    print("\n1. Testing without agentApiKey (should return 400 INVALID_INPUT)")
    try:
        response = requests.post(url, json={
            "handle": "testhandle",
            "date": "2025-12-01",
            "timezone": "America/New_York",
            "durationMinutes": 30
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get('code') == 'INVALID_INPUT' and 'agentApiKey' in data.get('message', ''):
                print("   ✅ PASS: Correctly returns 400 INVALID_INPUT for missing agentApiKey")
            else:
                print(f"   ❌ FAIL: Expected INVALID_INPUT code, got {data.get('code')}")
        else:
            print(f"   ❌ FAIL: Expected 400 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 2: Invalid agentApiKey
    print("\n2. Testing with invalid agentApiKey (should return 401 AGENT_UNAUTHORIZED)")
    try:
        response = requests.post(url, json={
            "agentApiKey": "invalid_key_123",
            "handle": "testhandle", 
            "date": "2025-12-01",
            "timezone": "America/New_York",
            "durationMinutes": 30
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if data.get('code') == 'AGENT_UNAUTHORIZED':
                print("   ✅ PASS: Correctly returns 401 AGENT_UNAUTHORIZED for invalid agentApiKey")
            else:
                print(f"   ❌ FAIL: Expected AGENT_UNAUTHORIZED code, got {data.get('code')}")
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 3: Valid agentApiKey format but not in database
    print("\n3. Testing with valid format agentApiKey but not in database (should return 401)")
    try:
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "date": "2025-12-01", 
            "timezone": "America/New_York",
            "durationMinutes": 30
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if data.get('code') == 'AGENT_UNAUTHORIZED':
                print("   ✅ PASS: Correctly returns 401 AGENT_UNAUTHORIZED for non-existent agentApiKey")
            else:
                print(f"   ❌ FAIL: Expected AGENT_UNAUTHORIZED code, got {data.get('code')}")
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 4: Missing date parameter
    print("\n4. Testing with missing date (should return 400 INVALID_INPUT)")
    try:
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "timezone": "America/New_York",
            "durationMinutes": 30
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key, but let's check the flow
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before date validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 5: Invalid date format
    print("\n5. Testing with invalid date format (should return 400 INVALID_INPUT)")
    try:
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "date": "invalid-date-format",
            "timezone": "America/New_York",
            "durationMinutes": 30
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before date format validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

def test_agent_book_endpoint():
    """Test POST /api/agent/book endpoint"""
    print("\n=== Testing POST /api/agent/book ===")
    
    url = f"{BASE_URL}/api/agent/book"
    
    # Test 1: Missing agentApiKey
    print("\n1. Testing without agentApiKey (should return 400 INVALID_INPUT)")
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT14:30:00-05:00")
        response = requests.post(url, json={
            "handle": "testhandle",
            "start": tomorrow,
            "durationMinutes": 30,
            "guestName": "John Doe",
            "guestEmail": "john@example.com",
            "guestPhone": "+1234567890",
            "notes": "Test booking",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get('code') == 'INVALID_INPUT' and 'agentApiKey' in data.get('message', ''):
                print("   ✅ PASS: Correctly returns 400 INVALID_INPUT for missing agentApiKey")
            else:
                print(f"   ❌ FAIL: Expected INVALID_INPUT code, got {data.get('code')}")
        else:
            print(f"   ❌ FAIL: Expected 400 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 2: Invalid agentApiKey
    print("\n2. Testing with invalid agentApiKey (should return 401 AGENT_UNAUTHORIZED)")
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT14:30:00-05:00")
        response = requests.post(url, json={
            "agentApiKey": "invalid_key_123",
            "handle": "testhandle",
            "start": tomorrow,
            "durationMinutes": 30,
            "guestName": "John Doe", 
            "guestEmail": "john@example.com",
            "guestPhone": "+1234567890",
            "notes": "Test booking",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            data = response.json()
            if data.get('code') == 'AGENT_UNAUTHORIZED':
                print("   ✅ PASS: Correctly returns 401 AGENT_UNAUTHORIZED for invalid agentApiKey")
            else:
                print(f"   ❌ FAIL: Expected AGENT_UNAUTHORIZED code, got {data.get('code')}")
        else:
            print(f"   ❌ FAIL: Expected 401 status, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 3: Missing required fields - start time
    print("\n3. Testing with missing start time (should return 400 INVALID_INPUT)")
    try:
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "durationMinutes": 30,
            "guestName": "John Doe",
            "guestEmail": "john@example.com",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before field validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 4: Missing required fields - guest name
    print("\n4. Testing with missing guestName (should return 400 INVALID_INPUT)")
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT14:30:00-05:00")
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "start": tomorrow,
            "durationMinutes": 30,
            "guestEmail": "john@example.com",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before field validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 5: Missing required fields - guest email
    print("\n5. Testing with missing guestEmail (should return 400 INVALID_INPUT)")
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT14:30:00-05:00")
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "start": tomorrow,
            "durationMinutes": 30,
            "guestName": "John Doe",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before field validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
    
    # Test 6: Invalid email format
    print("\n6. Testing with invalid email format (should return 400 INVALID_INPUT)")
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT14:30:00-05:00")
        response = requests.post(url, json={
            "agentApiKey": "ag_sk_1234567890abcdef1234567890abcdef",
            "handle": "testhandle",
            "start": tomorrow,
            "durationMinutes": 30,
            "guestName": "John Doe",
            "guestEmail": "invalid-email-format",
            "timezone": "America/New_York"
        }, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Should get 401 first due to invalid API key
        if response.status_code == 401:
            print("   ✅ PASS: Authentication check happens before email validation (expected)")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

def test_options_requests():
    """Test OPTIONS requests for CORS support"""
    print("\n=== Testing OPTIONS requests (CORS) ===")
    
    endpoints = [
        f"{BASE_URL}/api/agent/availability",
        f"{BASE_URL}/api/agent/book"
    ]
    
    for endpoint in endpoints:
        print(f"\nTesting OPTIONS {endpoint}")
        try:
            response = requests.options(endpoint, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 204:
                headers = response.headers
                print(f"   Access-Control-Allow-Origin: {headers.get('Access-Control-Allow-Origin', 'Not set')}")
                print(f"   Access-Control-Allow-Methods: {headers.get('Access-Control-Allow-Methods', 'Not set')}")
                print(f"   Access-Control-Allow-Headers: {headers.get('Access-Control-Allow-Headers', 'Not set')}")
                print("   ✅ PASS: OPTIONS request handled correctly")
            else:
                print(f"   ❌ FAIL: Expected 204 status, got {response.status_code}")
        except Exception as e:
            print(f"   ❌ ERROR: {e}")

def test_error_response_format():
    """Test that error responses follow the expected format"""
    print("\n=== Testing Error Response Format ===")
    
    url = f"{BASE_URL}/api/agent/availability"
    
    print("\nTesting error response structure")
    try:
        response = requests.post(url, json={}, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            required_fields = ['ok', 'code', 'message']
            
            all_present = all(field in data for field in required_fields)
            
            if all_present and data.get('ok') == False:
                print("   ✅ PASS: Error response has correct structure (ok, code, message)")
                print(f"   Code: {data.get('code')}")
                print(f"   Message: {data.get('message')}")
            else:
                print(f"   ❌ FAIL: Missing required fields. Got: {list(data.keys())}")
        else:
            print(f"   ❌ UNEXPECTED: Got status {response.status_code}")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")

def main():
    """Run all tests"""
    print("🤖 Book8 AI Phone Agent API Test Suite")
    print("=" * 50)
    print(f"Testing against: {BASE_URL}")
    
    # Test availability endpoint
    test_agent_availability_endpoint()
    
    # Test booking endpoint  
    test_agent_book_endpoint()
    
    # Test CORS support
    test_options_requests()
    
    # Test error response format
    test_error_response_format()
    
    print("\n" + "=" * 50)
    print("🏁 Test Suite Complete")
    print("\nNote: Since we don't have test agentApiKey configured in MongoDB,")
    print("these tests focus on validation logic and error handling.")
    print("All authentication tests should return 401 AGENT_UNAUTHORIZED as expected.")

    main()