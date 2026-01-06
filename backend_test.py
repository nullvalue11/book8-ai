#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Approval Gates Feature Testing
Tests the Approval Gates feature in POST /api/internal/ops/execute

This test correctly interprets the approval gates behavior:
- High-risk tools require approval (403 with approval_required)
- Pre-approved requests bypass approval gates (proceed to next validation stage)
- Tool allowlist validation happens after approval gates
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
            log_test("Medium-Risk Tool Executes Normally", "PASS", "No approval required (risk=medium)")
            return True
        else:
            log_test("Medium-Risk Tool Executes Normally", "FAIL", f"Status: {response.status_code}, ok: {data.get('ok')}")
            return False
            
    except Exception as e:
        log_test("Medium-Risk Tool Executes Normally", "FAIL", f"JSON parse error: {str(e)}")
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
        
        # Should require approval (403 status with approval_required)
        if response.status_code == 403 and data.get("status") == "approval_required":
            log_test("High-Risk Tool Requires Approval", "PASS", "HTTP 403 with status='approval_required'")
            
            # Validate approval response structure
            approval = data.get("approval", {})
            required_fields = ["type", "reason", "tool", "payload", "howToApprove", "approvalPayloadExample"]
            missing_fields = [field for field in required_fields if field not in approval]
            
            if missing_fields:
                log_test("Approval Response Structure", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Validate specific values
            if approval.get("type") != "human":
                log_test("Approval Type", "FAIL", f"Expected 'human', got {approval.get('type')}")
                return False
            
            if "risk=high" not in approval.get("reason", ""):
                log_test("Approval Reason", "FAIL", f"Expected 'risk=high' in reason")
                return False
            
            log_test("Approval Response Structure", "PASS", "All required fields present and valid")
            return True
        else:
            log_test("High-Risk Tool Requires Approval", "FAIL", f"Status: {response.status_code}, status: {data.get('status')}")
            return False
            
    except Exception as e:
        log_test("High-Risk Tool Requires Approval", "FAIL", f"JSON parse error: {str(e)}")
        return False

def test_high_risk_tool_with_pre_approval():
    """Test Case 3: High-Risk Tool with Pre-Approval (Bypasses Approval Gate)"""
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
            "approvalToken": "manual-review-token"
        }
    }
    
    response = make_request(payload, "High-Risk Tool with Pre-Approval")
    if not response:
        return False
    
    try:
        data = response.json()
        
        # Should NOT return approval_required (approval gate bypassed)
        if data.get("status") == "approval_required":
            log_test("Pre-Approval Bypasses Approval Gate", "FAIL", "Still requiring approval despite approved=true")
            return False
        
        # Should proceed to next validation stage (tool allowlist)
        # Expected: 400 TOOL_NOT_ALLOWED (since tenant.delete is not in legacy allowlist)
        if response.status_code == 400 and data.get("error", {}).get("code") == "TOOL_NOT_ALLOWED":
            log_test("Pre-Approval Bypasses Approval Gate", "PASS", "Approval gate bypassed, failed at tool allowlist (expected)")
            return True
        else:
            log_test("Pre-Approval Bypasses Approval Gate", "FAIL", f"Unexpected response: {response.status_code}, error: {data.get('error', {}).get('code')}")
            return False
            
    except Exception as e:
        log_test("Pre-Approval Bypasses Approval Gate", "FAIL", f"JSON parse error: {str(e)}")
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
            log_test("Low-Risk Tool No Approval Needed", "PASS", "No approval required (risk=low)")
            return True
        else:
            log_test("Low-Risk Tool No Approval Needed", "FAIL", f"Unexpected approval requirement")
            return False
            
    except Exception as e:
        log_test("Low-Risk Tool No Approval Needed", "FAIL", f"JSON parse error: {str(e)}")
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
            log_test("Legacy Format with Approval", "PASS", "Legacy format correctly requires approval")
            return True
        else:
            log_test("Legacy Format with Approval", "FAIL", f"Status: {response.status_code}, status: {data.get('status')}")
            return False
            
    except Exception as e:
        log_test("Legacy Format with Approval", "FAIL", f"JSON parse error: {str(e)}")
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
        
        # Should bypass approval gate (same as new format)
        if data.get("status") == "approval_required":
            log_test("Legacy Format with Pre-Approval", "FAIL", "Legacy format still requiring approval")
            return False
        
        # Should proceed to tool allowlist validation
        if response.status_code == 400 and data.get("error", {}).get("code") == "TOOL_NOT_ALLOWED":
            log_test("Legacy Format with Pre-Approval", "PASS", "Legacy format bypasses approval gate")
            return True
        else:
            log_test("Legacy Format with Pre-Approval", "FAIL", f"Unexpected response: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Legacy Format with Pre-Approval", "FAIL", f"JSON parse error: {str(e)}")
        return False

def main():
    """Run all approval gates tests"""
    print("🔒 APPROVAL GATES FEATURE TESTING")
    print("=" * 50)
    print(f"Testing endpoint: {API_ENDPOINT}")
    print(f"Auth header: x-book8-internal-secret: {AUTH_HEADER}")
    print()
    print("TESTING STRATEGY:")
    print("- tenant.delete (risk=high) is in registry but not in legacy allowlist")
    print("- This allows us to test approval gates without full tool execution")
    print("- Expected flow: Approval Gate → Tool Allowlist → Tool Execution")
    print()
    
    # Run all test cases
    test_results = []
    
    test_results.append(test_medium_risk_tool_executes_normally())
    test_results.append(test_high_risk_tool_requires_approval())
    test_results.append(test_high_risk_tool_with_pre_approval())
    test_results.append(test_low_risk_tool_no_approval())
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
        print()
        print("KEY FINDINGS:")
        print("✅ Medium-risk tools execute without approval")
        print("✅ High-risk tools require approval (403 + approval_required)")
        print("✅ Pre-approved requests bypass approval gates")
        print("✅ Both new and legacy formats support approval gates")
        print("✅ Approval response structure is complete and valid")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        print("The Approval Gates feature needs attention.")
        return 1

if __name__ == "__main__":
    sys.exit(main())