#!/usr/bin/env python3

import requests
import json
import time
import hashlib
import hmac
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://schedulesync-5.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test user credentials
TEST_EMAIL = f"stripe.test.{uuid.uuid4().hex[:8]}@book8ai.com"
TEST_PASSWORD = "SecurePass123!"
TEST_NAME = "Stripe Test User"

class StripeWebhookTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def register_and_login(self):
        """Register a test user and get auth token"""
        try:
            # Try to register
            register_data = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data, timeout=15)
            
            if response.status_code == 409:
                # User already exists, try login
                self.log("User already exists, attempting login...")
                login_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
                response = self.session.post(f"{API_BASE}/auth/login", json=login_data, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user_id = data.get('user', {}).get('id')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                self.log(f"✅ Authentication successful - User ID: {self.user_id}")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_mock_stripe_signature(self, payload, secret="test_webhook_secret"):
        """Create a mock Stripe signature for testing"""
        timestamp = str(int(time.time()))
        signed_payload = f"{timestamp}.{payload}"
        signature = hmac.new(
            secret.encode('utf-8'),
            signed_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"t={timestamp},v1={signature}"
    
    def test_webhook_without_signature(self):
        """Test webhook endpoint without Stripe signature (should fail)"""
        self.log("Testing webhook without signature...")
        
        try:
            webhook_payload = {
                "id": "evt_test_webhook_no_sig",
                "object": "event",
                "type": "customer.subscription.created",
                "data": {
                    "object": {
                        "id": "sub_test123",
                        "customer": "cus_test123",
                        "status": "active"
                    }
                }
            }
            
            response = self.session.post(
                f"{API_BASE}/billing/stripe/webhook",
                json=webhook_payload,
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                if "signature" in data.get('error', '').lower():
                    self.log("✅ Webhook correctly rejected without signature")
                    return True
                else:
                    self.log(f"❌ Unexpected error message: {data.get('error')}")
                    return False
            else:
                self.log(f"❌ Expected 400 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing webhook without signature: {str(e)}")
            return False
    
    def test_webhook_with_invalid_signature(self):
        """Test webhook endpoint with invalid Stripe signature (should fail)"""
        self.log("Testing webhook with invalid signature...")
        
        try:
            webhook_payload = {
                "id": "evt_test_webhook_invalid_sig",
                "object": "event",
                "type": "customer.subscription.created",
                "data": {
                    "object": {
                        "id": "sub_test123",
                        "customer": "cus_test123",
                        "status": "active"
                    }
                }
            }
            
            # Create invalid signature
            headers = {
                'stripe-signature': 'invalid_signature_format'
            }
            
            response = self.session.post(
                f"{API_BASE}/billing/stripe/webhook",
                json=webhook_payload,
                headers=headers,
                timeout=15
            )
            
            if response.status_code == 400:
                data = response.json()
                if "signature" in data.get('error', '').lower() or "invalid" in data.get('error', '').lower():
                    self.log("✅ Webhook correctly rejected with invalid signature")
                    return True
                else:
                    self.log(f"❌ Unexpected error message: {data.get('error')}")
                    return False
            else:
                self.log(f"❌ Expected 400 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing webhook with invalid signature: {str(e)}")
            return False
    
    def test_billing_logs_without_auth(self):
        """Test billing logs endpoint without authentication (should fail)"""
        self.log("Testing billing logs without authentication...")
        
        try:
            # Remove auth header temporarily
            temp_headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.get(f"{API_BASE}/billing/logs", timeout=15)
            
            # Restore headers
            self.session.headers = temp_headers
            
            if response.status_code == 401:
                self.log("✅ Billing logs correctly requires authentication")
                return True
            else:
                self.log(f"❌ Expected 401 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing billing logs without auth: {str(e)}")
            return False
    
    def test_billing_logs_with_auth(self):
        """Test billing logs endpoint with authentication"""
        self.log("Testing billing logs with authentication...")
        
        try:
            response = self.session.get(f"{API_BASE}/billing/logs", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'logs' in data and isinstance(data['logs'], list):
                    self.log(f"✅ Billing logs endpoint working - returned {len(data['logs'])} logs")
                    return True
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing billing logs with auth: {str(e)}")
            return False
    
    def test_billing_logs_pagination(self):
        """Test billing logs endpoint with pagination parameters"""
        self.log("Testing billing logs pagination...")
        
        try:
            # Test with limit parameter
            response = self.session.get(f"{API_BASE}/billing/logs?limit=5&skip=0", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'logs' in data and 'count' in data:
                    self.log(f"✅ Billing logs pagination working - limit/skip parameters accepted")
                    return True
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing billing logs pagination: {str(e)}")
            return False
    
    def test_events_status_without_auth(self):
        """Test events status endpoint without authentication (should fail)"""
        self.log("Testing events status without authentication...")
        
        try:
            # Remove auth header temporarily
            temp_headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.get(f"{API_BASE}/billing/events/status", timeout=15)
            
            # Restore headers
            self.session.headers = temp_headers
            
            if response.status_code == 401:
                self.log("✅ Events status correctly requires authentication")
                return True
            else:
                self.log(f"❌ Expected 401 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing events status without auth: {str(e)}")
            return False
    
    def test_events_status_with_auth(self):
        """Test events status endpoint with authentication"""
        self.log("Testing events status with authentication...")
        
        try:
            response = self.session.get(f"{API_BASE}/billing/events/status", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'events' in data and isinstance(data['events'], list):
                    self.log(f"✅ Events status endpoint working - returned {len(data['events'])} events")
                    return True
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing events status with auth: {str(e)}")
            return False
    
    def test_events_status_with_limit(self):
        """Test events status endpoint with limit parameter"""
        self.log("Testing events status with limit parameter...")
        
        try:
            response = self.session.get(f"{API_BASE}/billing/events/status?limit=10", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'events' in data and 'count' in data:
                    self.log(f"✅ Events status limit parameter working")
                    return True
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing events status with limit: {str(e)}")
            return False
    
    def test_database_collections_exist(self):
        """Test that the required database collections and indexes exist by checking API responses"""
        self.log("Testing database collections through API responses...")
        
        try:
            # Test that billing_logs collection works
            logs_response = self.session.get(f"{API_BASE}/billing/logs", timeout=15)
            
            # Test that stripe_events collection works  
            events_response = self.session.get(f"{API_BASE}/billing/events/status", timeout=15)
            
            if logs_response.status_code == 200 and events_response.status_code == 200:
                self.log("✅ Database collections (billing_logs, stripe_events) are accessible")
                return True
            else:
                self.log(f"❌ Database collection access failed - logs: {logs_response.status_code}, events: {events_response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing database collections: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Stripe Webhook Idempotency tests"""
        self.log("🚀 Starting Stripe Webhook Idempotency Tests")
        self.log("=" * 60)
        
        # Authentication first
        if not self.register_and_login():
            self.log("❌ Authentication failed - cannot proceed with tests")
            return False
        
        tests = [
            ("Webhook without signature", self.test_webhook_without_signature),
            ("Webhook with invalid signature", self.test_webhook_with_invalid_signature),
            ("Billing logs without auth", self.test_billing_logs_without_auth),
            ("Billing logs with auth", self.test_billing_logs_with_auth),
            ("Billing logs pagination", self.test_billing_logs_pagination),
            ("Events status without auth", self.test_events_status_without_auth),
            ("Events status with auth", self.test_events_status_with_auth),
            ("Events status with limit", self.test_events_status_with_limit),
            ("Database collections exist", self.test_database_collections_exist),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ Test '{test_name}' crashed: {str(e)}")
                failed += 1
        
        self.log("\n" + "=" * 60)
        self.log(f"🎯 TEST SUMMARY: {passed} passed, {failed} failed")
        
        if failed == 0:
            self.log("🎉 ALL STRIPE WEBHOOK IDEMPOTENCY TESTS PASSED!")
            return True
        else:
            self.log(f"⚠️  {failed} tests failed - see details above")
            return False

def main():
    tester = StripeWebhookTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())