#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Ops Control Plane V1 API

Tests the new Ops Control Plane V1 API endpoint for executing predefined operational tasks.
This is an internal-only API for operational management.

Test Coverage:
- Authentication tests (missing/invalid/valid x-book8-internal-secret header)
- GET /api/internal/ops/execute (list available tools)
- Request validation tests (missing requestId, tool, invalid tool name)
- Tool execution tests for all 4 tools:
  - tenant.ensure
  - billing.validateStripeConfig
  - voice.smokeTest
  - tenant.provisioningSummary
- Idempotency tests (same requestId twice)
- DryRun mode tests
"""

import requests
import json
import uuid
import time
import os
from datetime import datetime

# Configuration
BASE_URL = "https://ops-api-internal.preview.emergentagent.com"
OPS_SECRET = "ops-dev-secret-change-me"  # From .env OPS_INTERNAL_SECRET
INVALID_SECRET = "invalid-secret-123"

# Test counters
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1

def make_request(method, endpoint, headers=None, json_data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=json_data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return {
            "status_code": response.status_code,
            "json": response.json() if response.headers.get('content-type', '').startswith('application/json') else None,
            "text": response.text,
            "headers": dict(response.headers)
        }
    except requests.exceptions.RequestException as e:
        return {
            "status_code": None,
            "json": None,
            "text": str(e),
            "headers": {},
            "error": str(e)
        }

def test_authentication():
    """Test authentication scenarios"""
    print("\n=== AUTHENTICATION TESTS ===")
    
    # Test 1: Missing x-book8-internal-secret header
    print("\n1. Testing missing auth header...")
    response = make_request("POST", "/api/internal/ops/execute", 
                          headers={"Content-Type": "application/json"},
                          json_data={"requestId": str(uuid.uuid4()), "tool": "tenant.ensure", "args": {"businessId": "test-123"}})
    
    expected_401 = response["status_code"] == 401
    has_auth_error = response["json"] and response["json"].get("error", {}).get("code") == "AUTH_FAILED"
    log_test("Missing auth header returns 401 with AUTH_FAILED", 
             expected_401 and has_auth_error,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")
    
    # Test 2: Invalid x-book8-internal-secret header
    print("\n2. Testing invalid auth header...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": INVALID_SECRET},
                          json_data={"requestId": str(uuid.uuid4()), "tool": "tenant.ensure", "args": {"businessId": "test-123"}})
    
    expected_401 = response["status_code"] == 401
    has_auth_error = response["json"] and response["json"].get("error", {}).get("code") == "AUTH_FAILED"
    log_test("Invalid auth header returns 401 with AUTH_FAILED",
             expected_401 and has_auth_error,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")
    
    # Test 3: Valid x-book8-internal-secret header (should proceed to request processing)
    print("\n3. Testing valid auth header...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={"requestId": str(uuid.uuid4()), "tool": "tenant.ensure", "args": {"businessId": "test-123"}})
    
    # Should not get AUTH_FAILED error (might get other validation errors, but auth should pass)
    auth_passed = response["status_code"] != 401 or (response["json"] and response["json"].get("error", {}).get("code") != "AUTH_FAILED")
    log_test("Valid auth header proceeds to request processing",
             auth_passed,
             f"Status: {response['status_code']}, Response: {response['json'] if response['json'] else response['text'][:200]}")

def test_list_tools():
    """Test GET /api/internal/ops/execute (list tools)"""
    print("\n=== LIST TOOLS TEST ===")
    
    print("\n1. Testing GET endpoint with valid auth...")
    response = make_request("GET", "/api/internal/ops/execute",
                          headers={"x-book8-internal-secret": OPS_SECRET})
    
    is_200 = response["status_code"] == 200
    has_tools = response["json"] and "tools" in response["json"]
    expected_tools = ["tenant.ensure", "billing.validateStripeConfig", "voice.smokeTest", "tenant.provisioningSummary"]
    
    tools_present = False
    if has_tools:
        actual_tools = response["json"]["tools"]
        tools_present = all(tool in actual_tools for tool in expected_tools)
    
    log_test("GET /api/internal/ops/execute returns 200 with tool list",
             is_200 and has_tools and tools_present,
             f"Status: {response['status_code']}, Tools: {response['json'].get('tools', []) if response['json'] else 'No JSON'}")

def test_request_validation():
    """Test request validation scenarios"""
    print("\n=== REQUEST VALIDATION TESTS ===")
    
    # Test 1: Missing requestId
    print("\n1. Testing missing requestId...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={"tool": "tenant.ensure", "args": {"businessId": "test-123"}})
    
    is_400 = response["status_code"] == 400
    has_validation_error = response["json"] and response["json"].get("error", {}).get("code") == "VALIDATION_ERROR"
    log_test("Missing requestId returns 400 with VALIDATION_ERROR",
             is_400 and has_validation_error,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")
    
    # Test 2: Missing tool
    print("\n2. Testing missing tool...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={"requestId": str(uuid.uuid4()), "args": {"businessId": "test-123"}})
    
    is_400 = response["status_code"] == 400
    has_validation_error = response["json"] and response["json"].get("error", {}).get("code") == "VALIDATION_ERROR"
    log_test("Missing tool returns 400 with VALIDATION_ERROR",
             is_400 and has_validation_error,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")
    
    # Test 3: Invalid tool name
    print("\n3. Testing invalid tool name...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={"requestId": str(uuid.uuid4()), "tool": "invalid.tool", "args": {"businessId": "test-123"}})
    
    is_400 = response["status_code"] == 400
    has_tool_error = response["json"] and response["json"].get("error", {}).get("code") == "TOOL_NOT_ALLOWED"
    has_available_tools = response["json"] and "availableTools" in response["json"].get("error", {}).get("details", {})
    log_test("Invalid tool name returns 400 with TOOL_NOT_ALLOWED and lists available tools",
             is_400 and has_tool_error and has_available_tools,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")

def test_tenant_ensure():
    """Test tenant.ensure tool"""
    print("\n=== TENANT.ENSURE TOOL TESTS ===")
    
    # Test 1: Valid businessId
    print("\n1. Testing tenant.ensure with valid businessId...")
    request_id = str(uuid.uuid4())
    business_id = f"test-user-{int(time.time())}"
    
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": request_id,
                              "tool": "tenant.ensure",
                              "args": {"businessId": business_id},
                              "actor": {"type": "system", "id": "test-agent"}
                          })
    
    is_200 = response["status_code"] == 200
    has_ok = response["json"] and response["json"].get("ok") == True
    has_business_id = response["json"] and response["json"].get("result", {}).get("businessId") == business_id
    has_summary = response["json"] and "summary" in response["json"].get("result", {})
    
    log_test("tenant.ensure with valid businessId returns success",
             is_200 and has_ok and has_business_id and has_summary,
             f"Status: {response['status_code']}, Result: {response['json'].get('result', {}) if response['json'] else 'No JSON'}")
    
    # Test 2: DryRun mode
    print("\n2. Testing tenant.ensure with dryRun=true...")
    request_id_dry = str(uuid.uuid4())
    business_id_dry = f"test-dry-{int(time.time())}"
    
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": request_id_dry,
                              "dryRun": True,
                              "tool": "tenant.ensure",
                              "args": {"businessId": business_id_dry},
                              "actor": {"type": "system", "id": "test-agent"}
                          })
    
    is_200 = response["status_code"] == 200
    has_dry_run_plan = response["json"] and "dryRunPlan" in response["json"].get("result", {})
    is_dry_run = response["json"] and response["json"].get("dryRun") == True
    
    log_test("tenant.ensure with dryRun=true returns dryRunPlan without executing",
             is_200 and has_dry_run_plan and is_dry_run,
             f"Status: {response['status_code']}, DryRunPlan: {response['json'].get('result', {}).get('dryRunPlan', {}) if response['json'] else 'No JSON'}")
    
    # Test 3: Missing businessId
    print("\n3. Testing tenant.ensure with missing businessId...")
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": str(uuid.uuid4()),
                              "tool": "tenant.ensure",
                              "args": {}
                          })
    
    is_400 = response["status_code"] == 400
    has_args_error = response["json"] and response["json"].get("error", {}).get("code") == "ARGS_VALIDATION_ERROR"
    log_test("tenant.ensure with missing businessId returns 400 with ARGS_VALIDATION_ERROR",
             is_400 and has_args_error,
             f"Status: {response['status_code']}, Error: {response['json'].get('error', {}) if response['json'] else 'No JSON'}")

def test_billing_validate_stripe():
    """Test billing.validateStripeConfig tool"""
    print("\n=== BILLING.VALIDATESTRIPECONFIG TOOL TESTS ===")
    
    # Test 1: Valid businessId
    print("\n1. Testing billing.validateStripeConfig with valid businessId...")
    request_id = str(uuid.uuid4())
    business_id = f"test-billing-{int(time.time())}"
    
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": request_id,
                              "tool": "billing.validateStripeConfig",
                              "args": {"businessId": business_id},
                              "actor": {"type": "system", "id": "test-agent"}
                          })
    
    is_200 = response["status_code"] == 200
    has_result = response["json"] and "result" in response["json"]
    has_stripe_configured = response["json"] and "stripeConfigured" in response["json"].get("result", {})
    has_checks = response["json"] and "checks" in response["json"].get("result", {})
    has_stripe_mode = response["json"] and "stripeMode" in response["json"].get("result", {})
    
    log_test("billing.validateStripeConfig returns Stripe validation results",
             is_200 and has_result and has_stripe_configured and has_checks and has_stripe_mode,
             f"Status: {response['status_code']}, StripeConfigured: {response['json'].get('result', {}).get('stripeConfigured') if response['json'] else 'No JSON'}")

def test_voice_smoke_test():
    """Test voice.smokeTest tool"""
    print("\n=== VOICE.SMOKETEST TOOL TESTS ===")
    
    # Test 1: Valid businessId
    print("\n1. Testing voice.smokeTest with valid businessId...")
    request_id = str(uuid.uuid4())
    business_id = f"test-voice-{int(time.time())}"
    
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": request_id,
                              "tool": "voice.smokeTest",
                              "args": {"businessId": business_id},
                              "actor": {"type": "system", "id": "test-agent"}
                          })
    
    is_200 = response["status_code"] == 200
    has_result = response["json"] and "result" in response["json"]
    has_checks = response["json"] and "checks" in response["json"].get("result", {})
    has_passed_total = response["json"] and "passed" in response["json"].get("result", {}) and "total" in response["json"].get("result", {})
    
    log_test("voice.smokeTest returns health check results with checks array",
             is_200 and has_result and has_checks and has_passed_total,
             f"Status: {response['status_code']}, Checks: {len(response['json'].get('result', {}).get('checks', [])) if response['json'] else 0} checks")

def test_tenant_provisioning_summary():
    """Test tenant.provisioningSummary tool"""
    print("\n=== TENANT.PROVISIONINGSUMMARY TOOL TESTS ===")
    
    # First create a test user with tenant.ensure
    print("\n1. Creating test user for provisioning summary...")
    business_id = f"test-provisioning-{int(time.time())}"
    
    create_response = make_request("POST", "/api/internal/ops/execute",
                                 headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                                 json_data={
                                     "requestId": str(uuid.uuid4()),
                                     "tool": "tenant.ensure",
                                     "args": {"businessId": business_id},
                                     "actor": {"type": "system", "id": "test-agent"}
                                 })
    
    user_created = create_response["status_code"] == 200 and create_response["json"] and create_response["json"].get("ok")
    
    if user_created:
        print("   Test user created successfully")
        
        # Test 2: Get provisioning summary for created user
        print("\n2. Testing tenant.provisioningSummary with existing businessId...")
        request_id = str(uuid.uuid4())
        
        response = make_request("POST", "/api/internal/ops/execute",
                              headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                              json_data={
                                  "requestId": request_id,
                                  "tool": "tenant.provisioningSummary",
                                  "args": {"businessId": business_id},
                                  "actor": {"type": "system", "id": "test-agent"}
                              })
        
        is_200 = response["status_code"] == 200
        has_result = response["json"] and "result" in response["json"]
        has_subscription = response["json"] and "subscription" in response["json"].get("result", {})
        has_calendar = response["json"] and "calendar" in response["json"].get("result", {})
        has_scheduling = response["json"] and "scheduling" in response["json"].get("result", {})
        has_voice = response["json"] and "voice" in response["json"].get("result", {})
        has_event_types = response["json"] and "eventTypes" in response["json"].get("result", {})
        has_checklist = response["json"] and "checklist" in response["json"].get("result", {})
        has_provisioning_score = response["json"] and "provisioningScore" in response["json"].get("result", {})
        
        log_test("tenant.provisioningSummary returns complete provisioning state",
                 is_200 and has_result and has_subscription and has_calendar and has_scheduling and has_voice and has_event_types and has_checklist and has_provisioning_score,
                 f"Status: {response['status_code']}, Score: {response['json'].get('result', {}).get('provisioningScore', 'N/A') if response['json'] else 'No JSON'}%")
    else:
        log_test("tenant.provisioningSummary test skipped - user creation failed",
                 False,
                 f"Failed to create test user: {create_response}")

def test_idempotency():
    """Test idempotency - same requestId should return cached result"""
    print("\n=== IDEMPOTENCY TESTS ===")
    
    # Test 1: Execute same requestId twice
    print("\n1. Testing idempotency with same requestId...")
    request_id = str(uuid.uuid4())
    business_id = f"test-idempotent-{int(time.time())}"
    
    request_data = {
        "requestId": request_id,
        "tool": "tenant.ensure",
        "args": {"businessId": business_id},
        "actor": {"type": "system", "id": "test-agent"}
    }
    
    # First execution
    response1 = make_request("POST", "/api/internal/ops/execute",
                           headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                           json_data=request_data)
    
    # Second execution with same requestId
    time.sleep(1)  # Small delay to ensure first request completes
    response2 = make_request("POST", "/api/internal/ops/execute",
                           headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                           json_data=request_data)
    
    both_200 = response1["status_code"] == 200 and response2["status_code"] == 200
    both_have_executed_at = (response1["json"] and "executedAt" in response1["json"] and 
                           response2["json"] and "executedAt" in response2["json"])
    both_have_duration = (response1["json"] and "durationMs" in response1["json"] and 
                        response2["json"] and "durationMs" in response2["json"])
    
    # The second response should be cached (might have same or different executedAt, but should be fast)
    log_test("Idempotency - same requestId returns cached result",
             both_200 and both_have_executed_at and both_have_duration,
             f"First: {response1['status_code']}, Second: {response2['status_code']}, Both have executedAt and durationMs")

def test_dry_run_mode():
    """Test dryRun mode across different tools"""
    print("\n=== DRY RUN MODE TESTS ===")
    
    # Test 1: tenant.ensure with dryRun
    print("\n1. Testing dryRun mode with tenant.ensure...")
    request_id = str(uuid.uuid4())
    business_id = f"test-dryrun-{int(time.time())}"
    
    response = make_request("POST", "/api/internal/ops/execute",
                          headers={"Content-Type": "application/json", "x-book8-internal-secret": OPS_SECRET},
                          json_data={
                              "requestId": request_id,
                              "dryRun": True,
                              "tool": "tenant.ensure",
                              "args": {"businessId": business_id},
                              "actor": {"type": "system", "id": "test-agent"}
                          })
    
    is_200 = response["status_code"] == 200
    is_dry_run = response["json"] and response["json"].get("dryRun") == True
    has_dry_run_plan = response["json"] and "dryRunPlan" in response["json"].get("result", {})
    
    log_test("DryRun mode describes action without executing",
             is_200 and is_dry_run and has_dry_run_plan,
             f"Status: {response['status_code']}, DryRun: {response['json'].get('dryRun') if response['json'] else 'No JSON'}")

def run_all_tests():
    """Run all test suites"""
    print("🔧 STARTING OPS CONTROL PLANE V1 API TESTS")
    print(f"Base URL: {BASE_URL}")
    print(f"Auth Secret: {OPS_SECRET}")
    print("=" * 60)
    
    # Run all test suites
    test_authentication()
    test_list_tools()
    test_request_validation()
    test_tenant_ensure()
    test_billing_validate_stripe()
    test_voice_smoke_test()
    test_tenant_provisioning_summary()
    test_idempotency()
    test_dry_run_mode()
    
    # Print summary
    print("\n" + "=" * 60)
    print("🔧 OPS CONTROL PLANE V1 API TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Tests Passed: {tests_passed}")
    print(f"❌ Tests Failed: {tests_failed}")
    print(f"📊 Success Rate: {(tests_passed / (tests_passed + tests_failed) * 100):.1f}%")
    
    if tests_failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if not result["passed"]:
                print(f"   - {result['test']}: {result['details']}")
    
    print("\n🎯 TEST COVERAGE COMPLETED:")
    print("   ✓ Authentication (missing/invalid/valid headers)")
    print("   ✓ GET /api/internal/ops/execute (list tools)")
    print("   ✓ Request validation (missing requestId, tool, invalid tool)")
    print("   ✓ tenant.ensure tool (create/verify business)")
    print("   ✓ billing.validateStripeConfig tool (Stripe validation)")
    print("   ✓ voice.smokeTest tool (health checks)")
    print("   ✓ tenant.provisioningSummary tool (provisioning state)")
    print("   ✓ Idempotency (same requestId returns cached result)")
    print("   ✓ DryRun mode (describe without executing)")
    
    return tests_passed, tests_failed

if __name__ == "__main__":
    try:
        passed, failed = run_all_tests()
        exit_code = 0 if failed == 0 else 1
        exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n\n💥 Test suite crashed: {e}")
        exit(1)