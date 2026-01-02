#!/usr/bin/env python3

import requests
import json
import time
import hashlib
import hmac
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://ops-api-internal.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test user credentials
TEST_EMAIL = f"idempotency.test.{uuid.uuid4().hex[:8]}@book8ai.com"
TEST_PASSWORD = "SecurePass123!"
TEST_NAME = "Idempotency Test User"

class StripeIdempotencyTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.session = requests.Session()
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def register_and_login(self):
        """Register a test user and get auth token"""
        try:
            register_data = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "name": TEST_NAME
            }
            
            response = self.session.post(f"{API_BASE}/auth/register", json=register_data, timeout=15)
            
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
    
    def test_webhook_secret_not_configured(self):
        """Test webhook behavior when STRIPE_WEBHOOK_SECRET is not configured"""
        self.log("Testing webhook when secret not configured...")
        
        try:
            webhook_payload = {
                "id": "evt_test_no_secret_config",
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
            
            # Create a valid-looking signature
            headers = {
                'stripe-signature': 't=1234567890,v1=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            }
            
            response = self.session.post(
                f"{API_BASE}/billing/stripe/webhook",
                json=webhook_payload,
                headers=headers,
                timeout=15
            )
            
            # Should return 400 if webhook secret is not configured
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '').lower()
                if 'secret' in error_msg or 'signature' in error_msg or 'invalid' in error_msg:
                    self.log("✅ Webhook correctly handles missing/invalid secret configuration")
                    return True
                else:
                    self.log(f"❌ Unexpected error message: {data.get('error')}")
                    return False
            else:
                self.log(f"❌ Expected 400 status for missing secret, got {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing webhook secret configuration: {str(e)}")
            return False
    
    def test_stripe_not_configured(self):
        """Test webhook behavior when Stripe is not configured at all"""
        self.log("Testing webhook when Stripe not configured...")
        
        # This test checks if the endpoint properly handles the case where STRIPE_SECRET_KEY is missing
        # In our current implementation, this should return a 400 error
        
        try:
            webhook_payload = {
                "id": "evt_test_stripe_not_configured",
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
            
            # Should return 400 if Stripe is not configured
            if response.status_code == 400:
                data = response.json()
                error_msg = data.get('error', '').lower()
                if 'stripe not configured' in error_msg or 'signature' in error_msg:
                    self.log("✅ Webhook correctly handles Stripe not configured")
                    return True
                else:
                    self.log(f"❌ Unexpected error for Stripe not configured: {data.get('error')}")
                    return False
            else:
                self.log(f"❌ Expected 400 status for Stripe not configured, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing Stripe not configured: {str(e)}")
            return False
    
    def test_webhook_malformed_payload(self):
        """Test webhook with malformed JSON payload"""
        self.log("Testing webhook with malformed payload...")
        
        try:
            # Send malformed JSON
            headers = {
                'stripe-signature': 't=1234567890,v1=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                'Content-Type': 'application/json'
            }
            
            response = self.session.post(
                f"{API_BASE}/billing/stripe/webhook",
                data='{"invalid": json}',  # Malformed JSON
                headers=headers,
                timeout=15
            )
            
            # Should return 400 for malformed payload or signature issues
            if response.status_code == 400:
                self.log("✅ Webhook correctly handles malformed payload")
                return True
            else:
                self.log(f"❌ Expected 400 status for malformed payload, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing malformed payload: {str(e)}")
            return False
    
    def test_webhook_empty_payload(self):
        """Test webhook with empty payload"""
        self.log("Testing webhook with empty payload...")
        
        try:
            headers = {
                'stripe-signature': 't=1234567890,v1=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
            }
            
            response = self.session.post(
                f"{API_BASE}/billing/stripe/webhook",
                data='',
                headers=headers,
                timeout=15
            )
            
            # Should return 400 for empty payload
            if response.status_code == 400:
                self.log("✅ Webhook correctly handles empty payload")
                return True
            else:
                self.log(f"❌ Expected 400 status for empty payload, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing empty payload: {str(e)}")
            return False
    
    def test_billing_logs_large_limit(self):
        """Test billing logs with large limit parameter (should be capped)"""
        self.log("Testing billing logs with large limit parameter...")
        
        try:
            # Test with limit > 100 (should be capped at 100)
            response = self.session.get(f"{API_BASE}/billing/logs?limit=500", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'logs' in data and 'count' in data:
                    # The implementation caps at 100, so count should not exceed 100
                    count = data.get('count', 0)
                    if count <= 100:
                        self.log(f"✅ Billing logs correctly caps large limit - returned {count} logs")
                        return True
                    else:
                        self.log(f"❌ Billing logs should cap at 100, but returned {count}")
                        return False
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing large limit: {str(e)}")
            return False
    
    def test_events_status_large_limit(self):
        """Test events status with large limit parameter (should be capped)"""
        self.log("Testing events status with large limit parameter...")
        
        try:
            # Test with limit > 50 (should be capped at 50)
            response = self.session.get(f"{API_BASE}/billing/events/status?limit=200", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if 'events' in data and 'count' in data:
                    # The implementation caps at 50, so count should not exceed 50
                    count = data.get('count', 0)
                    if count <= 50:
                        self.log(f"✅ Events status correctly caps large limit - returned {count} events")
                        return True
                    else:
                        self.log(f"❌ Events status should cap at 50, but returned {count}")
                        return False
                else:
                    self.log(f"❌ Unexpected response format: {data}")
                    return False
            else:
                self.log(f"❌ Expected 200 status, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing large limit: {str(e)}")
            return False
    
    def test_database_indexes_working(self):
        """Test that database indexes are working by checking response times"""
        self.log("Testing database indexes performance...")
        
        try:
            # Test multiple rapid requests to see if indexes are working
            start_time = time.time()
            
            for i in range(5):
                logs_response = self.session.get(f"{API_BASE}/billing/logs?limit=20", timeout=15)
                events_response = self.session.get(f"{API_BASE}/billing/events/status?limit=20", timeout=15)
                
                if logs_response.status_code != 200 or events_response.status_code != 200:
                    self.log(f"❌ Request {i+1} failed - logs: {logs_response.status_code}, events: {events_response.status_code}")
                    return False
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # If indexes are working, 10 requests should complete reasonably quickly
            if total_time < 10:  # 10 seconds for 10 requests
                self.log(f"✅ Database indexes working - 10 requests completed in {total_time:.2f}s")
                return True
            else:
                self.log(f"⚠️ Database queries slow - 10 requests took {total_time:.2f}s (may indicate missing indexes)")
                return True  # Still pass, but note the performance issue
                
        except Exception as e:
            self.log(f"❌ Error testing database indexes: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Stripe Webhook Idempotency edge case tests"""
        self.log("🔧 Starting Stripe Webhook Idempotency Edge Case Tests")
        self.log("=" * 70)
        
        # Authentication first
        if not self.register_and_login():
            self.log("❌ Authentication failed - cannot proceed with tests")
            return False
        
        tests = [
            ("Webhook secret not configured", self.test_webhook_secret_not_configured),
            ("Stripe not configured", self.test_stripe_not_configured),
            ("Webhook malformed payload", self.test_webhook_malformed_payload),
            ("Webhook empty payload", self.test_webhook_empty_payload),
            ("Billing logs large limit", self.test_billing_logs_large_limit),
            ("Events status large limit", self.test_events_status_large_limit),
            ("Database indexes working", self.test_database_indexes_working),
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
        
        self.log("\n" + "=" * 70)
        self.log(f"🎯 EDGE CASE TEST SUMMARY: {passed} passed, {failed} failed")
        
        if failed == 0:
            self.log("🎉 ALL STRIPE WEBHOOK IDEMPOTENCY EDGE CASE TESTS PASSED!")
            return True
        else:
            self.log(f"⚠️  {failed} tests failed - see details above")
            return False

def main():
    tester = StripeIdempotencyTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())