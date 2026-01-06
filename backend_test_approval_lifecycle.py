#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Approval Lifecycle Workflow Testing
Tests the complete create-approve-execute workflow for high-risk tool executions
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BASE_URL = "https://ops-command-9.preview.emergentagent.com"
AUTH_HEADER = "ops-dev-secret-change-me"

def test_approval_lifecycle():
    """Test the complete approval lifecycle workflow"""
    
    headers = {
        "Content-Type": "application/json",
        "x-book8-internal-secret": AUTH_HEADER
    }
    
    print("🔄 APPROVAL LIFECYCLE WORKFLOW TESTING")
    print("=" * 60)
    print(f"Testing base URL: {BASE_URL}")
    print()
    
    test_results = []
    request_id = None
    
    # Test 1: Create Approval Request
    print("=== Test 1: Create Approval Request ===")
    create_payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-approval-biz-123"
        },
        "requestedBy": "test-agent"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 201 and data.get("ok") == True:
            request_id = data.get("requestId")
            status = data.get("status")
            payload_hash = data.get("payloadHash")
            expires_at = data.get("expiresAt")
            
            if request_id and status == "pending" and payload_hash and expires_at:
                print("✅ PASS: Approval request created successfully")
                print(f"   Request ID: {request_id}")
                print(f"   Status: {status}")
                print(f"   Payload Hash: {payload_hash}")
                print(f"   Expires At: {expires_at}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Missing required fields in response")
                print(f"   Response: {json.dumps(data, indent=2)}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 201/ok=true, got {response.status_code}/ok={data.get('ok')}")
            print(f"   Response: {json.dumps(data, indent=2)}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    if not request_id:
        print("\n❌ CRITICAL: Cannot continue without request ID")
        return 1
    
    # Test 2: List Pending Requests
    print("\n=== Test 2: List Pending Requests ===")
    try:
        response = requests.get(f"{BASE_URL}/api/internal/ops/requests?status=pending", 
                               headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 200 and data.get("ok") == True:
            requests_list = data.get("requests", [])
            found_request = any(req.get("requestId") == request_id for req in requests_list)
            
            if found_request:
                print("✅ PASS: Created request found in pending requests list")
                print(f"   Found {len(requests_list)} pending request(s)")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Created request not found in pending list")
                print(f"   Pending requests: {[req.get('requestId') for req in requests_list]}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 200/ok=true, got {response.status_code}/ok={data.get('ok')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 3: Approve Request
    print("\n=== Test 3: Approve Request ===")
    approve_payload = {
        "approvedBy": "test-admin"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{request_id}/approve", 
                               json=approve_payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 200 and data.get("ok") == True:
            status = data.get("status")
            approved_by = data.get("approvedBy")
            approved_at = data.get("approvedAt")
            next_step = data.get("nextStep")
            
            if status == "approved" and approved_by == "test-admin" and approved_at and next_step:
                print("✅ PASS: Request approved successfully")
                print(f"   Status: {status}")
                print(f"   Approved By: {approved_by}")
                print(f"   Approved At: {approved_at}")
                print(f"   Next Step: {next_step}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Missing required fields in approval response")
                print(f"   Response: {json.dumps(data, indent=2)}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 200/ok=true, got {response.status_code}/ok={data.get('ok')}")
            print(f"   Response: {json.dumps(data, indent=2)}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 4: Execute Approved Request
    print("\n=== Test 4: Execute Approved Request ===")
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{request_id}/execute", 
                               headers=headers, timeout=60)  # Longer timeout for execution
        data = response.json()
        
        if response.status_code == 200 and data.get("ok") == True:
            status = data.get("status")
            result = data.get("result")
            executed_at = data.get("executedAt")
            execution_duration = data.get("executionDurationMs")
            approval_details = data.get("approvalDetails")
            
            if status == "executed" and result and executed_at and execution_duration is not None:
                print("✅ PASS: Request executed successfully")
                print(f"   Status: {status}")
                print(f"   Executed At: {executed_at}")
                print(f"   Execution Duration: {execution_duration}ms")
                if approval_details:
                    print(f"   Approved By: {approval_details.get('approvedBy')}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Missing required fields in execution response")
                print(f"   Response: {json.dumps(data, indent=2)}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 200/ok=true, got {response.status_code}/ok={data.get('ok')}")
            print(f"   Response: {json.dumps(data, indent=2)}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 5: Cannot Execute Pending Request (Create new request)
    print("\n=== Test 5: Cannot Execute Pending Request ===")
    create_payload_2 = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-approval-biz-456"
        },
        "requestedBy": "test-agent"
    }
    
    try:
        # Create new request
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload_2, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 201 and data.get("ok") == True:
            new_request_id = data.get("requestId")
            
            # Try to execute without approving
            response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{new_request_id}/execute", 
                                   headers=headers, timeout=30)
            data = response.json()
            
            if response.status_code == 400 and data.get("error", {}).get("code") == "INVALID_TRANSITION":
                hint = data.get("error", {}).get("hint", "")
                if "approval" in hint.lower():
                    print("✅ PASS: Cannot execute pending request, proper error with hint")
                    print(f"   Error: {data.get('error', {}).get('message')}")
                    print(f"   Hint: {hint}")
                    test_results.append(True)
                else:
                    print(f"❌ FAIL: Missing approval hint in error")
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    test_results.append(False)
            else:
                print(f"❌ FAIL: Expected 400/INVALID_TRANSITION, got {response.status_code}/{data.get('error', {}).get('code')}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Could not create second request for test")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 6: Cannot Re-Execute
    print("\n=== Test 6: Cannot Re-Execute ===")
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{request_id}/execute", 
                               headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 400 and data.get("error", {}).get("code") == "INVALID_TRANSITION":
            current_status = data.get("error", {}).get("currentStatus")
            if current_status == "executed":
                print("✅ PASS: Cannot re-execute already executed request")
                print(f"   Error: {data.get('error', {}).get('message')}")
                print(f"   Current Status: {current_status}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Wrong current status: {current_status}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 400/INVALID_TRANSITION, got {response.status_code}/{data.get('error', {}).get('code')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 7: Request Not Found
    print("\n=== Test 7: Request Not Found ===")
    fake_uuid = "non-existent-uuid-12345"
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests/{fake_uuid}/approve", 
                               json={"approvedBy": "test-admin"}, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 404 and data.get("error", {}).get("code") == "NOT_FOUND":
            print("✅ PASS: Non-existent request returns 404 NOT_FOUND")
            print(f"   Error: {data.get('error', {}).get('message')}")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Expected 404/NOT_FOUND, got {response.status_code}/{data.get('error', {}).get('code')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 8: Auth Required
    print("\n=== Test 8: Auth Required ===")
    try:
        headers_no_auth = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=create_payload, headers=headers_no_auth, timeout=30)
        data = response.json()
        
        if response.status_code == 401 and data.get("error", {}).get("code") == "AUTH_FAILED":
            print("✅ PASS: Request without auth header returns 401 AUTH_FAILED")
            print(f"   Error: {data.get('error', {}).get('message')}")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Expected 401/AUTH_FAILED, got {response.status_code}/{data.get('error', {}).get('code')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 9: Validation Errors
    print("\n=== Test 9: Validation Errors ===")
    invalid_payload = {
        # Missing required fields: tool, payload, requestedBy
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/internal/ops/requests", 
                               json=invalid_payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 400 and data.get("error", {}).get("code") == "VALIDATION_ERROR":
            error_message = data.get("error", {}).get("message", "")
            if "tool" in error_message.lower():
                print("✅ PASS: Missing required fields returns 400 VALIDATION_ERROR")
                print(f"   Error: {error_message}")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Wrong validation error message: {error_message}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 400/VALIDATION_ERROR, got {response.status_code}/{data.get('error', {}).get('code')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 APPROVAL LIFECYCLE TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL APPROVAL LIFECYCLE TESTS PASSED!")
        print("The complete Approval Lifecycle workflow is working correctly.")
        print()
        print("WORKFLOW VERIFIED:")
        print("✅ 1. Create approval request → 201 with requestId, status: 'pending'")
        print("✅ 2. List pending requests → 200 with requests array")
        print("✅ 3. Approve request → 200 with status: 'approved', nextStep guidance")
        print("✅ 4. Execute approved request → 200 with status: 'executed', result")
        print("✅ 5. Cannot execute pending request → 400 INVALID_TRANSITION with hint")
        print("✅ 6. Cannot re-execute → 400 INVALID_TRANSITION (already executed)")
        print("✅ 7. Request not found → 404 NOT_FOUND")
        print("✅ 8. Auth required → 401 AUTH_FAILED")
        print("✅ 9. Validation errors → 400 VALIDATION_ERROR")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        print("The Approval Lifecycle workflow needs attention.")
        return 1

if __name__ == "__main__":
    sys.exit(test_approval_lifecycle())