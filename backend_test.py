#!/usr/bin/env python3
"""
Backend API Tests for Book8 AI MVP
Tests all backend endpoints according to test_result.md requirements
"""

import requests
import json
import os
import sys
from datetime import datetime, timedelta
import uuid

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        self.test_user_password = "TestPassword123!"
        self.test_user_name = "Test User"
        self.created_booking_id = None
        self.results = {
            'health_endpoints': False,
            'auth_register': False,
            'auth_login': False,
            'bookings_get_empty': False,
            'bookings_create': False,
            'bookings_list_with_data': False,
            'bookings_cancel': False,
            'integration_stubs': False,
            'cors_preflight': False,
            'google_calendar_sync_get': False,
            'google_calendar_dynamic_imports': False
        }
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_health_endpoints(self):
        """Test GET /api, /api/root, /api/health returns ok:true"""
        self.log("Testing health endpoints...")
        
        endpoints = ['/api', '/api/root', '/api/health']
        all_passed = True
        
        for endpoint in endpoints:
            try:
                url = f"{BASE_URL}{endpoint}"
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('ok') is True:
                        self.log(f"✅ {endpoint} returned ok:true")
                    else:
                        self.log(f"❌ {endpoint} returned ok:{data.get('ok')}")
                        all_passed = False
                else:
                    self.log(f"❌ {endpoint} returned status {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"❌ {endpoint} failed with error: {str(e)}")
                all_passed = False
                
        self.results['health_endpoints'] = all_passed
        return all_passed
        
    def test_auth_register(self):
        """Test POST /api/auth/register with email/password returns token"""
        self.log("Testing user registration...")
        
        try:
            url = f"{API_BASE}/auth/register"
            payload = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": self.test_user_name
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.auth_token = data['token']
                    self.log(f"✅ Registration successful, got token")
                    self.results['auth_register'] = True
                    return True
                else:
                    self.log(f"❌ Registration response missing token or user: {data}")
            else:
                self.log(f"❌ Registration failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Registration failed with error: {str(e)}")
            
        self.results['auth_register'] = False
        return False
        
    def test_auth_login(self):
        """Test POST /api/auth/login returns token"""
        self.log("Testing user login...")
        
        try:
            url = f"{API_BASE}/auth/login"
            payload = {
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and 'user' in data:
                    # Update token from login
                    self.auth_token = data['token']
                    self.log(f"✅ Login successful, got token")
                    self.results['auth_login'] = True
                    return True
                else:
                    self.log(f"❌ Login response missing token or user: {data}")
            else:
                self.log(f"❌ Login failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Login failed with error: {str(e)}")
            
        self.results['auth_login'] = False
        return False
        
    def test_bookings_get_empty(self):
        """Test GET /api/bookings with Bearer token returns []"""
        self.log("Testing empty bookings list...")
        
        if not self.auth_token:
            self.log("❌ No auth token available for bookings test")
            return False
            
        try:
            url = f"{API_BASE}/bookings"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 0:
                    self.log(f"✅ Empty bookings list returned correctly")
                    self.results['bookings_get_empty'] = True
                    return True
                else:
                    self.log(f"❌ Expected empty array, got: {data}")
            else:
                self.log(f"❌ Bookings GET failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Bookings GET failed with error: {str(e)}")
            
        self.results['bookings_get_empty'] = False
        return False
        
    def test_bookings_create(self):
        """Test POST /api/bookings with title, startTime, endTime returns booking with id"""
        self.log("Testing booking creation...")
        
        if not self.auth_token:
            self.log("❌ No auth token available for booking creation")
            return False
            
        try:
            url = f"{API_BASE}/bookings"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Create booking for tomorrow
            start_time = datetime.now() + timedelta(days=1)
            end_time = start_time + timedelta(hours=1)
            
            payload = {
                "title": "Test Booking",
                "customerName": "John Doe",
                "startTime": start_time.isoformat(),
                "endTime": end_time.isoformat(),
                "notes": "Test booking created by automated test"
            }
            
            response = self.session.post(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data.get('title') == payload['title']:
                    self.created_booking_id = data['id']
                    self.log(f"✅ Booking created successfully with id: {self.created_booking_id}")
                    self.results['bookings_create'] = True
                    return True
                else:
                    self.log(f"❌ Booking creation response missing id or incorrect data: {data}")
            else:
                self.log(f"❌ Booking creation failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Booking creation failed with error: {str(e)}")
            
        self.results['bookings_create'] = False
        return False
        
    def test_bookings_list_with_data(self):
        """Test that GET /api/bookings now contains the created booking"""
        self.log("Testing bookings list contains created booking...")
        
        if not self.auth_token or not self.created_booking_id:
            self.log("❌ No auth token or booking ID available")
            return False
            
        try:
            url = f"{API_BASE}/bookings"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Check if our created booking is in the list
                    booking_found = any(booking.get('id') == self.created_booking_id for booking in data)
                    if booking_found:
                        self.log(f"✅ Created booking found in bookings list")
                        self.results['bookings_list_with_data'] = True
                        return True
                    else:
                        self.log(f"❌ Created booking not found in list: {data}")
                else:
                    self.log(f"❌ Expected non-empty array, got: {data}")
            else:
                self.log(f"❌ Bookings list failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Bookings list failed with error: {str(e)}")
            
        self.results['bookings_list_with_data'] = False
        return False
        
    def test_bookings_cancel(self):
        """Test DELETE /api/bookings/:id returns status canceled"""
        self.log("Testing booking cancellation...")
        
        if not self.auth_token or not self.created_booking_id:
            self.log("❌ No auth token or booking ID available")
            return False
            
        try:
            url = f"{API_BASE}/bookings/{self.created_booking_id}"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.delete(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'canceled':
                    self.log(f"✅ Booking canceled successfully")
                    self.results['bookings_cancel'] = True
                    return True
                else:
                    self.log(f"❌ Booking cancel response incorrect status: {data}")
            else:
                self.log(f"❌ Booking cancel failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Booking cancel failed with error: {str(e)}")
            
        self.results['bookings_cancel'] = False
        return False
        
    def test_integration_stubs(self):
        """Test stub integrations require auth and return ok true"""
        self.log("Testing integration stubs...")
        
        if not self.auth_token:
            self.log("❌ No auth token available for integration tests")
            return False
            
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        stubs = [
            ('/integrations/google/sync', 'POST'),
            ('/integrations/voice/call', 'POST'),
            ('/integrations/search', 'POST'),
            ('/workflows/n8n/trigger', 'POST')
        ]
        
        all_passed = True
        
        for endpoint, method in stubs:
            try:
                url = f"{API_BASE}{endpoint}"
                
                if method == 'POST':
                    response = self.session.post(url, json={}, headers=headers, timeout=10)
                else:
                    response = self.session.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('ok') is True:
                        self.log(f"✅ {endpoint} stub working correctly")
                    else:
                        self.log(f"❌ {endpoint} stub returned ok:{data.get('ok')}")
                        all_passed = False
                else:
                    self.log(f"❌ {endpoint} stub failed with status {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                self.log(f"❌ {endpoint} stub failed with error: {str(e)}")
                all_passed = False
                
        # Test Stripe webhook (no auth required)
        try:
            url = f"{API_BASE}/billing/stripe/webhook"
            response = self.session.post(url, json={}, timeout=10)
            if response.status_code == 200:
                self.log(f"✅ Stripe webhook stub working correctly")
            else:
                self.log(f"❌ Stripe webhook stub failed with status {response.status_code}")
                all_passed = False
        except Exception as e:
            self.log(f"❌ Stripe webhook stub failed with error: {str(e)}")
            all_passed = False
                
        self.results['integration_stubs'] = all_passed
        return all_passed
        
    def test_cors_preflight(self):
        """Test CORS preflight OPTIONS /api/bookings returns 200"""
        self.log("Testing CORS preflight...")
        
        try:
            url = f"{API_BASE}/bookings"
            response = self.session.options(url, timeout=10)
            
            if response.status_code == 200:
                # Check for CORS headers
                cors_headers = [
                    'Access-Control-Allow-Origin',
                    'Access-Control-Allow-Methods',
                    'Access-Control-Allow-Headers'
                ]
                
                headers_present = all(header in response.headers for header in cors_headers)
                if headers_present:
                    self.log(f"✅ CORS preflight working correctly")
                    self.results['cors_preflight'] = True
                    return True
                else:
                    self.log(f"❌ CORS headers missing: {response.headers}")
            else:
                self.log(f"❌ CORS preflight failed with status {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ CORS preflight failed with error: {str(e)}")
            
        self.results['cors_preflight'] = False
        return False
        
    def test_google_calendar_sync_get(self):
        """Test GET /api/integrations/google/sync returns connection status (not 'Google not connected' error)"""
        self.log("Testing Google Calendar sync GET endpoint...")
        
        if not self.auth_token:
            self.log("❌ No auth token available for Google Calendar test")
            return False
            
        try:
            url = f"{API_BASE}/integrations/google/sync"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                # Should return connection status, not an error
                if 'connected' in data and 'lastSyncedAt' in data:
                    self.log(f"✅ Google Calendar sync GET working - returns connection status: connected={data.get('connected')}")
                    self.results['google_calendar_sync_get'] = True
                    return True
                else:
                    self.log(f"❌ Google Calendar sync GET response missing expected fields: {data}")
            else:
                self.log(f"❌ Google Calendar sync GET failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Google Calendar sync GET failed with error: {str(e)}")
            
        self.results['google_calendar_sync_get'] = False
        return False
        
    def test_google_calendar_dynamic_imports(self):
        """Test that Google Calendar endpoints work with dynamic imports (no compilation hanging)"""
        self.log("Testing Google Calendar dynamic imports functionality...")
        
        if not self.auth_token:
            self.log("❌ No auth token available for Google Calendar dynamic imports test")
            return False
            
        try:
            # Test POST /api/integrations/google/sync - should handle dynamic imports properly
            url = f"{API_BASE}/integrations/google/sync"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.post(url, json={}, headers=headers, timeout=15)
            
            # We expect either:
            # 1. 400 with "Google not connected" (if no OAuth configured) - this is OK, means dynamic imports work
            # 2. 200 with sync results (if OAuth is configured) - this is also OK
            # 3. NOT a 500 error or timeout (which would indicate compilation issues)
            
            if response.status_code == 400:
                data = response.json()
                if 'Google not connected' in data.get('error', ''):
                    self.log(f"✅ Google Calendar dynamic imports working - properly returns 'Google not connected' when OAuth not configured")
                    self.results['google_calendar_dynamic_imports'] = True
                    return True
                else:
                    self.log(f"❌ Google Calendar POST returned unexpected 400 error: {data}")
            elif response.status_code == 200:
                data = response.json()
                if 'ok' in data or 'created' in data:
                    self.log(f"✅ Google Calendar dynamic imports working - sync completed successfully: {data}")
                    self.results['google_calendar_dynamic_imports'] = True
                    return True
                else:
                    self.log(f"❌ Google Calendar POST returned unexpected 200 response: {data}")
            else:
                self.log(f"❌ Google Calendar POST failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Google Calendar dynamic imports test failed with error: {str(e)}")
            
        self.results['google_calendar_dynamic_imports'] = False
        return False
        
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        self.log(f"Starting backend tests against {API_BASE}")
        self.log("=" * 60)
        
        # Test health endpoints first
        self.test_health_endpoints()
        
        # Test authentication flow
        if self.test_auth_register():
            self.test_auth_login()
            
            # Test bookings flow
            if self.test_bookings_get_empty():
                if self.test_bookings_create():
                    self.test_bookings_list_with_data()
                    self.test_bookings_cancel()
                    
            # Test integration stubs
            self.test_integration_stubs()
            
            # Test Google Calendar integration specifically
            self.test_google_calendar_sync_get()
            self.test_google_calendar_dynamic_imports()
        
        # Test CORS
        self.test_cors_preflight()
        
        # Print summary
        self.print_summary()
        
    def print_summary(self):
        """Print test results summary"""
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(self.results)
        
        for test_name, result in self.results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed += 1
                
        self.log("=" * 60)
        self.log(f"OVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL BACKEND TESTS PASSED!")
            return True
        else:
            self.log("⚠️  SOME TESTS FAILED")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)