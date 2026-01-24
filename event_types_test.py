#!/usr/bin/env python3
"""
Event Types API Testing Suite for Book8's Multi-Event Types Feature
Tests all CRUD operations and public endpoint functionality
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://oauth-fix-10.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def register_test_user():
    """Register a test user and return JWT token"""
    try:
        # Use realistic test data
        test_email = f"eventtype_test_{datetime.now().strftime('%H%M%S')}@book8test.com"
        test_password = "SecurePass123!"
        
        response = requests.post(f"{API_BASE}/auth/register", 
            json={
                "email": test_email,
                "password": test_password,
                "name": "Event Type Test User"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('token'):
                log_test("User Registration", "PASS", f"Email: {test_email}")
                return data['token'], test_email
        
        log_test("User Registration", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
        return None, None
        
    except Exception as e:
        log_test("User Registration", "FAIL", f"Exception: {str(e)}")
        return None, None

def setup_scheduling_handle(token):
    """Set up scheduling handle for the user"""
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Create a unique handle
        handle = f"testuser{datetime.now().strftime('%H%M%S')}"
        
        response = requests.post(f"{API_BASE}/settings/scheduling", 
            json={
                "handle": handle,
                "timeZone": "America/New_York",
                "workingHours": {
                    "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "saturday": {"enabled": False, "start": "09:00", "end": "17:00"},
                    "sunday": {"enabled": False, "start": "09:00", "end": "17:00"}
                }
            },
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                log_test("Setup Scheduling Handle", "PASS", f"Handle: {handle}")
                return handle
        
        log_test("Setup Scheduling Handle", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
        return None
        
    except Exception as e:
        log_test("Setup Scheduling Handle", "FAIL", f"Exception: {str(e)}")
        return None

def test_event_types_api():
    """Test the Event Types API endpoints"""
    
    print("=" * 80)
    print("TESTING EVENT TYPES API - BOOK8 MULTI-EVENT TYPES FEATURE")
    print("=" * 80)
    
    # Register test user
    token, email = register_test_user()
    if not token:
        print("❌ Cannot proceed without valid JWT token")
        return False
    
    # Setup scheduling handle
    handle = setup_scheduling_handle(token)
    if not handle:
        print("❌ Cannot proceed without scheduling handle")
        return False
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    created_event_type_id = None
    created_slug = None
    
    # Test 1: GET /api/event-types - List user's event types (should be empty initially)
    try:
        response = requests.get(f"{API_BASE}/event-types", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and isinstance(data.get('eventTypes'), list):
                log_test("GET /api/event-types (empty)", "PASS", f"Found {len(data['eventTypes'])} event types")
            else:
                log_test("GET /api/event-types (empty)", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("GET /api/event-types (empty)", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("GET /api/event-types (empty)", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 2: POST /api/event-types - Create new event type
    try:
        event_type_payload = {
            "name": "30-min Call",
            "description": "Quick consultation",
            "durationMinutes": 30
        }
        
        response = requests.post(f"{API_BASE}/event-types", 
            json=event_type_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('eventType'):
                event_type = data['eventType']
                created_event_type_id = event_type.get('id')
                created_slug = event_type.get('slug')
                
                # Verify auto-generated slug
                expected_slug = "30-min-call"
                if event_type.get('slug') == expected_slug:
                    log_test("POST /api/event-types", "PASS", f"Created event type with slug: {created_slug}")
                else:
                    log_test("POST /api/event-types", "FAIL", f"Expected slug '{expected_slug}', got '{event_type.get('slug')}'")
                    return False
                    
                # Verify other fields
                if (event_type.get('name') == "30-min Call" and 
                    event_type.get('description') == "Quick consultation" and
                    event_type.get('durationMinutes') == 30 and
                    event_type.get('isActive') == True):
                    log_test("Event Type Fields Validation", "PASS", "All fields correct")
                else:
                    log_test("Event Type Fields Validation", "FAIL", f"Field mismatch: {event_type}")
                    return False
            else:
                log_test("POST /api/event-types", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("POST /api/event-types", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("POST /api/event-types", "FAIL", f"Exception: {str(e)}")
        return False
    
    if not created_event_type_id:
        print("❌ Cannot proceed without created event type ID")
        return False
    
    # Test 3: GET /api/event-types - List event types (should now have 1)
    try:
        response = requests.get(f"{API_BASE}/event-types", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and len(data.get('eventTypes', [])) == 1:
                event_type = data['eventTypes'][0]
                if event_type.get('id') == created_event_type_id:
                    log_test("GET /api/event-types (with data)", "PASS", f"Found created event type")
                else:
                    log_test("GET /api/event-types (with data)", "FAIL", f"Event type ID mismatch")
                    return False
            else:
                log_test("GET /api/event-types (with data)", "FAIL", f"Expected 1 event type, got: {len(data.get('eventTypes', []))}")
                return False
        else:
            log_test("GET /api/event-types (with data)", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("GET /api/event-types (with data)", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4: PUT /api/event-types/[id] - Update event type (change duration and toggle isActive)
    try:
        update_payload = {
            "name": "45-min Consultation",
            "durationMinutes": 45,
            "isActive": False
        }
        
        response = requests.put(f"{API_BASE}/event-types/{created_event_type_id}", 
            json=update_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('eventType'):
                event_type = data['eventType']
                if (event_type.get('name') == "45-min Consultation" and 
                    event_type.get('durationMinutes') == 45 and
                    event_type.get('isActive') == False):
                    log_test("PUT /api/event-types/[id]", "PASS", f"Updated event type successfully")
                else:
                    log_test("PUT /api/event-types/[id]", "FAIL", f"Update failed: {event_type}")
                    return False
            else:
                log_test("PUT /api/event-types/[id]", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("PUT /api/event-types/[id]", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("PUT /api/event-types/[id]", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 5: Create another event type to test slug uniqueness
    try:
        duplicate_payload = {
            "name": "30-min Call",  # Same name as first one
            "description": "Another consultation",
            "durationMinutes": 30
        }
        
        response = requests.post(f"{API_BASE}/event-types", 
            json=duplicate_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('eventType'):
                event_type = data['eventType']
                # Should get slug like "30-min-call-1"
                if event_type.get('slug') != created_slug and event_type.get('slug').startswith('30-min-call'):
                    log_test("Slug Uniqueness Test", "PASS", f"Generated unique slug: {event_type.get('slug')}")
                else:
                    log_test("Slug Uniqueness Test", "FAIL", f"Slug not unique: {event_type.get('slug')}")
                    return False
            else:
                log_test("Slug Uniqueness Test", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("Slug Uniqueness Test", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Slug Uniqueness Test", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 6: GET /api/public/event-type?handle=xxx&slug=xxx - Public event type info
    try:
        # First, reactivate the event type for public access
        reactivate_payload = {"isActive": True}
        requests.put(f"{API_BASE}/event-types/{created_event_type_id}", 
            json=reactivate_payload, headers=headers, timeout=10)
        
        # Test public endpoint
        response = requests.get(f"{API_BASE}/public/event-type?handle={handle}&slug={created_slug}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('eventType'):
                public_event_type = data['eventType']
                if (public_event_type.get('name') == "45-min Consultation" and 
                    public_event_type.get('slug') == created_slug and
                    public_event_type.get('durationMinutes') == 45):
                    log_test("GET /api/public/event-type", "PASS", f"Public endpoint working")
                else:
                    log_test("GET /api/public/event-type", "FAIL", f"Public data mismatch: {public_event_type}")
                    return False
            else:
                log_test("GET /api/public/event-type", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("GET /api/public/event-type", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("GET /api/public/event-type", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 7: DELETE /api/event-types/[id] - Delete event type
    try:
        response = requests.delete(f"{API_BASE}/event-types/{created_event_type_id}", 
            headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                log_test("DELETE /api/event-types/[id]", "PASS", f"Event type deleted successfully")
            else:
                log_test("DELETE /api/event-types/[id]", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("DELETE /api/event-types/[id]", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("DELETE /api/event-types/[id]", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 8: Verify deletion - GET should return 404
    try:
        response = requests.get(f"{API_BASE}/event-types/{created_event_type_id}", 
            headers=headers, timeout=10)
        
        if response.status_code == 404:
            log_test("Verify Deletion", "PASS", f"Deleted event type returns 404")
        else:
            log_test("Verify Deletion", "FAIL", f"Expected 404, got: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Verify Deletion", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 9: DELETE non-existent event type - should return 404
    try:
        fake_id = "non-existent-id-12345"
        response = requests.delete(f"{API_BASE}/event-types/{fake_id}", 
            headers=headers, timeout=10)
        
        if response.status_code == 404:
            log_test("DELETE Non-existent ID", "PASS", f"Returns 404 for non-existent ID")
        else:
            log_test("DELETE Non-existent ID", "FAIL", f"Expected 404, got: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("DELETE Non-existent ID", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 10: Test authentication requirements
    try:
        # Test without Bearer token
        response = requests.get(f"{API_BASE}/event-types", timeout=10)
        
        if response.status_code == 401:
            log_test("Authentication Required", "PASS", f"Properly requires authentication")
        else:
            log_test("Authentication Required", "FAIL", f"Should return 401, got: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Authentication Required", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 11: Test public endpoint with invalid parameters
    try:
        # Test missing handle parameter
        response = requests.get(f"{API_BASE}/public/event-type?slug=test-slug", timeout=10)
        
        if response.status_code == 400:
            log_test("Public Endpoint Validation", "PASS", f"Returns 400 for missing parameters")
        else:
            log_test("Public Endpoint Validation", "FAIL", f"Expected 400, got: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Public Endpoint Validation", "FAIL", f"Exception: {str(e)}")
        return False
    
    print("\n" + "=" * 80)
    print("✅ ALL EVENT TYPES API TESTS PASSED!")
    print("=" * 80)
    return True

def main():
    """Main test runner"""
    print(f"Testing Event Types API at: {API_BASE}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        success = test_event_types_api()
        
        if success:
            print("\n🎉 EVENT TYPES API TESTING COMPLETE - ALL TESTS PASSED!")
            sys.exit(0)
        else:
            print("\n❌ EVENT TYPES API TESTING FAILED")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()