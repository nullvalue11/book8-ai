#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Approval Gates Feature Testing
Simplified and focused test for the Approval Gates feature
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://ops-command-9.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "ops-dev-secret-change-me"

def test_approval_gates():
    """Test all approval gates scenarios"""
    
    headers = {
        "Content-Type": "application/json",
        "x-book8-internal-secret": AUTH_HEADER
    }
    
    print("🔒 APPROVAL GATES FEATURE TESTING")
    print("=" * 50)
    print(f"Testing endpoint: {API_ENDPOINT}")
    print()
    
    test_results = []
    
    # Test 1: Medium-Risk Tool Executes Normally
    print("=== Test 1: Medium-Risk Tool Executes Normally ===")
    payload1 = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        },
        "meta": {
            "requestId": f"test-medium-{int(datetime.now().timestamp())}"
        }
    }
    
    try:
        response1 = requests.post(API_ENDPOINT, json=payload1, headers=headers, timeout=30)
        data1 = response1.json()
        
        if response1.status_code == 200 and data1.get("ok") == True:
            print("✅ PASS: Medium-risk tool executed without approval")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Expected 200/ok=true, got {response1.status_code}/ok={data1.get('ok')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 2: High-Risk Tool Requires Approval
    print("\n=== Test 2: High-Risk Tool Requires Approval ===")
    payload2 = {
        "tool": "tenant.delete",
        "payload": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        },
        "meta": {
            "requestId": f"test-high-{int(datetime.now().timestamp())}"
        }
    }
    
    try:
        response2 = requests.post(API_ENDPOINT, json=payload2, headers=headers, timeout=30)
        data2 = response2.json()
        
        if response2.status_code == 403 and data2.get("status") == "approval_required":
            print("✅ PASS: High-risk tool requires approval (403 + approval_required)")
            
            # Validate approval structure
            approval = data2.get("approval", {})
            required_fields = ["type", "reason", "tool", "payload", "howToApprove", "approvalPayloadExample"]
            missing_fields = [field for field in required_fields if field not in approval]
            
            if not missing_fields and approval.get("type") == "human" and "risk=high" in approval.get("reason", ""):
                print("✅ PASS: Approval response structure valid")
                test_results.append(True)
            else:
                print(f"❌ FAIL: Invalid approval structure - missing: {missing_fields}")
                test_results.append(False)
        else:
            print(f"❌ FAIL: Expected 403/approval_required, got {response2.status_code}/{data2.get('status')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 3: High-Risk Tool with Pre-Approval
    print("\n=== Test 3: High-Risk Tool with Pre-Approval ===")
    payload3 = {
        "tool": "tenant.delete",
        "payload": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        },
        "meta": {
            "requestId": f"test-approved-{int(datetime.now().timestamp())}",
            "approved": True,
            "approvalToken": "manual-review-token"
        }
    }
    
    try:
        response3 = requests.post(API_ENDPOINT, json=payload3, headers=headers, timeout=30)
        data3 = response3.json()
        
        # Should NOT return approval_required (approval gate bypassed)
        if data3.get("status") == "approval_required":
            print("❌ FAIL: Still requiring approval despite approved=true")
            test_results.append(False)
        elif response3.status_code == 400 and data3.get("error", {}).get("code") == "TOOL_NOT_ALLOWED":
            print("✅ PASS: Approval gate bypassed, failed at tool allowlist (expected)")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Unexpected response - {response3.status_code}/{data3.get('error', {}).get('code')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 4: Low-Risk Tool No Approval Needed
    print("\n=== Test 4: Low-Risk Tool No Approval Needed ===")
    payload4 = {
        "tool": "tenant.ensure",
        "payload": {
            "businessId": "test-biz"
        },
        "meta": {
            "requestId": f"test-low-{int(datetime.now().timestamp())}"
        }
    }
    
    try:
        response4 = requests.post(API_ENDPOINT, json=payload4, headers=headers, timeout=30)
        data4 = response4.json()
        
        if response4.status_code != 403 and data4.get("status") != "approval_required":
            print("✅ PASS: Low-risk tool executed without approval")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Unexpected approval requirement for low-risk tool")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 5: Legacy Format with Approval
    print("\n=== Test 5: Legacy Format with Approval ===")
    payload5 = {
        "requestId": f"test-legacy-{int(datetime.now().timestamp())}",
        "tool": "tenant.delete",
        "args": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        }
    }
    
    try:
        response5 = requests.post(API_ENDPOINT, json=payload5, headers=headers, timeout=30)
        data5 = response5.json()
        
        if response5.status_code == 403 and data5.get("status") == "approval_required":
            print("✅ PASS: Legacy format correctly requires approval")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Legacy format approval failed - {response5.status_code}/{data5.get('status')}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
    # Test 6: Legacy Format with Pre-Approval
    print("\n=== Test 6: Legacy Format with Pre-Approval ===")
    payload6 = {
        "requestId": f"test-legacy-approved-{int(datetime.now().timestamp())}",
        "tool": "tenant.delete",
        "approved": True,
        "args": {
            "businessId": "test-biz",
            "confirmationCode": "DELETE-123"
        }
    }
    
    try:
        response6 = requests.post(API_ENDPOINT, json=payload6, headers=headers, timeout=30)
        data6 = response6.json()
        
        if data6.get("status") == "approval_required":
            print("❌ FAIL: Legacy format still requiring approval")
            test_results.append(False)
        elif response6.status_code == 400 and data6.get("error", {}).get("code") == "TOOL_NOT_ALLOWED":
            print("✅ PASS: Legacy format bypasses approval gate")
            test_results.append(True)
        else:
            print(f"❌ FAIL: Unexpected legacy pre-approval response - {response6.status_code}")
            test_results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception - {str(e)}")
        test_results.append(False)
    
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
    sys.exit(test_approval_gates())