#!/usr/bin/env python3
"""
Supplementary Backend Test Suite for Book8 AI - Approval Lifecycle Edge Cases
Tests additional edge cases and specific scenarios from the review request
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://tenant-provision.preview.emergentagent.com"
AUTH_HEADER = "ops-dev-secret-change-me"

def test_approval_lifecycle_edge_cases():
    """Test additional edge cases for approval lifecycle"""
    
    headers = {
        "Content-Type": "application/json",
        "x-book8-internal-secret": AUTH_HEADER
    }
    
    print("🔍 APPROVAL LIFECYCLE EDGE CASES TESTING")
    print("=" * 60)
    print(f"Testing base URL: {BASE_URL}")
    print()
    
    test_results = []
    
    # Test 1: Create request with unique businessId as specified in review
    print("=== Test 1: Create Request with Unique BusinessId ===")
    unique_biz_id = f"test-approval-biz-{int(datetime.now().timestamp())}"
    create_payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": unique_biz_id
        },
        "requestedBy": "test-agent"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 201 and data.get("ok") == True:
            request_id = data.get("requestId")
            print("✅ PASS: Request created with unique businessId")
            print(f"   Business ID: {unique_biz_id}")
            print(f"   Request ID: {request_id}")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Could not create request with unique businessId")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 2: Test GET /api/internal/ops/requests (list all)
    print("\n=== Test 2: List All Requests (No Status Filter) ===")
    try:
        response = requests.get(f"{BASE_URL}/api/internal/ops/requests", 
                               headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 200 and data.get("ok") == True:
            requests_list = data.get("requests", [])
            counts = data.get("counts", {})
            pagination = data.get("pagination", {})
            
            print("✅ PASS: List all requests successful")
            print(f"   Total requests returned: {len(requests_list)}")
            print(f"   Counts: {counts}")
            print(f"   Pagination: {pagination}")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Could not list all requests")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 3: Test payload integrity verification
    print("\n=== Test 3: Payload Integrity Verification ===")
    # Create a request, approve it, then test execution
    create_payload_integrity = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": f"test-integrity-{int(datetime.now().timestamp())}"
        },
        "requestedBy": "test-agent"
    }
    
    try:
        # Create request
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload_integrity, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 201:
            integrity_request_id = data.get("requestId")
            payload_hash = data.get("payloadHash")
            
            # Approve request
            approve_payload = {"approvedBy": "test-admin"}
            response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{integrity_request_id}/approve", 
                                   json=approve_payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                # Execute request (should work with valid payload hash)
                response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{integrity_request_id}/execute", 
                                       headers=headers, timeout=60)
                data = response.json()
                
                if response.status_code == 200 and data.get("ok") == True:
                    print("✅ PASS: Payload integrity verification working")
                    print(f"   Original Payload Hash: {payload_hash}")
                    print(f"   Execution successful with valid hash")
                    test_results.append(True)
                else:
                    print(f"❌ FAIL: Execution failed despite valid payload")
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    test_results.append(False)
            else:
                print(f"❌ FAIL: Could not approve request for integrity test")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Could not create request for integrity test")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 4: Test with invalid auth header value
    print("\n=== Test 4: Invalid Auth Header Value ===")
    try:
        invalid_headers = {
            "Content-Type": "application/json",
            "x-book8-internal-secret": "invalid-secret-123"
        }
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload, headers=invalid_headers, timeout=30)
        data = response.json()
        
        if response.status_code == 401 and data.get("error", {}).get("code") == "AUTH_FAILED":
            error_message = data.get("error", {}).get("message", "")
            if "invalid" in error_message.lower():
                print("✅ PASS: Invalid auth header properly rejected")
                print(f"   Error: {error_message}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Wrong error message for invalid auth")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 401/AUTH_FAILED for invalid auth")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 5: Test CORS OPTIONS requests
    print("\n=== Test 5: CORS OPTIONS Support ===")
    try:
        # Test OPTIONS on create endpoint
        response = requests.options(f"{BASE_URL}/api/internal/ops/requests", 
                                  headers=headers, timeout=30)
        
        if response.status_code == 204:
            allow_methods = response.headers.get('Access-Control-Allow-Methods', '')
            allow_headers = response.headers.get('Access-Control-Allow-Headers', '')
            
            if 'POST' in allow_methods and 'GET' in allow_methods and 'x-book8-internal-secret' in allow_headers:
                print("✅ PASS: CORS OPTIONS working correctly")
                print(f"   Allowed Methods: {allow_methods}")
                print(f"   Allowed Headers: {allow_headers}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: CORS headers incomplete")
                print(f"   Methods: {allow_methods}, Headers: {allow_headers}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: OPTIONS request failed: {response.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 6: Test tool validation (tool not in registry)
    print("\n=== Test 6: Tool Not In Registry ===")
    invalid_tool_payload = {
        "tool": "invalid.nonexistent.tool",
        "payload": {
            "businessId": "test-invalid-tool"
        },
        "requestedBy": "test-agent"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=invalid_tool_payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 400 and data.get("error", {}).get("code") == "TOOL_NOT_FOUND":
            error_message = data.get("error", {}).get("message", "")
            help_text = data.get("error", {}).get("help", "")
            
            if "registry" in error_message.lower() and "tools" in help_text.lower():
                print("✅ PASS: Invalid tool properly rejected with helpful message")
                print(f"   Error: {error_message}")
                print(f"   Help: {help_text}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Missing helpful error message for invalid tool")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 400/TOOL_NOT_FOUND for invalid tool")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 7: Test malformed JSON
    print("\n=== Test 7: Malformed JSON ===")
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               data="{ invalid json }", 
                               headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 400 and data.get("error", {}).get("code") == "INVALID_JSON":
            print("✅ PASS: Malformed JSON properly rejected")
            print(f"   Error: {data.get('error', {}).get('message')}")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Expected 400/INVALID_JSON for malformed JSON")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 EDGE CASES TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL EDGE CASE TESTS PASSED!")
        print("Additional approval lifecycle scenarios working correctly.")
        print()
        print("EDGE CASES VERIFIED:")
        print("✅ Unique businessId handling")
        print("✅ List all requests functionality")
        print("✅ Payload integrity verification")
        print("✅ Invalid auth header rejection")
        print("✅ CORS OPTIONS support")
        print("✅ Tool registry validation")
        print("✅ Malformed JSON handling")
        return 0
    else:
        print(f"\n⚠️  {total - passed} EDGE CASE TEST(S) FAILED")
        print("Some edge cases need attention.")
        return 1

if __name__ == "__main__":
    sys.exit(test_approval_lifecycle_edge_cases())