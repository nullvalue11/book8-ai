#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Approval Gates Feature Testing
Tests the Approval Gates feature in POST /api/internal/ops/execute

This test focuses specifically on the approval gates functionality,
acknowledging that tenant.delete is in the registry but not in the legacy allowlist.
"""

import requests
import json
import sys
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://ops-api-internal.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "ops-dev-secret-change-me"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def make_request(payload, test_name):
    """Make API request with proper headers"""
    headers = {
        "Content-Type": "application/json",
        "x-book8-internal-secret": AUTH_HEADER
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, headers=headers, timeout=30)
        log_test(f"{test_name} - Request", "PASS", f"Status: {response.status_code}")
        return response
    except Exception as e:
        log_test(f"{test_name} - Request", "FAIL", f"Error: {str(e)}")
        return None

def test_medium_risk_tool_executes_normally():
    """Test Case 1: Medium-Risk Tool Executes Normally"""
    print("\n=== Test Case 1: Medium-Risk Tool Executes Normally ===")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        },
        "meta": {
            "requestId": f"approval-test-medium-{int(datetime.now().timestamp())}"
        }
    }
    
    response = make_request(payload, "Medium-Risk Tool")
    if not response:
        return False
    
    try:
        data = response.json()
        
        # Should execute normally without approval
        if response.status_code == 200 and data.get("ok") == True:
            log_test("Medium-Risk Execution", "PASS", "Tool executed without approval requirement")
            return True
        else:
            log_test("Medium-Risk Execution", "FAIL", f"Unexpected response: {data}")
            return False
            
    except Exception as e:
        log_test("Medium-Risk Execution", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_high_risk_tool_requires_approval():
    """Test Case 2: High-Risk Tool Requires Approval"""
    print("\n=== Test Case 2: High-Risk Tool Requires Approval ===")
    
    payload = {
        "tool": "tenant.delete",
        "payload": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        },
        "meta": {
            "requestId": f"approval-test-high-{int(datetime.now().timestamp())}"
        }
    }
    
    response = make_request(payload, "High-Risk Tool")
    if not response:
        return False
    
    try:
        data = response.json()
        print(f"    Response: {json.dumps(data, indent=2)}")
        
        # Should require approval (403 status)
        if response.status_code == 403:
            log_test("High-Risk Status Code", "PASS", "Returned 403 as expected")
        else:
            log_test("High-Risk Status Code", "FAIL", f"Expected 403, got {response.status_code}")
            return False
        
        # Check response structure
        expected_fields = ["ok", "status", "requestId", "tool", "approval"]
        missing_fields = [field for field in expected_fields if field not in data]
        
        if missing_fields:
            log_test("High-Risk Response Structure", "FAIL", f"Missing fields: {missing_fields}")
            return False
        
        # Validate specific fields
        if data.get("ok") != False:
            log_test("High-Risk ok Field", "FAIL", f"Expected ok=false, got {data.get('ok')}")
            return False
        
        if data.get("status") != "approval_required":
            log_test("High-Risk status Field", "FAIL", f"Expected status='approval_required', got {data.get('status')}")
            return False
        
        approval = data.get("approval", {})
        if approval.get("type") != "human":
            log_test("High-Risk approval.type", "FAIL", f"Expected type='human', got {approval.get('type')}")
            return False
        
        if "risk=high" not in approval.get("reason", ""):
            log_test("High-Risk approval.reason", "FAIL", f"Expected 'risk=high' in reason, got {approval.get('reason')}")
            return False
        
        if approval.get("tool") != "tenant.delete":
            log_test("High-Risk approval.tool", "FAIL", f"Expected tool='tenant.delete', got {approval.get('tool')}")
            return False
        
        # Check payload is included
        if "payload" not in approval:
            log_test("High-Risk approval.payload", "FAIL", "Missing payload in approval")
            return False
        
        # Check instructions are provided
        if "howToApprove" not in approval:
            log_test("High-Risk approval.howToApprove", "FAIL", "Missing howToApprove instructions")
            return False
        
        if "approvalPayloadExample" not in approval:
            log_test("High-Risk approval.approvalPayloadExample", "FAIL", "Missing approvalPayloadExample")
            return False
        
        log_test("High-Risk Tool Approval Required", "PASS", "All approval fields validated successfully")
        return True
        
    except Exception as e:
        log_test("High-Risk Tool Approval Required", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_high_risk_tool_with_pre_approval():
    """Test Case 3: High-Risk Tool with Pre-Approval (Tests Approval Gate Bypass)"""
    print("\n=== Test Case 3: High-Risk Tool with Pre-Approval ===")
    
    payload = {
        "tool": "tenant.delete",
        "payload": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        },
        "meta": {
            "requestId": f"approval-test-approved-{int(datetime.now().timestamp())}",
            "approved": True,
            "approvalToken": "manual-review-2024-01-06"
        }
    }
    
    response = make_request(payload, "High-Risk Tool with Pre-Approval")
    if not response:
        return False
    
    try:
        data = response.json()
        print(f"    Response: {json.dumps(data, indent=2)}")
        
        # Should NOT return approval_required status (approval gate should be bypassed)
        if data.get("status") == "approval_required":
            log_test("Pre-Approval Bypass", "FAIL", "Still requiring approval despite approved=true")
            return False
        
        # Should proceed past approval gate
        # Note: It may fail later due to tool not being in allowlist, but that's expected
        # The key test is that it doesn't return status: "approval_required"
        if response.status_code == 403 and data.get("status") == "approval_required":
            log_test("Pre-Approval Bypass", "FAIL", "Approval gate not bypassed")
            return False
        else:
            log_test("Pre-Approval Bypass", "PASS", "Approval gate bypassed successfully")
            # Additional validation: check if it fails at a later stage (tool allowlist)
            if response.status_code == 400 and "TOOL_NOT_ALLOWED" in str(data.get("error", {})):
                log_test("Pre-Approval Flow", "PASS", "Failed at tool allowlist stage (expected)")
            return True
            
    except Exception as e:
        log_test("Pre-Approval Bypass", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_low_risk_tool_no_approval():
    """Test Case 4: Low-Risk Tool No Approval Needed"""
    print("\n=== Test Case 4: Low-Risk Tool No Approval Needed ===")
    
    payload = {
        "tool": "tenant.ensure",
        "payload": {
            "businessId": "test-biz"
        },
        "meta": {
            "requestId": f"approval-test-low-{int(datetime.now().timestamp())}"
        }
    }
    
    response = make_request(payload, "Low-Risk Tool")
    if not response:
        return False
    
    try:
        data = response.json()
        
        # Should execute normally without approval
        if response.status_code != 403 and data.get("status") != "approval_required":
            log_test("Low-Risk Tool Execution", "PASS", "No approval required for low-risk tool")
            return True
        else:
            log_test("Low-Risk Tool Execution", "FAIL", f"Unexpected approval requirement: {data}")
            return False
            
    except Exception as e:
        log_test("Low-Risk Tool Execution", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_approval_response_structure():
    """Test Case 5: Approval Response Structure Validation"""
    print("\n=== Test Case 5: Approval Response Structure Validation ===")
    
    payload = {
        "tool": "tenant.delete",
        "payload": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        },
        "meta": {
            "requestId": f"approval-test-structure-{int(datetime.now().timestamp())}"
        }
    }
    
    response = make_request(payload, "Approval Response Structure")
    if not response:
        return False
    
    try:
        data = response.json()
        
        if response.status_code != 403:
            log_test("Approval Response Structure", "FAIL", f"Expected 403, got {response.status_code}")
            return False
        
        # Detailed structure validation
        approval = data.get("approval", {})
        
        required_approval_fields = [
            "type", "reason", "risk", "howToApprove", "approvalPayloadExample"
        ]
        
        missing_fields = [field for field in required_approval_fields if field not in approval]
        if missing_fields:
            log_test("Approval Structure", "FAIL", f"Missing approval fields: {missing_fields}")
            return False
        
        # Validate approvalPayloadExample structure
        example = approval.get("approvalPayloadExample", {})
        if "meta" not in example or "approved" not in example.get("meta", {}):
            log_test("Approval Example Structure", "FAIL", "approvalPayloadExample missing meta.approved")
            return False
        
        if example.get("meta", {}).get("approved") != True:
            log_test("Approval Example Structure", "FAIL", "approvalPayloadExample meta.approved should be true")
            return False
        
        log_test("Approval Response Structure", "PASS", "All required fields present and valid")
        return True
        
    except Exception as e:
        log_test("Approval Response Structure", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_legacy_format_with_approval():
    """Test Case 6: Legacy Format with Approval"""
    print("\n=== Test Case 6: Legacy Format with Approval ===")
    
    payload = {
        "requestId": f"approval-test-legacy-{int(datetime.now().timestamp())}",
        "tool": "tenant.delete",
        "args": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        }
    }
    
    response = make_request(payload, "Legacy Format with Approval")
    if not response:
        return False
    
    try:
        data = response.json()
        
        # Should still require approval with legacy format
        if response.status_code == 403 and data.get("status") == "approval_required":
            log_test("Legacy Format Approval", "PASS", "Legacy format correctly requires approval")
            return True
        else:
            log_test("Legacy Format Approval", "FAIL", f"Unexpected response: {data}")
            return False
            
    except Exception as e:
        log_test("Legacy Format Approval", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_legacy_format_with_pre_approval():
    """Test Case 7: Legacy Format with Pre-Approval"""
    print("\n=== Test Case 7: Legacy Format with Pre-Approval ===")
    
    payload = {
        "requestId": f"approval-test-legacy-approved-{int(datetime.now().timestamp())}",
        "tool": "tenant.delete",
        "approved": True,
        "args": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        }
    }
    
    response = make_request(payload, "Legacy Format with Pre-Approval")
    if not response:
        return False
    
    try:
        data = response.json()
        
        # Should bypass approval gate
        if data.get("status") != "approval_required":
            log_test("Legacy Pre-Approval Bypass", "PASS", "Legacy format with approved=true bypasses approval")
            return True
        else:
            log_test("Legacy Pre-Approval Bypass", "FAIL", "Legacy format still requiring approval")
            return False
            
    except Exception as e:
        log_test("Legacy Pre-Approval Bypass", "FAIL", f"JSON parse error: {str(e)}")
        return False

def main():
    """Run all approval gates tests"""
    print("🔒 APPROVAL GATES FEATURE TESTING")
    print("=" * 50)
    print(f"Testing endpoint: {API_ENDPOINT}")
    print(f"Auth header: x-book8-internal-secret: {AUTH_HEADER}")
    print()
    print("NOTE: tenant.delete is in registry but not in legacy allowlist.")
    print("This is expected - we're testing the approval gates specifically.")
    print()
    
    # Run all test cases
    test_results = []
    
    test_results.append(test_medium_risk_tool_executes_normally())
    test_results.append(test_high_risk_tool_requires_approval())
    test_results.append(test_high_risk_tool_with_pre_approval())
    test_results.append(test_low_risk_tool_no_approval())
    test_results.append(test_approval_response_structure())
    test_results.append(test_legacy_format_with_approval())
    test_results.append(test_legacy_format_with_pre_approval())
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL APPROVAL GATES TESTS PASSED!")
        print("The Approval Gates feature is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        print("The Approval Gates feature needs attention.")
        return 1

if __name__ == "__main__":
    sys.exit(main())