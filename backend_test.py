#!/usr/bin/env python3
"""
Backend API Testing Suite for Book8-AI
Tests the updated Reminder Settings API with new data structure
"""

import requests
import json
import os
import sys
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://book8-calendar.preview.emergentagent.com')
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
        test_email = f"reminder_test_{datetime.now().strftime('%H%M%S')}@book8test.com"
        test_password = "SecurePass123!"
        
        response = requests.post(f"{API_BASE}/auth/register", 
            json={
                "email": test_email,
                "password": test_password,
                "name": "Reminder Test User"
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

def test_reminder_settings_api():
    """Test the updated Reminder Settings API with new data structure"""
    
    print("=" * 80)
    print("TESTING UPDATED REMINDER SETTINGS API")
    print("=" * 80)
    
    # Register test user
    token, email = register_test_user()
    if not token:
        print("❌ Cannot proceed without valid JWT token")
        return False
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Test 1: GET initial reminder settings (should return defaults or null)
    try:
        response = requests.get(f"{API_BASE}/settings/scheduling", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                scheduling = data.get('scheduling')
                log_test("GET Initial Settings", "PASS", f"Scheduling: {scheduling}")
            else:
                log_test("GET Initial Settings", "FAIL", f"Response not ok: {data}")
                return False
        else:
            log_test("GET Initial Settings", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("GET Initial Settings", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 2: POST new reminder format - All enabled
    try:
        unique_handle = f"remindertest{datetime.now().strftime('%H%M%S')}"
        reminder_payload = {
            "handle": unique_handle,
            "reminders": {
                "enabled": True,
                "guestEnabled": True,
                "hostEnabled": True,
                "types": {
                    "24h": True,
                    "1h": False
                }
            }
        }
        
        response = requests.post(f"{API_BASE}/settings/scheduling", 
            json=reminder_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                expected_structure = {
                    'enabled': True,
                    'guestEnabled': True,
                    'hostEnabled': True,
                    'types': {'24h': True, '1h': False}
                }
                
                if reminders == expected_structure:
                    log_test("POST Save New Format", "PASS", f"Reminders: {reminders}")
                else:
                    log_test("POST Save New Format", "FAIL", f"Expected: {expected_structure}, Got: {reminders}")
                    return False
            else:
                log_test("POST Save New Format", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("POST Save New Format", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("POST Save New Format", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 3: GET to verify persistence
    try:
        response = requests.get(f"{API_BASE}/settings/scheduling", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                expected_structure = {
                    'enabled': True,
                    'guestEnabled': True,
                    'hostEnabled': True,
                    'types': {'24h': True, '1h': False}
                }
                
                if reminders == expected_structure:
                    log_test("GET Verify Persistence", "PASS", f"Settings persisted correctly")
                else:
                    log_test("GET Verify Persistence", "FAIL", f"Expected: {expected_structure}, Got: {reminders}")
                    return False
            else:
                log_test("GET Verify Persistence", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("GET Verify Persistence", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("GET Verify Persistence", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4: Update hostEnabled from true to false
    try:
        update_payload = {
            "reminders": {
                "enabled": True,
                "guestEnabled": True,
                "hostEnabled": False,  # Changed from true to false
                "types": {
                    "24h": True,
                    "1h": False
                }
            }
        }
        
        response = requests.post(f"{API_BASE}/settings/scheduling", 
            json=update_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                if reminders.get('hostEnabled') == False:
                    log_test("Update hostEnabled", "PASS", f"hostEnabled changed to false")
                else:
                    log_test("Update hostEnabled", "FAIL", f"hostEnabled not updated: {reminders}")
                    return False
            else:
                log_test("Update hostEnabled", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("Update hostEnabled", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Update hostEnabled", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 5: Toggle types['1h'] from false to true
    try:
        update_payload = {
            "reminders": {
                "enabled": True,
                "guestEnabled": True,
                "hostEnabled": False,
                "types": {
                    "24h": True,
                    "1h": True  # Changed from false to true
                }
            }
        }
        
        response = requests.post(f"{API_BASE}/settings/scheduling", 
            json=update_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                if reminders.get('types', {}).get('1h') == True:
                    log_test("Toggle types['1h']", "PASS", f"1h reminder enabled")
                else:
                    log_test("Toggle types['1h']", "FAIL", f"1h reminder not updated: {reminders}")
                    return False
            else:
                log_test("Toggle types['1h']", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("Toggle types['1h']", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Toggle types['1h']", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 6: Test disabled state (enabled: false)
    try:
        disabled_payload = {
            "reminders": {
                "enabled": False,  # Master switch off
                "guestEnabled": True,
                "hostEnabled": True,
                "types": {
                    "24h": True,
                    "1h": True
                }
            }
        }
        
        response = requests.post(f"{API_BASE}/settings/scheduling", 
            json=disabled_payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                if reminders.get('enabled') == False:
                    log_test("Test Disabled State", "PASS", f"Master switch disabled correctly")
                else:
                    log_test("Test Disabled State", "FAIL", f"Master switch not disabled: {reminders}")
                    return False
            else:
                log_test("Test Disabled State", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("Test Disabled State", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Test Disabled State", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 7: Verify final persistence
    try:
        response = requests.get(f"{API_BASE}/settings/scheduling", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('scheduling'):
                reminders = data['scheduling'].get('reminders', {})
                expected_final = {
                    'enabled': False,
                    'guestEnabled': True,
                    'hostEnabled': True,
                    'types': {'24h': True, '1h': True}
                }
                
                if reminders == expected_final:
                    log_test("Final Persistence Check", "PASS", f"All changes persisted correctly")
                else:
                    log_test("Final Persistence Check", "FAIL", f"Expected: {expected_final}, Got: {reminders}")
                    return False
            else:
                log_test("Final Persistence Check", "FAIL", f"Invalid response: {data}")
                return False
        else:
            log_test("Final Persistence Check", "FAIL", f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Final Persistence Check", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 8: Test authentication requirement
    try:
        # Test without Bearer token
        response = requests.get(f"{API_BASE}/settings/scheduling", timeout=10)
        
        if response.status_code == 401:
            log_test("Authentication Required", "PASS", f"Properly requires authentication")
        else:
            log_test("Authentication Required", "FAIL", f"Should return 401, got: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Authentication Required", "FAIL", f"Exception: {str(e)}")
        return False
    
    print("\n" + "=" * 80)
    print("✅ ALL REMINDER SETTINGS API TESTS PASSED!")
    print("=" * 80)
    return True

def main():
    """Main test runner"""
    print(f"Testing Reminder Settings API at: {API_BASE}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        success = test_reminder_settings_api()
        
        if success:
            print("\n🎉 REMINDER SETTINGS API TESTING COMPLETE - ALL TESTS PASSED!")
            sys.exit(0)
        else:
            print("\n❌ REMINDER SETTINGS API TESTING FAILED")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error during testing: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()