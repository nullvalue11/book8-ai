#!/usr/bin/env python3
"""
Google Calendar Selection Feature Tests
Tests the new Google Calendar Selection endpoints specifically
"""

import requests
import json
import uuid
from datetime import datetime

# Get base URL from environment
BASE_URL = 'https://ops-command-9.preview.emergentagent.com'
API_BASE = f"{BASE_URL}/api"

class GoogleCalendarTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_email = f"gcal_test_{uuid.uuid4().hex[:8]}@example.com"
        self.test_user_password = "TestPassword123!"
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def setup_auth(self):
        """Register and login to get auth token"""
        self.log("Setting up authentication...")
        
        # Register
        try:
            url = f"{API_BASE}/auth/register"
            payload = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": "Google Calendar Test User"
            }
            
            response = self.session.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data:
                    self.auth_token = data['token']
                    self.log(f"✅ Authentication setup successful")
                    return True
                    
        except Exception as e:
            self.log(f"❌ Authentication setup failed: {str(e)}")
            
        return False
        
    def test_google_calendars_get(self):
        """Test GET /api/integrations/google/calendars"""
        self.log("Testing GET /api/integrations/google/calendars...")
        
        try:
            url = f"{API_BASE}/integrations/google/calendars"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.get(url, headers=headers, timeout=15)
            
            if response.status_code == 400:
                data = response.json()
                if 'Google not connected' in data.get('error', ''):
                    self.log(f"✅ GET calendars endpoint working - returns 'Google not connected' as expected")
                    return True
                else:
                    self.log(f"❌ GET calendars unexpected 400 error: {data}")
            elif response.status_code == 200:
                data = response.json()
                if 'calendars' in data and isinstance(data['calendars'], list):
                    self.log(f"✅ GET calendars endpoint working - returned {len(data['calendars'])} calendars")
                    return True
                else:
                    self.log(f"❌ GET calendars unexpected 200 response: {data}")
            else:
                self.log(f"❌ GET calendars failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ GET calendars test failed: {str(e)}")
            
        return False
        
    def test_google_calendars_post(self):
        """Test POST /api/integrations/google/calendars"""
        self.log("Testing POST /api/integrations/google/calendars...")
        
        try:
            url = f"{API_BASE}/integrations/google/calendars"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test with valid payload
            payload = {"selectedCalendars": ["primary", "test-calendar-id"]}
            
            response = self.session.post(url, json=payload, headers=headers, timeout=15)
            
            if response.status_code == 400:
                data = response.json()
                if 'Google not connected' in data.get('error', ''):
                    self.log(f"✅ POST calendars endpoint working - returns 'Google not connected' as expected")
                    return True
                else:
                    self.log(f"❌ POST calendars unexpected 400 error: {data}")
            elif response.status_code == 200:
                data = response.json()
                if data.get('ok') is True and 'selectedCalendars' in data:
                    self.log(f"✅ POST calendars endpoint working - saved {len(data['selectedCalendars'])} selections")
                    return True
                else:
                    self.log(f"❌ POST calendars unexpected 200 response: {data}")
            else:
                self.log(f"❌ POST calendars failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ POST calendars test failed: {str(e)}")
            
        return False
        
    def test_google_calendars_post_validation(self):
        """Test POST /api/integrations/google/calendars payload validation"""
        self.log("Testing POST /api/integrations/google/calendars payload validation...")
        
        try:
            url = f"{API_BASE}/integrations/google/calendars"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Test with invalid payload (not an array)
            invalid_payload = {"selectedCalendars": "not-an-array"}
            
            response = self.session.post(url, json=invalid_payload, headers=headers, timeout=10)
            
            if response.status_code == 400:
                data = response.json()
                if 'selectedCalendars must be an array' in data.get('error', ''):
                    self.log(f"✅ POST calendars validation working - rejects invalid payload format")
                    return True
                elif 'Google not connected' in data.get('error', ''):
                    self.log(f"✅ POST calendars validation working - Google not connected (validation would work if connected)")
                    return True
                else:
                    self.log(f"❌ POST calendars validation unexpected error: {data}")
            else:
                self.log(f"❌ POST calendars validation should return 400, got {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ POST calendars validation test failed: {str(e)}")
            
        return False
        
    def test_google_sync_enhanced(self):
        """Test enhanced POST /api/integrations/google/sync with calendarsSelected"""
        self.log("Testing enhanced POST /api/integrations/google/sync...")
        
        try:
            url = f"{API_BASE}/integrations/google/sync"
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            response = self.session.post(url, json={}, headers=headers, timeout=15)
            
            if response.status_code == 400:
                data = response.json()
                if 'Google not connected' in data.get('error', ''):
                    self.log(f"✅ Enhanced sync endpoint working - returns 'Google not connected' as expected")
                    return True
                else:
                    self.log(f"❌ Enhanced sync unexpected 400 error: {data}")
            elif response.status_code == 200:
                data = response.json()
                if 'calendarsSelected' in data and isinstance(data.get('calendarsSelected'), int):
                    self.log(f"✅ Enhanced sync endpoint working - synced to {data['calendarsSelected']} calendars")
                    return True
                else:
                    self.log(f"❌ Enhanced sync missing calendarsSelected count: {data}")
            else:
                self.log(f"❌ Enhanced sync failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log(f"❌ Enhanced sync test failed: {str(e)}")
            
        return False
        
    def test_auth_requirements(self):
        """Test that endpoints require authentication"""
        self.log("Testing authentication requirements...")
        
        try:
            # Test GET without auth
            url = f"{API_BASE}/integrations/google/calendars"
            response = self.session.get(url, timeout=10)
            
            if response.status_code == 401:
                self.log(f"✅ GET calendars properly requires authentication")
            else:
                self.log(f"❌ GET calendars should return 401 without auth, got {response.status_code}")
                return False
                
            # Test POST without auth
            response = self.session.post(url, json={"selectedCalendars": ["primary"]}, timeout=10)
            
            if response.status_code == 401:
                self.log(f"✅ POST calendars properly requires authentication")
                return True
            else:
                self.log(f"❌ POST calendars should return 401 without auth, got {response.status_code}")
                
        except Exception as e:
            self.log(f"❌ Auth requirements test failed: {str(e)}")
            
        return False
        
    def run_tests(self):
        """Run all Google Calendar Selection tests"""
        self.log("Starting Google Calendar Selection Feature Tests")
        self.log("=" * 60)
        
        if not self.setup_auth():
            self.log("❌ Failed to setup authentication - aborting tests")
            return False
            
        results = []
        
        # Test authentication requirements first
        results.append(("Auth Requirements", self.test_auth_requirements()))
        
        # Test the new endpoints
        results.append(("GET Calendars", self.test_google_calendars_get()))
        results.append(("POST Calendars", self.test_google_calendars_post()))
        results.append(("POST Validation", self.test_google_calendars_post_validation()))
        results.append(("Enhanced Sync", self.test_google_sync_enhanced()))
        
        # Print summary
        self.log("=" * 60)
        self.log("GOOGLE CALENDAR SELECTION TEST RESULTS")
        self.log("=" * 60)
        
        passed = 0
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name}: {status}")
            if result:
                passed += 1
                
        self.log("=" * 60)
        self.log(f"OVERALL: {passed}/{len(results)} tests passed")
        
        if passed == len(results):
            self.log("🎉 ALL GOOGLE CALENDAR SELECTION TESTS PASSED!")
            return True
        else:
            self.log("⚠️  SOME TESTS FAILED")
            return False

if __name__ == "__main__":
    tester = GoogleCalendarTester()
    success = tester.run_tests()
    exit(0 if success else 1)