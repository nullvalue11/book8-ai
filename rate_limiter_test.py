#!/usr/bin/env python3
"""
MongoDB-Backed Rate Limiter Test Suite for Book8 AI

Tests the MongoDB-backed rate limiter implementation for the ops control plane.
Focuses on verifying all 7 test cases from the review request.

Test Cases:
1. Rate Limit Counting in MongoDB
2. Document Schema Validation
3. Cold Start Simulation
4. Rate Limit Headers in Successful Responses (previously failing)
5. Normal Operation
6. Rate Limit Persistence
7. Window Key Format

Authentication: x-book8-internal-secret: ops-dev-secret-change-me
Endpoint: POST /api/internal/ops/execute
Collection: ops_rate_limits
"""

import requests
import json
import os
import time
import uuid
from typing import Dict, Any, Optional
from pymongo import MongoClient
from datetime import datetime

# Get configuration from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://oauth-fix-10.preview.emergentagent.com')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

# Authentication header
AUTH_HEADER = 'ops-dev-secret-change-me'
COLLECTION_NAME = 'ops_rate_limits'

class TestResult:
    def __init__(self, name: str, passed: bool, details: str = "", response_data: Any = None):
        self.name = name
        self.passed = passed
        self.details = details
        self.response_data = response_data

def make_request(method: str, url: str, headers: Optional[Dict] = None, data: Optional[Dict] = None, timeout: int = 30) -> requests.Response:
    """Make HTTP request with error handling"""
    try:
        if method.upper() == 'POST':
            return requests.post(url, headers=headers, json=data, timeout=timeout)
        elif method.upper() == 'GET':
            return requests.get(url, headers=headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        raise

def get_mongo_collection():
    """Get MongoDB collection for rate limits"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        return db[COLLECTION_NAME]
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return None

def test_1_rate_limit_counting():
    """Test Case 1: Rate Limit Counting in MongoDB"""
    print("\n🔢 Test Case 1: Rate Limit Counting in MongoDB")
    
    try:
        # Clear any existing rate limit data
        collection = get_mongo_collection()
        if collection is None:
            return TestResult("Rate Limit Counting", False, "❌ MongoDB connection failed")
        
        # Get initial count
        initial_count = collection.count_documents({})
        print(f"Initial documents in {COLLECTION_NAME}: {initial_count}")
        
        # Make 10+ requests to trigger rate limiting
        url = f"{BASE_URL}/api/internal/ops/execute"
        headers = {"x-book8-internal-secret": AUTH_HEADER, "Content-Type": "application/json"}
        
        request_data = {
            "tool": "tenant.ensure",
            "requestId": str(uuid.uuid4()),
            "args": {"businessId": "rate-limit-test-123"}
        }
        
        successful_requests = 0
        for i in range(12):  # Make 12 requests to exceed typical limits
            try:
                request_data["requestId"] = f"rate-test-{i}-{uuid.uuid4()}"
                response = make_request('POST', url, headers=headers, data=request_data)
                if response.status_code in [200, 429]:  # Both success and rate limit are expected
                    successful_requests += 1
                print(f"Request {i+1}: {response.status_code}")
                time.sleep(0.1)  # Small delay between requests
            except Exception as e:
                print(f"Request {i+1} failed: {e}")
        
        # Check MongoDB for rate limit documents
        final_count = collection.count_documents({})
        rate_limit_docs = list(collection.find({}))
        
        print(f"Final documents in {COLLECTION_NAME}: {final_count}")
        print(f"Successful requests made: {successful_requests}")
        
        # Verify we have rate limit documents with counts >= 10
        high_count_docs = [doc for doc in rate_limit_docs if doc.get('count', 0) >= 10]
        
        if len(high_count_docs) > 0:
            max_count = max(doc.get('count', 0) for doc in rate_limit_docs)
            return TestResult("Rate Limit Counting", True, 
                            f"✅ MongoDB rate limiting working! Found {len(rate_limit_docs)} documents, max count: {max_count}")
        else:
            return TestResult("Rate Limit Counting", False, 
                            f"❌ No documents with count >= 10 found. Documents: {len(rate_limit_docs)}")
            
    except Exception as e:
        return TestResult("Rate Limit Counting", False, f"❌ Exception: {str(e)}")

def test_2_document_schema_validation():
    """Test Case 2: Document Schema Validation"""
    print("\n📋 Test Case 2: Document Schema Validation")
    
    try:
        collection = get_mongo_collection()
        if collection is None:
            return TestResult("Document Schema", False, "❌ MongoDB connection failed")
        
        # Get all rate limit documents
        docs = list(collection.find({}))
        
        if len(docs) == 0:
            return TestResult("Document Schema", False, "❌ No rate limit documents found to validate")
        
        # Check schema for each document
        required_fields = ['key', 'count', 'windowStart', 'expiresAt']
        valid_docs = 0
        schema_errors = []
        
        for doc in docs:
            doc_valid = True
            missing_fields = []
            
            for field in required_fields:
                if field not in doc:
                    missing_fields.append(field)
                    doc_valid = False
            
            if doc_valid:
                # Validate key format: {keyId}|{tool}|{windowId}
                key = doc.get('key', '')
                key_parts = key.split('|')
                if len(key_parts) != 3:
                    schema_errors.append(f"Invalid key format: {key} (expected 3 parts)")
                    doc_valid = False
                else:
                    # Validate key parts
                    keyId, tool, windowId = key_parts
                    if not keyId.startswith('key_'):
                        schema_errors.append(f"Invalid keyId format: {keyId} (expected key_*)")
                        doc_valid = False
                    if not windowId.isdigit():
                        schema_errors.append(f"Invalid windowId format: {windowId} (expected numeric)")
                        doc_valid = False
                
                # Validate count is numeric
                if not isinstance(doc.get('count'), int):
                    schema_errors.append(f"Invalid count type: {type(doc.get('count'))} (expected int)")
                    doc_valid = False
                
                # Validate dates
                if not isinstance(doc.get('windowStart'), datetime):
                    schema_errors.append(f"Invalid windowStart type: {type(doc.get('windowStart'))} (expected datetime)")
                    doc_valid = False
                
                if not isinstance(doc.get('expiresAt'), datetime):
                    schema_errors.append(f"Invalid expiresAt type: {type(doc.get('expiresAt'))} (expected datetime)")
                    doc_valid = False
            else:
                schema_errors.append(f"Missing fields: {missing_fields}")
            
            if doc_valid:
                valid_docs += 1
        
        if valid_docs == len(docs) and len(schema_errors) == 0:
            sample_doc = docs[0]
            return TestResult("Document Schema", True, 
                            f"✅ All {len(docs)} documents have valid schema. Sample key: {sample_doc.get('key')}")
        else:
            return TestResult("Document Schema", False, 
                            f"❌ Schema validation failed. Valid: {valid_docs}/{len(docs)}. Errors: {schema_errors[:3]}")
            
    except Exception as e:
        return TestResult("Document Schema", False, f"❌ Exception: {str(e)}")

def test_3_cold_start_simulation():
    """Test Case 3: Cold Start Simulation"""
    print("\n🆕 Test Case 3: Cold Start Simulation")
    
    try:
        collection = get_mongo_collection()
        if collection is None:
            return TestResult("Cold Start Simulation", False, "❌ MongoDB connection failed")
        
        # Delete all documents to simulate cold start
        delete_result = collection.delete_many({})
        print(f"Deleted {delete_result.deleted_count} existing documents")
        
        # Verify collection is empty
        initial_count = collection.count_documents({})
        if initial_count != 0:
            return TestResult("Cold Start Simulation", False, f"❌ Failed to clear collection, still has {initial_count} docs")
        
        # Make 5 requests to create new documents
        url = f"{BASE_URL}/api/internal/ops/execute"
        headers = {"x-book8-internal-secret": AUTH_HEADER, "Content-Type": "application/json"}
        
        successful_requests = 0
        for i in range(5):
            try:
                request_data = {
                    "tool": "tenant.ensure",
                    "requestId": f"cold-start-{i}-{uuid.uuid4()}",
                    "args": {"businessId": f"cold-start-test-{i}"}
                }
                response = make_request('POST', url, headers=headers, data=request_data)
                if response.status_code == 200:
                    successful_requests += 1
                print(f"Cold start request {i+1}: {response.status_code}")
                time.sleep(0.1)
            except Exception as e:
                print(f"Cold start request {i+1} failed: {e}")
        
        # Check if new documents were created
        final_count = collection.count_documents({})
        new_docs = list(collection.find({}))
        
        if final_count > 0 and successful_requests > 0:
            # Verify the new document has correct count
            max_count = max(doc.get('count', 0) for doc in new_docs)
            return TestResult("Cold Start Simulation", True, 
                            f"✅ Cold start successful! Created {final_count} new documents, max count: {max_count}")
        else:
            return TestResult("Cold Start Simulation", False, 
                            f"❌ Cold start failed. Documents: {final_count}, Successful requests: {successful_requests}")
            
    except Exception as e:
        return TestResult("Cold Start Simulation", False, f"❌ Exception: {str(e)}")

def test_4_rate_limit_headers():
    """Test Case 4: Rate Limit Headers in Successful Responses (Previously Failing)"""
    print("\n📊 Test Case 4: Rate Limit Headers in Successful Responses")
    
    try:
        url = f"{BASE_URL}/api/internal/ops/execute"
        headers = {"x-book8-internal-secret": AUTH_HEADER, "Content-Type": "application/json"}
        
        request_data = {
            "tool": "tenant.ensure",
            "requestId": f"headers-test-{uuid.uuid4()}",
            "args": {"businessId": "headers-test-123"}
        }
        
        response = make_request('POST', url, headers=headers, data=request_data)
        
        # Check for successful response first
        if response.status_code != 200:
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Request failed with status {response.status_code}: {response.text}")
        
        # Check for required rate limit headers
        required_headers = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        found_headers = {}
        missing_headers = []
        
        for header in required_headers:
            if header in response.headers:
                found_headers[header] = response.headers[header]
            else:
                missing_headers.append(header)
        
        print(f"Response headers: {dict(response.headers)}")
        print(f"Found rate limit headers: {found_headers}")
        
        if len(missing_headers) == 0:
            return TestResult("Rate Limit Headers", True, 
                            f"✅ All rate limit headers present! {found_headers}")
        else:
            return TestResult("Rate Limit Headers", False, 
                            f"❌ Missing headers: {missing_headers}. Found: {found_headers}")
            
    except Exception as e:
        return TestResult("Rate Limit Headers", False, f"❌ Exception: {str(e)}")

def test_5_normal_operation():
    """Test Case 5: Normal Operation"""
    print("\n✅ Test Case 5: Normal Operation")
    
    try:
        url = f"{BASE_URL}/api/internal/ops/execute"
        headers = {"x-book8-internal-secret": AUTH_HEADER, "Content-Type": "application/json"}
        
        # Make a few requests under the rate limit
        successful_requests = 0
        for i in range(3):
            try:
                request_data = {
                    "tool": "tenant.ensure",
                    "requestId": f"normal-op-{i}-{uuid.uuid4()}",
                    "args": {"businessId": f"normal-test-{i}"}
                }
                response = make_request('POST', url, headers=headers, data=request_data)
                if response.status_code == 200:
                    successful_requests += 1
                print(f"Normal operation request {i+1}: {response.status_code}")
                time.sleep(0.2)
            except Exception as e:
                print(f"Normal operation request {i+1} failed: {e}")
        
        if successful_requests >= 2:  # At least 2 out of 3 should succeed
            return TestResult("Normal Operation", True, 
                            f"✅ Normal operation working! {successful_requests}/3 requests succeeded")
        else:
            return TestResult("Normal Operation", False, 
                            f"❌ Normal operation failed. Only {successful_requests}/3 requests succeeded")
            
    except Exception as e:
        return TestResult("Normal Operation", False, f"❌ Exception: {str(e)}")

def test_6_rate_limit_persistence():
    """Test Case 6: Rate Limit Persistence"""
    print("\n💾 Test Case 6: Rate Limit Persistence")
    
    try:
        collection = get_mongo_collection()
        if collection is None:
            return TestResult("Rate Limit Persistence", False, "❌ MongoDB connection failed")
        
        url = f"{BASE_URL}/api/internal/ops/execute"
        headers = {"x-book8-internal-secret": AUTH_HEADER, "Content-Type": "application/json"}
        
        # Make initial requests and check count
        initial_requests = 3
        for i in range(initial_requests):
            request_data = {
                "tool": "tenant.ensure",
                "requestId": f"persist-1-{i}-{uuid.uuid4()}",
                "args": {"businessId": f"persist-test-{i}"}
            }
            response = make_request('POST', url, headers=headers, data=request_data)
            print(f"Initial request {i+1}: {response.status_code}")
            time.sleep(0.1)
        
        # Get count after initial requests
        docs_after_initial = list(collection.find({}))
        if len(docs_after_initial) == 0:
            return TestResult("Rate Limit Persistence", False, "❌ No rate limit documents found after initial requests")
        
        initial_max_count = max(doc.get('count', 0) for doc in docs_after_initial)
        print(f"Count after initial requests: {initial_max_count}")
        
        # Wait a bit, then make more requests
        time.sleep(1)
        
        additional_requests = 2
        for i in range(additional_requests):
            request_data = {
                "tool": "tenant.ensure",
                "requestId": f"persist-2-{i}-{uuid.uuid4()}",
                "args": {"businessId": f"persist-test-additional-{i}"}
            }
            response = make_request('POST', url, headers=headers, data=request_data)
            print(f"Additional request {i+1}: {response.status_code}")
            time.sleep(0.1)
        
        # Get count after additional requests
        docs_after_additional = list(collection.find({}))
        final_max_count = max(doc.get('count', 0) for doc in docs_after_additional)
        print(f"Count after additional requests: {final_max_count}")
        
        # Verify count increased (not reset)
        if final_max_count > initial_max_count:
            return TestResult("Rate Limit Persistence", True, 
                            f"✅ Rate limit persistence working! Count increased from {initial_max_count} to {final_max_count}")
        else:
            return TestResult("Rate Limit Persistence", False, 
                            f"❌ Rate limit not persisting. Count: {initial_max_count} → {final_max_count}")
            
    except Exception as e:
        return TestResult("Rate Limit Persistence", False, f"❌ Exception: {str(e)}")

def test_7_window_key_format():
    """Test Case 7: Window Key Format"""
    print("\n🔑 Test Case 7: Window Key Format")
    
    try:
        collection = get_mongo_collection()
        if collection is None:
            return TestResult("Window Key Format", False, "❌ MongoDB connection failed")
        
        # Get all rate limit documents
        docs = list(collection.find({}))
        
        if len(docs) == 0:
            return TestResult("Window Key Format", False, "❌ No rate limit documents found to check key format")
        
        # Verify key format: {caller}|{tool}|{windowId}
        valid_keys = 0
        invalid_keys = []
        
        for doc in docs:
            key = doc.get('key', '')
            key_parts = key.split('|')
            
            if len(key_parts) == 3:
                caller, tool, windowId = key_parts
                
                # Validate caller format (should be key_*)
                if caller.startswith('key_') and len(caller) > 4:
                    # Validate tool (should be a valid tool name or 'all')
                    if tool in ['tenant.ensure', 'all'] or tool.startswith('tenant.'):
                        # Validate windowId (should be numeric)
                        if windowId.isdigit():
                            valid_keys += 1
                        else:
                            invalid_keys.append(f"{key} (invalid windowId: {windowId})")
                    else:
                        invalid_keys.append(f"{key} (invalid tool: {tool})")
                else:
                    invalid_keys.append(f"{key} (invalid caller: {caller})")
            else:
                invalid_keys.append(f"{key} (wrong format, expected 3 parts)")
        
        if valid_keys == len(docs):
            sample_key = docs[0].get('key', '')
            return TestResult("Window Key Format", True, 
                            f"✅ All {len(docs)} keys have correct format! Sample: {sample_key}")
        else:
            return TestResult("Window Key Format", False, 
                            f"❌ Key format validation failed. Valid: {valid_keys}/{len(docs)}. Invalid: {invalid_keys[:3]}")
            
    except Exception as e:
        return TestResult("Window Key Format", False, f"❌ Exception: {str(e)}")

def run_all_tests():
    """Run all rate limiter test cases"""
    print(f"🚀 Starting MongoDB-Backed Rate Limiter Test Suite")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🔐 Auth Header: x-book8-internal-secret: {AUTH_HEADER[:10]}...")
    print(f"🗄️  MongoDB: {MONGO_URL}")
    print(f"📊 Collection: {COLLECTION_NAME}")
    print("=" * 80)
    
    results = []
    
    # Test 1: Rate Limit Counting in MongoDB
    results.append(test_1_rate_limit_counting())
    
    # Test 2: Document Schema Validation
    results.append(test_2_document_schema_validation())
    
    # Test 3: Cold Start Simulation
    results.append(test_3_cold_start_simulation())
    
    # Test 4: Rate Limit Headers in Successful Responses (Previously Failing)
    results.append(test_4_rate_limit_headers())
    
    # Test 5: Normal Operation
    results.append(test_5_normal_operation())
    
    # Test 6: Rate Limit Persistence
    results.append(test_6_rate_limit_persistence())
    
    # Test 7: Window Key Format
    results.append(test_7_window_key_format())
    
    return results

def print_summary(results):
    """Print test summary"""
    print("\n" + "=" * 80)
    print("📊 MONGODB RATE LIMITER TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    
    for i, result in enumerate(results, 1):
        status = "✅ PASS" if result.passed else "❌ FAIL"
        print(f"{i:2d}. {status} - {result.name}")
        if result.details:
            print(f"    {result.details}")
    
    print("\n" + "=" * 80)
    print(f"🎯 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! MongoDB-backed rate limiter is working correctly.")
        print("✅ Test #4 (Rate Limit Headers) - Previously failing test now passes!")
    else:
        print(f"⚠️  {total - passed} test(s) failed. Please review the failures above.")
        if any(not r.passed and "Rate Limit Headers" in r.name for r in results):
            print("❌ Test #4 (Rate Limit Headers) still failing - needs investigation")
    
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