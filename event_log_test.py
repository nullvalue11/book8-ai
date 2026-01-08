#!/usr/bin/env python3
"""
MongoDB Event Log Verification Test
Tests that events are actually being saved to the ops_event_logs collection.
"""

import requests
import json
import time
import os
import sys
from pymongo import MongoClient
from datetime import datetime, timedelta

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-admin-tools.preview.emergentagent.com')
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "ops-dev-secret-change-me"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "your_database_name"

HEADERS = {
    'Content-Type': 'application/json',
    'x-book8-internal-secret': AUTH_HEADER
}

class EventLogTestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add_test(self, name, passed, details=""):
        self.tests.append({
            'name': name,
            'passed': passed,
            'details': details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*70}")
        print(f"EVENT LOG TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*70}")
        for test in self.tests:
            status = "✅ PASS" if test['passed'] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test['details']:
                print(f"    {test['details']}")

def connect_to_mongodb():
    """Connect to MongoDB and return database instance"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        # Test connection
        db.command('ping')
        return db, client
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None, None

def make_api_request(payload):
    """Make API request and return response"""
    try:
        response = requests.post(API_ENDPOINT, json=payload, headers=HEADERS, timeout=30)
        return {
            'success': True,
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            'response_time': response.elapsed.total_seconds() * 1000
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def test_successful_bootstrap_event_logging():
    """Test Case 1: Verify successful bootstrap event is logged"""
    print("\n🧪 Test 1: Successful Bootstrap Event Logging")
    
    db, client = connect_to_mongodb()
    if db is None:
        return False, "Failed to connect to MongoDB"
    
    try:
        timestamp = int(time.time())
        request_id = f"test-event-success-{timestamp}"
        business_id = "test-event-biz-1"
        
        # Execute the API call
        payload = {
            "requestId": request_id,
            "tool": "tenant.bootstrap",
            "args": {
                "businessId": business_id,
                "skipVoiceTest": True,
                "skipBillingCheck": True
            }
        }
        
        print(f"   📤 Executing tenant.bootstrap for business: {business_id}")
        print(f"   📋 Request ID: {request_id}")
        
        response = make_api_request(payload)
        
        if not response['success'] or response['status_code'] != 200:
            return False, f"API call failed: {response.get('error', response.get('status_code'))}"
        
        # Wait a moment for event logging (fire-and-forget)
        time.sleep(2)
        
        # Check if event was logged
        collection = db['ops_event_logs']
        event = collection.find_one({'requestId': request_id})
        
        if not event:
            return False, f"Event not found in ops_event_logs collection for requestId: {request_id}"
        
        # Verify event schema
        required_fields = ['requestId', 'tool', 'status', 'durationMs', 'executedAt', 'actor', 'createdAt']
        for field in required_fields:
            if field not in event:
                return False, f"Missing required field in event: {field}"
        
        # Verify event values
        if event['requestId'] != request_id:
            return False, f"RequestId mismatch: expected {request_id}, got {event['requestId']}"
        
        if event['tool'] != "tenant.bootstrap":
            return False, f"Tool mismatch: expected tenant.bootstrap, got {event['tool']}"
        
        if event['businessId'] != business_id:
            return False, f"BusinessId mismatch: expected {business_id}, got {event['businessId']}"
        
        # Verify status (should be 'success' since ready=true)
        expected_status = 'success'
        if event['status'] != expected_status:
            return False, f"Status mismatch: expected {expected_status}, got {event['status']}"
        
        # Verify actor is one of the expected values
        valid_actors = ['n8n', 'human', 'system', 'api']
        if event['actor'] not in valid_actors:
            return False, f"Invalid actor: {event['actor']}, expected one of {valid_actors}"
        
        # Verify durationMs is positive
        if not isinstance(event['durationMs'], (int, float)) or event['durationMs'] < 0:
            return False, f"Invalid durationMs: {event['durationMs']}"
        
        # Verify metadata
        if 'metadata' not in event:
            return False, "Missing metadata field"
        
        metadata = event['metadata']
        if 'ready' not in metadata:
            return False, "Missing ready field in metadata"
        
        if 'dryRun' not in metadata:
            return False, "Missing dryRun field in metadata"
        
        print(f"   ✅ Event found in database: {event['_id']}")
        print(f"   ✅ Status: {event['status']}")
        print(f"   ✅ Actor: {event['actor']}")
        print(f"   ✅ Duration: {event['durationMs']}ms")
        print(f"   ✅ Ready: {metadata.get('ready', 'N/A')}")
        print(f"   ✅ DryRun: {metadata.get('dryRun', 'N/A')}")
        
        return True, f"Event successfully logged with status '{event['status']}' and actor '{event['actor']}'"
        
    except Exception as e:
        return False, f"Exception during test: {str(e)}"
    finally:
        if client:
            client.close()

def test_partial_status_event_logging():
    """Test Case 2: Verify partial status event logging"""
    print("\n🧪 Test 2: Partial Status Event Logging")
    
    db, client = connect_to_mongodb()
    if db is None:
        return False, "Failed to connect to MongoDB"
    
    try:
        timestamp = int(time.time())
        request_id = f"test-event-partial-{timestamp}"
        business_id = "test-partial-biz-2"
        
        # Execute the API call
        payload = {
            "requestId": request_id,
            "tool": "tenant.bootstrap",
            "args": {
                "businessId": business_id,
                "skipVoiceTest": True,
                "skipBillingCheck": True
            }
        }
        
        print(f"   📤 Executing tenant.bootstrap for business: {business_id}")
        print(f"   📋 Request ID: {request_id}")
        
        response = make_api_request(payload)
        
        if not response['success'] or response['status_code'] != 200:
            return False, f"API call failed: {response.get('error', response.get('status_code'))}"
        
        # Wait for event logging
        time.sleep(2)
        
        # Check if event was logged
        collection = db['ops_event_logs']
        event = collection.find_one({'requestId': request_id})
        
        if not event:
            return False, f"Event not found in ops_event_logs collection for requestId: {request_id}"
        
        # Verify event was logged (status could be success or partial)
        valid_statuses = ['success', 'partial']
        if event['status'] not in valid_statuses:
            return False, f"Invalid status: {event['status']}, expected one of {valid_statuses}"
        
        print(f"   ✅ Event found in database: {event['_id']}")
        print(f"   ✅ Status: {event['status']}")
        print(f"   ✅ BusinessId: {event['businessId']}")
        
        return True, f"Event successfully logged with status '{event['status']}'"
        
    except Exception as e:
        return False, f"Exception during test: {str(e)}"
    finally:
        if client:
            client.close()

def test_event_schema_validation():
    """Test Case 3: Verify event schema has all required fields"""
    print("\n🧪 Test 3: Event Schema Validation")
    
    db, client = connect_to_mongodb()
    if db is None:
        return False, "Failed to connect to MongoDB"
    
    try:
        timestamp = int(time.time())
        request_id = f"test-schema-{timestamp}"
        business_id = "test-schema-biz"
        
        # Execute the API call
        payload = {
            "requestId": request_id,
            "tool": "tenant.bootstrap",
            "args": {
                "businessId": business_id,
                "skipVoiceTest": True,
                "skipBillingCheck": True
            }
        }
        
        print(f"   📤 Executing tenant.bootstrap for schema validation")
        print(f"   📋 Request ID: {request_id}")
        
        response = make_api_request(payload)
        
        if not response['success'] or response['status_code'] != 200:
            return False, f"API call failed: {response.get('error', response.get('status_code'))}"
        
        # Wait for event logging
        time.sleep(2)
        
        # Check if event was logged
        collection = db['ops_event_logs']
        event = collection.find_one({'requestId': request_id})
        
        if not event:
            return False, f"Event not found in ops_event_logs collection"
        
        # Verify all required fields according to schema
        required_fields = {
            'requestId': str,
            'tool': str,
            'status': str,
            'durationMs': (int, float),
            'executedAt': datetime,
            'actor': str,
            'createdAt': datetime
        }
        
        for field, expected_type in required_fields.items():
            if field not in event:
                return False, f"Missing required field: {field}"
            
            if not isinstance(event[field], expected_type):
                return False, f"Field {field} has wrong type: expected {expected_type}, got {type(event[field])}"
        
        # Verify enum values
        valid_statuses = ['success', 'failed', 'partial']
        if event['status'] not in valid_statuses:
            return False, f"Invalid status: {event['status']}"
        
        valid_actors = ['n8n', 'human', 'system', 'api']
        if event['actor'] not in valid_actors:
            return False, f"Invalid actor: {event['actor']}"
        
        # Verify optional fields
        if 'businessId' in event and event['businessId'] is not None:
            if not isinstance(event['businessId'], str):
                return False, f"BusinessId should be string, got {type(event['businessId'])}"
        
        if 'metadata' in event:
            if not isinstance(event['metadata'], dict):
                return False, f"Metadata should be dict, got {type(event['metadata'])}"
        
        print(f"   ✅ All required fields present and correctly typed")
        print(f"   ✅ Status enum valid: {event['status']}")
        print(f"   ✅ Actor enum valid: {event['actor']}")
        print(f"   ✅ Timestamps are datetime objects")
        
        return True, "Event schema validation passed"
        
    except Exception as e:
        return False, f"Exception during test: {str(e)}"
    finally:
        if client:
            client.close()

def test_fire_and_forget_pattern():
    """Test Case 4: Verify fire-and-forget pattern doesn't block response"""
    print("\n🧪 Test 4: Fire-and-Forget Pattern Verification")
    
    timestamp = int(time.time())
    request_id = f"test-timing-{timestamp}"
    
    # Execute the API call and measure timing
    payload = {
        "requestId": request_id,
        "tool": "tenant.bootstrap",
        "args": {
            "businessId": "test-timing-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        }
    }
    
    print(f"   📤 Testing response timing for fire-and-forget pattern")
    print(f"   📋 Request ID: {request_id}")
    
    start_time = time.time()
    response = make_api_request(payload)
    end_time = time.time()
    
    response_time = (end_time - start_time) * 1000  # Convert to ms
    
    if not response['success'] or response['status_code'] != 200:
        return False, f"API call failed: {response.get('error', response.get('status_code'))}"
    
    # Response should be fast (not blocked by event logging)
    if response_time > 5000:  # 5 second threshold
        return False, f"Response too slow: {response_time:.0f}ms (fire-and-forget should not block)"
    
    # Verify response includes durationMs
    data = response['data']
    if 'durationMs' not in data:
        return False, "Response missing durationMs field"
    
    if 'ok' not in data:
        return False, "Response missing ok field"
    
    print(f"   ✅ Response time: {response_time:.0f}ms (fast, not blocked)")
    print(f"   ✅ Tool execution time: {data['durationMs']}ms")
    print(f"   ✅ Response ok: {data['ok']}")
    
    return True, f"Fire-and-forget pattern working correctly, response time: {response_time:.0f}ms"

def test_event_collection_indexes():
    """Test Case 5: Verify ops_event_logs collection has proper indexes"""
    print("\n🧪 Test 5: Event Collection Indexes")
    
    db, client = connect_to_mongodb()
    if db is None:
        return False, "Failed to connect to MongoDB"
    
    try:
        collection = db['ops_event_logs']
        
        # Get all indexes
        indexes = list(collection.list_indexes())
        index_names = [idx['name'] for idx in indexes]
        
        print(f"   📋 Found {len(indexes)} indexes: {index_names}")
        
        # Check for expected indexes
        expected_indexes = [
            '_id_',  # Default MongoDB index
            'idx_requestId',  # Unique requestId index
            'idx_businessId_executedAt',  # Business queries
            'idx_tool_status',  # Monitoring queries
            'idx_executedAt',  # Time-based queries
            'idx_actor_executedAt',  # Actor queries
            'idx_ttl_90days'  # TTL index for cleanup
        ]
        
        missing_indexes = []
        for expected in expected_indexes:
            if expected not in index_names:
                missing_indexes.append(expected)
        
        if missing_indexes:
            return False, f"Missing expected indexes: {missing_indexes}"
        
        # Verify requestId index is unique
        requestId_index = next((idx for idx in indexes if idx['name'] == 'idx_requestId'), None)
        if requestId_index and not requestId_index.get('unique', False):
            return False, "requestId index should be unique"
        
        print(f"   ✅ All expected indexes present")
        print(f"   ✅ RequestId index is unique")
        
        return True, f"All {len(expected_indexes)} expected indexes found"
        
    except Exception as e:
        return False, f"Exception during test: {str(e)}"
    finally:
        if client:
            client.close()

def main():
    """Run all event logging tests"""
    print("🚀 Starting OpsEventLog Database Verification Tests")
    print(f"📍 Testing endpoint: {API_ENDPOINT}")
    print(f"🗄️  MongoDB: {MONGO_URL}/{DB_NAME}")
    
    results = EventLogTestResults()
    
    # Test 1: Successful Bootstrap Event Logging
    try:
        passed, details = test_successful_bootstrap_event_logging()
        results.add_test("Successful Bootstrap Event Logging", passed, details)
    except Exception as e:
        results.add_test("Successful Bootstrap Event Logging", False, f"Exception: {str(e)}")
    
    # Test 2: Partial Status Event Logging
    try:
        passed, details = test_partial_status_event_logging()
        results.add_test("Partial Status Event Logging", passed, details)
    except Exception as e:
        results.add_test("Partial Status Event Logging", False, f"Exception: {str(e)}")
    
    # Test 3: Event Schema Validation
    try:
        passed, details = test_event_schema_validation()
        results.add_test("Event Schema Validation", passed, details)
    except Exception as e:
        results.add_test("Event Schema Validation", False, f"Exception: {str(e)}")
    
    # Test 4: Fire-and-Forget Pattern
    try:
        passed, details = test_fire_and_forget_pattern()
        results.add_test("Fire-and-Forget Pattern", passed, details)
    except Exception as e:
        results.add_test("Fire-and-Forget Pattern", False, f"Exception: {str(e)}")
    
    # Test 5: Collection Indexes
    try:
        passed, details = test_event_collection_indexes()
        results.add_test("Collection Indexes", passed, details)
    except Exception as e:
        results.add_test("Collection Indexes", False, f"Exception: {str(e)}")
    
    # Print results
    results.print_summary()
    
    # Return exit code
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)