#!/usr/bin/env python3
"""
Focused test for POST /api/bookings 500 error debugging
"""

import requests
import json
import os
from datetime import datetime, timedelta
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

def log(message):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def test_booking_creation_500():
    """Test POST /api/bookings to capture 500 error details"""
    log(f"Testing POST /api/bookings against {API_BASE}")
    log("=" * 60)
    
    session = requests.Session()
    
    # Step 1: Register a test user
    log("Step 1: Registering test user...")
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    test_password = "TestPassword123!"
    
    try:
        register_url = f"{API_BASE}/auth/register"
        register_payload = {
            "email": test_email,
            "password": test_password,
            "name": "Test User"
        }
        
        register_response = session.post(register_url, json=register_payload, timeout=10)
        log(f"Register response status: {register_response.status_code}")
        
        if register_response.status_code == 200:
            register_data = register_response.json()
            auth_token = register_data.get('token')
            log(f"✅ Registration successful, got token: {auth_token[:20]}...")
        else:
            log(f"❌ Registration failed: {register_response.text}")
            return
            
    except Exception as e:
        log(f"❌ Registration error: {str(e)}")
        return
    
    # Step 2: Test POST /api/bookings with detailed error capture
    log("Step 2: Testing POST /api/bookings...")
    
    try:
        booking_url = f"{API_BASE}/bookings"
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Create booking for tomorrow
        start_time = datetime.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=1)
        
        booking_payload = {
            "title": "Test Booking for 500 Debug",
            "customerName": "John Doe",
            "startTime": start_time.isoformat(),
            "endTime": end_time.isoformat(),
            "notes": "Test booking to debug 500 error",
            "timeZone": "UTC"
        }
        
        log(f"Booking URL: {booking_url}")
        log(f"Headers: {headers}")
        log(f"Payload: {json.dumps(booking_payload, indent=2)}")
        
        booking_response = session.post(booking_url, json=booking_payload, headers=headers, timeout=15)
        
        log(f"Response status: {booking_response.status_code}")
        log(f"Response headers: {dict(booking_response.headers)}")
        
        if booking_response.status_code == 500:
            log("🔍 CAPTURED 500 ERROR!")
            log(f"Response text: {booking_response.text}")
            
            try:
                error_data = booking_response.json()
                log(f"Error JSON: {json.dumps(error_data, indent=2)}")
            except:
                log("Response is not valid JSON")
                
        elif booking_response.status_code == 200:
            log("✅ Booking creation successful!")
            booking_data = booking_response.json()
            log(f"Booking data: {json.dumps(booking_data, indent=2)}")
            
        else:
            log(f"❌ Unexpected status code: {booking_response.status_code}")
            log(f"Response: {booking_response.text}")
            
    except Exception as e:
        log(f"❌ Booking creation error: {str(e)}")
        import traceback
        log(f"Full traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    test_booking_creation_500()