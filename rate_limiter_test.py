#!/usr/bin/env python3
"""
MongoDB-Backed Rate Limiter Test Suite for Ops Control Plane

Tests the MongoDB-backed rate limiter implementation as specified in the review request.

Test Cases:
1. Verify Rate Limit Counting in MongoDB
2. Verify Document Schema
3. Cold Start Simulation
4. Rate Limit Headers
5. Normal Operation Continues
6. Rate Limit Persistence Test
7. Window Key Format

Authentication: x-book8-internal-secret: ops-dev-secret-change-me
Database Collection: ops_rate_limits
"""

import requests
import json
import os
import time
import pymongo
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

# Get configuration from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-command-9.preview.emergentagent.com')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

# Authentication header for ops endpoints
OPS_SECRET = "ops-dev-secret-change-me"
HEADERS = {
    "x-book8-internal-secret": OPS_SECRET,
    "Content-Type": "application/json"
}

class TestResult:
    def __init__(self, name: str, passed: bool, details: str = "", response_data: Any = None):
        self.name = name
        self.passed = passed
        self.details = details
        self.response_data = response_data

def get_mongo_client():
    """Get MongoDB client connection"""
    try:
        client = pymongo.MongoClient(MONGO_URL)
        # Test connection
        client.admin.command('ping')
        return client
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return None

def make_request(method: str, url: str, headers: Optional[Dict] = None, data: Optional[Dict] = None, timeout: int = 30) -> requests.Response:
    """Make HTTP request with error handling"""
    try:
        if method.upper() == 'GET':
            return requests.get(url, headers=headers, timeout=timeout)
        elif method.upper() == 'POST':
            return requests.post(url, headers=headers, json=data, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def test_rate_limit_counting():
    """Test Case 1: Verify Rate Limit Counting in MongoDB"""
    print("\n📊 Test Case 1: Verify Rate Limit Counting in MongoDB")
    
    try:
        # Connect to MongoDB
        client = get_mongo_client()
        if not client:
            return TestResult("Rate Limit Counting", False, "❌ Failed to connect to MongoDB")
        
        db = client[DB_NAME]
        collection = db['ops_rate_limits']
        
        # Clear any existing rate limit data for our test
        test_business_id = "rate-test"
        print(f"🧹 Clearing existing rate limit data for businessId: {test_business_id}")
        
        # Make 10+ quick requests to POST /api/internal/ops/execute
        url = f"{BASE_URL}/api/internal/ops/execute"
        request_count = 12
        successful_requests = 0
        
        print(f"🚀 Making {request_count} requests to {url}")
        
        for i in range(1, request_count + 1):
            request_data = {
                "tool": "tenant.status",
                "payload": {"businessId": test_business_id},
                "meta": {"requestId": f"rate-count-test-{i}"}
            }
            
            try:
                response = make_request('POST', url, headers=HEADERS, data=request_data)
                if response.status_code in [200, 201]:
                    successful_requests += 1
                    print(f"  ✅ Request {i}: {response.status_code}")
                else:
                    print(f"  ❌ Request {i}: {response.status_code} - {response.text[:100]}")
            except Exception as e:
                print(f"  ❌ Request {i}: Exception - {str(e)}")
        
        # Wait a moment for MongoDB writes to complete
        time.sleep(2)
        
        # Check MongoDB ops_rate_limits collection
        print(f"🔍 Checking ops_rate_limits collection...")
        rate_limit_docs = list(collection.find({}))
        
        print(f"📋 Found {len(rate_limit_docs)} rate limit documents")
        
        # Look for documents with count >= 10
        high_count_docs = [doc for doc in rate_limit_docs if doc.get('count', 0) >= 10]
        
        if high_count_docs:
            doc = high_count_docs[0]
            count = doc.get('count', 0)
            key = doc.get('key', 'unknown')
            return TestResult("Rate Limit Counting", True, 
                            f"✅ Found rate limit document with count={count}, key={key}. Made {successful_requests} successful requests.")
        else:
            # Show what we found for debugging
            doc_info = []
            for doc in rate_limit_docs:
                doc_info.append(f"key={doc.get('key', 'unknown')}, count={doc.get('count', 0)}")
            
            return TestResult("Rate Limit Counting", False, 
                            f"❌ No rate limit document found with count >= 10. Found {len(rate_limit_docs)} docs: {'; '.join(doc_info)}")
            
    except Exception as e:
        return TestResult("Rate Limit Counting", False, f"❌ Exception: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

def test_document_schema():
    """Test Case 2: Verify Document Schema"""
    print("\n📋 Test Case 2: Verify Document Schema")
    
    try:
        # Connect to MongoDB
        client = get_mongo_client()
        if not client:
            return TestResult("Document Schema", False, "❌ Failed to connect to MongoDB")
        
        db = client[DB_NAME]
        collection = db['ops_rate_limits']
        
        # Get a sample document
        sample_doc = collection.find_one({})
        
        if not sample_doc:
            return TestResult("Document Schema", False, "❌ No rate limit documents found in collection")
        
        # Check required fields
        required_fields = ['key', 'count', 'windowStart', 'expiresAt']
        missing_fields = []
        field_types = {}
        
        for field in required_fields:
            if field not in sample_doc:
                missing_fields.append(field)
            else:
                field_types[field] = type(sample_doc[field]).__name__
        
        if missing_fields:
            return TestResult("Document Schema", False, 
                            f"❌ Missing required fields: {missing_fields}")
        
        # Verify field types
        key = sample_doc['key']
        count = sample_doc['count']
        window_start = sample_doc['windowStart']
        expires_at = sample_doc['expiresAt']
        
        # Check key format: {keyId}|{tool}|{windowId}
        key_parts = key.split('|')
        if len(key_parts) != 3:
            return TestResult("Document Schema", False, 
                            f"❌ Invalid key format. Expected 3 parts separated by '|', got: {key}")
        
        key_id, tool, window_id = key_parts
        
        # Verify types
        type_checks = []
        if isinstance(count, int) and count > 0:
            type_checks.append("count: int ✅")
        else:
            type_checks.append(f"count: {type(count).__name__} ❌")
        
        if isinstance(window_start, datetime):
            type_checks.append("windowStart: datetime ✅")
        else:
            type_checks.append(f"windowStart: {type(window_start).__name__} ❌")
        
        if isinstance(expires_at, datetime):
            type_checks.append("expiresAt: datetime ✅")
        else:
            type_checks.append(f"expiresAt: {type(expires_at).__name__} ❌")
        
        # Check if expiresAt is ~2 min after windowStart
        if isinstance(window_start, datetime) and isinstance(expires_at, datetime):
            time_diff = (expires_at - window_start).total_seconds()
            if 110 <= time_diff <= 130:  # ~2 minutes (60s window + 60s buffer)
                type_checks.append(f"expiresAt timing: {time_diff}s ✅")
            else:
                type_checks.append(f"expiresAt timing: {time_diff}s ❌")
        
        all_types_valid = all("✅" in check for check in type_checks)
        
        details = f"Key format: {key_id}|{tool}|{window_id} ✅\n" + "\n".join(type_checks)
        
        return TestResult("Document Schema", all_types_valid, 
                        f"{'✅' if all_types_valid else '❌'} Schema validation:\n{details}")
        
    except Exception as e:
        return TestResult("Document Schema", False, f"❌ Exception: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

def test_cold_start_simulation():
    """Test Case 3: Cold Start Simulation"""
    print("\n🔄 Test Case 3: Cold Start Simulation")
    
    try:
        # Connect to MongoDB
        client = get_mongo_client()
        if not client:
            return TestResult("Cold Start Simulation", False, "❌ Failed to connect to MongoDB")
        
        db = client[DB_NAME]
        collection = db['ops_rate_limits']
        
        # Delete all documents from ops_rate_limits
        delete_result = collection.delete_many({})
        print(f"🗑️ Deleted {delete_result.deleted_count} rate limit documents")
        
        # Make 5 new requests
        url = f"{BASE_URL}/api/internal/ops/execute"
        test_business_id = "cold-start-test"
        request_count = 5
        successful_requests = 0
        
        print(f"🚀 Making {request_count} requests after cold start...")
        
        for i in range(1, request_count + 1):
            request_data = {
                "tool": "tenant.status",
                "payload": {"businessId": test_business_id},
                "meta": {"requestId": f"cold-start-test-{i}"}
            }
            
            try:
                response = make_request('POST', url, headers=HEADERS, data=request_data)
                if response.status_code in [200, 201]:
                    successful_requests += 1
                    print(f"  ✅ Request {i}: {response.status_code}")
                else:
                    print(f"  ❌ Request {i}: {response.status_code}")
            except Exception as e:
                print(f"  ❌ Request {i}: Exception - {str(e)}")
        
        # Wait for MongoDB writes
        time.sleep(2)
        
        # Verify new rate limit document created with count=5
        rate_limit_docs = list(collection.find({}))
        
        if not rate_limit_docs:
            return TestResult("Cold Start Simulation", False, 
                            "❌ No rate limit documents created after cold start")
        
        # Find document with count=5
        matching_docs = [doc for doc in rate_limit_docs if doc.get('count') == successful_requests]
        
        if matching_docs:
            doc = matching_docs[0]
            return TestResult("Cold Start Simulation", True, 
                            f"✅ Cold start simulation successful. New document created with count={doc['count']}, key={doc['key']}")
        else:
            doc_counts = [doc.get('count', 0) for doc in rate_limit_docs]
            return TestResult("Cold Start Simulation", False, 
                            f"❌ Expected document with count={successful_requests}, found counts: {doc_counts}")
        
    except Exception as e:
        return TestResult("Cold Start Simulation", False, f"❌ Exception: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

def test_rate_limit_headers():
    """Test Case 4: Rate Limit Headers"""
    print("\n📤 Test Case 4: Rate Limit Headers")
    
    try:
        url = f"{BASE_URL}/api/internal/ops/execute"
        request_data = {
            "tool": "tenant.status",
            "payload": {"businessId": "header-test"},
            "meta": {"requestId": "header-test-1"}
        }
        
        response = make_request('POST', url, headers=HEADERS, data=request_data)
        
        # Check for rate limit headers
        expected_headers = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        found_headers = []
        missing_headers = []
        
        for header in expected_headers:
            if header in response.headers:
                found_headers.append(f"{header}: {response.headers[header]}")
            else:
                missing_headers.append(header)
        
        if missing_headers:
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Missing headers: {missing_headers}. Found: {found_headers}")
        
        # Verify header values
        limit = int(response.headers.get('X-RateLimit-Limit', 0))
        remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
        reset_timestamp = int(response.headers.get('X-RateLimit-Reset', 0))
        
        # Basic validation
        if limit != 100:  # Default limit should be 100
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Expected limit=100, got {limit}")
        
        if remaining < 0 or remaining > limit:
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Invalid remaining value: {remaining} (limit: {limit})")
        
        # Check if reset timestamp is reasonable (within next hour)
        current_time = int(time.time())
        if reset_timestamp < current_time or reset_timestamp > current_time + 3600:
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Invalid reset timestamp: {reset_timestamp} (current: {current_time})")
        
        return TestResult("Rate Limit Headers", True, 
                        f"✅ All rate limit headers present and valid:\n" + "\n".join(found_headers))
        
    except Exception as e:
        return TestResult("Rate Limit Headers", False, f"❌ Exception: {str(e)}")

def test_normal_operation():
    """Test Case 5: Normal Operation Continues"""
    print("\n✅ Test Case 5: Normal Operation Continues")
    
    try:
        url = f"{BASE_URL}/api/internal/ops/execute"
        
        # Make several requests and verify they succeed (under limit)
        success_count = 0
        total_requests = 5
        
        for i in range(1, total_requests + 1):
            request_data = {
                "tool": "tenant.status",
                "payload": {"businessId": "normal-ops-test"},
                "meta": {"requestId": f"normal-ops-{i}"}
            }
            
            try:
                response = make_request('POST', url, headers=HEADERS, data=request_data)
                if response.status_code == 200:
                    success_count += 1
                    print(f"  ✅ Request {i}: {response.status_code}")
                else:
                    print(f"  ❌ Request {i}: {response.status_code}")
            except Exception as e:
                print(f"  ❌ Request {i}: Exception - {str(e)}")
        
        if success_count == total_requests:
            return TestResult("Normal Operation", True, 
                            f"✅ All {success_count}/{total_requests} requests succeeded (under rate limit)")
        else:
            return TestResult("Normal Operation", False, 
                            f"❌ Only {success_count}/{total_requests} requests succeeded")
        
    except Exception as e:
        return TestResult("Normal Operation", False, f"❌ Exception: {str(e)}")

def test_rate_limit_persistence():
    """Test Case 6: Rate Limit Persistence Test"""
    print("\n💾 Test Case 6: Rate Limit Persistence Test")
    
    try:
        # Connect to MongoDB
        client = get_mongo_client()
        if not client:
            return TestResult("Rate Limit Persistence", False, "❌ Failed to connect to MongoDB")
        
        db = client[DB_NAME]
        collection = db['ops_rate_limits']
        
        url = f"{BASE_URL}/api/internal/ops/execute"
        test_business_id = "persistence-test"
        
        # Make 5 requests
        print("🚀 Making 5 initial requests...")
        for i in range(1, 6):
            request_data = {
                "tool": "tenant.status",
                "payload": {"businessId": test_business_id},
                "meta": {"requestId": f"persistence-test-{i}"}
            }
            response = make_request('POST', url, headers=HEADERS, data=request_data)
            print(f"  Request {i}: {response.status_code}")
        
        # Check count in MongoDB
        time.sleep(1)
        docs_after_first = list(collection.find({}))
        first_count = max([doc.get('count', 0) for doc in docs_after_first]) if docs_after_first else 0
        print(f"📊 Count after first batch: {first_count}")
        
        # Wait a few seconds (simulating time gap)
        print("⏳ Waiting 3 seconds...")
        time.sleep(3)
        
        # Make 5 more requests
        print("🚀 Making 5 more requests...")
        for i in range(6, 11):
            request_data = {
                "tool": "tenant.status",
                "payload": {"businessId": test_business_id},
                "meta": {"requestId": f"persistence-test-{i}"}
            }
            response = make_request('POST', url, headers=HEADERS, data=request_data)
            print(f"  Request {i}: {response.status_code}")
        
        # Check final count in MongoDB
        time.sleep(1)
        docs_after_second = list(collection.find({}))
        final_count = max([doc.get('count', 0) for doc in docs_after_second]) if docs_after_second else 0
        print(f"📊 Count after second batch: {final_count}")
        
        # Verify count is now 10 (persisted across "cold starts")
        if final_count >= 10:
            return TestResult("Rate Limit Persistence", True, 
                            f"✅ Persistence verified: count increased from {first_count} to {final_count}")
        else:
            return TestResult("Rate Limit Persistence", False, 
                            f"❌ Persistence failed: expected count >= 10, got {final_count}")
        
    except Exception as e:
        return TestResult("Rate Limit Persistence", False, f"❌ Exception: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

def test_window_key_format():
    """Test Case 7: Window Key Format"""
    print("\n🔑 Test Case 7: Window Key Format")
    
    try:
        # Connect to MongoDB
        client = get_mongo_client()
        if not client:
            return TestResult("Window Key Format", False, "❌ Failed to connect to MongoDB")
        
        db = client[DB_NAME]
        collection = db['ops_rate_limits']
        
        # Get sample documents
        sample_docs = list(collection.find({}).limit(5))
        
        if not sample_docs:
            return TestResult("Window Key Format", False, "❌ No rate limit documents found")
        
        valid_keys = []
        invalid_keys = []
        
        for doc in sample_docs:
            key = doc.get('key', '')
            
            # Check key format: {keyId}|{tool}|{windowId}
            parts = key.split('|')
            
            if len(parts) == 3:
                key_id, tool, window_id = parts
                
                # Verify key identifier format (should start with 'key_')
                if key_id.startswith('key_'):
                    # Verify tool name or 'all'
                    if tool in ['tenant.status', 'tenant.bootstrap', 'all'] or tool.startswith('tenant.'):
                        # Verify window ID is numeric (minute-based timestamp)
                        if window_id.isdigit():
                            valid_keys.append(f"{key} ✅")
                        else:
                            invalid_keys.append(f"{key} ❌ (invalid windowId)")
                    else:
                        invalid_keys.append(f"{key} ❌ (invalid tool)")
                else:
                    invalid_keys.append(f"{key} ❌ (invalid keyId)")
            else:
                invalid_keys.append(f"{key} ❌ (wrong format)")
        
        if invalid_keys:
            return TestResult("Window Key Format", False, 
                            f"❌ Invalid key formats found:\n" + "\n".join(invalid_keys))
        
        return TestResult("Window Key Format", True, 
                        f"✅ All {len(valid_keys)} keys have correct format:\n" + "\n".join(valid_keys))
        
    except Exception as e:
        return TestResult("Window Key Format", False, f"❌ Exception: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

def run_all_tests():
    """Run all test cases and return results"""
    print(f"🚀 Starting MongoDB-Backed Rate Limiter Tests")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🔐 Auth Header: x-book8-internal-secret: {OPS_SECRET}")
    print(f"🗄️ MongoDB: {MONGO_URL}/{DB_NAME}")
    print(f"📊 Collection: ops_rate_limits")
    print("=" * 80)
    
    results = []
    
    # Test 1: Rate Limit Counting in MongoDB
    results.append(test_rate_limit_counting())
    
    # Test 2: Document Schema
    results.append(test_document_schema())
    
    # Test 3: Cold Start Simulation
    results.append(test_cold_start_simulation())
    
    # Test 4: Rate Limit Headers
    results.append(test_rate_limit_headers())
    
    # Test 5: Normal Operation Continues
    results.append(test_normal_operation())
    
    # Test 6: Rate Limit Persistence Test
    results.append(test_rate_limit_persistence())
    
    # Test 7: Window Key Format
    results.append(test_window_key_format())
    
    return results

def print_summary(results):
    """Print test summary"""
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    
    for i, result in enumerate(results, 1):
        status = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"{i:2d}. {status} - {result.name}")
        if result.details:
            # Handle multi-line details
            lines = result.details.split('\n')
            for line in lines:
                print(f"    {line}")
    
    print("\n" + "=" * 80)
    print(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! MongoDB-backed rate limiter is working correctly.")
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please review the failures above.")
    
    return passed == total

if __name__ == "__main__":
    try:
        results = run_all_tests()
        all_passed = print_summary(results)
        exit(0 if all_passed else 1)
    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {str(e)}")
        exit(1)