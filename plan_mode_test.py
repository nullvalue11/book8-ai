#!/usr/bin/env python3
"""
Plan Mode Test Suite for POST /api/internal/ops/execute
Tests the new Plan Mode feature as specified in the review request.
"""

import requests
import json
import time
import uuid
from datetime import datetime
import os
import sys

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ops-command-9.preview.emergentagent.com')
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "ops-dev-secret-change-me"  # From .env OPS_INTERNAL_SECRET

# Test configuration
TIMEOUT = 30
HEADERS = {
    'Content-Type': 'application/json',
    'x-book8-internal-secret': AUTH_HEADER
}

class TestResults:
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
        print(f"\n{'='*60}")
        print(f"PLAN MODE TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*60}")
        for test in self.tests:
            status = "✅ PASS" if test['passed'] else "❌ FAIL"
            print(f"{status}: {test['name']}")
            if test['details']:
                print(f"    {test['details']}")

def make_request(method, url, data=None, headers=None, timeout=TIMEOUT):
    """Make HTTP request with error handling"""
    try:
        if method.upper() == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=timeout)
        elif method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=timeout)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return {
            'success': True,
            'status_code': response.status_code,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            'headers': dict(response.headers),
            'response_time': response.elapsed.total_seconds() * 1000
        }
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'Request timeout'}
    except requests.exceptions.ConnectionError:
        return {'success': False, 'error': 'Connection error'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def test_plan_mode_basic():
    """Test Case 1: Plan Mode - Basic"""
    print("\n🧪 Test 1: Plan Mode - Basic")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {"businessId": "test-biz"},
        "meta": {"requestId": "plan-test-1", "mode": "plan"}
    }
    
    print(f"   📤 Sending POST request with mode=plan")
    print(f"   📋 Request ID: plan-test-1")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify basic response structure
    if not data.get('ok'):
        return False, f"Response ok is false: {data.get('error', 'No error details')}"
    
    if data.get('mode') != 'plan':
        return False, f"Expected mode='plan', got {data.get('mode')}"
    
    # Verify result structure
    result = data.get('result', {})
    if not result:
        return False, "Missing result object"
    
    # Check required plan fields
    required_fields = ['plan', 'sideEffects', 'requiredSecrets', 'risk', 'timing', 'readiness']
    for field in required_fields:
        if field not in result:
            return False, f"Missing required field in result: {field}"
    
    # Verify plan.steps array with 4 steps
    plan = result.get('plan', {})
    steps = plan.get('steps', [])
    if len(steps) != 4:
        return False, f"Expected 4 steps, got {len(steps)}"
    
    # Verify each step has required fields
    for i, step in enumerate(steps):
        required_step_fields = ['order', 'name', 'description', 'mutates', 'willExecute']
        for field in required_step_fields:
            if field not in step:
                return False, f"Step {i+1} missing required field: {field}"
    
    # Verify sideEffects array
    side_effects = result.get('sideEffects', [])
    if not isinstance(side_effects, list):
        return False, "sideEffects should be an array"
    
    # Verify requiredSecrets array
    required_secrets = result.get('requiredSecrets', [])
    if not isinstance(required_secrets, list):
        return False, "requiredSecrets should be an array"
    
    # Verify risk object
    risk = result.get('risk', {})
    risk_fields = ['level', 'mutates', 'reversible']
    for field in risk_fields:
        if field not in risk:
            return False, f"Risk object missing field: {field}"
    
    # Verify timing object
    timing = result.get('timing', {})
    if 'estimatedDurationMs' not in timing:
        return False, "Timing object missing estimatedDurationMs"
    
    # Verify readiness object
    readiness = result.get('readiness', {})
    if 'canExecute' not in readiness:
        return False, "Readiness object missing canExecute"
    
    # Verify NO database writes occurred (this is plan mode)
    # We can't directly verify this, but the response should be fast
    if response['response_time'] > 2000:  # 2 seconds
        return False, f"Plan mode response too slow: {response['response_time']}ms (may indicate database writes)"
    
    print(f"   ✅ Plan mode response received in {response['response_time']:.0f}ms")
    print(f"   ✅ Plan contains {len(steps)} steps")
    print(f"   ✅ Risk level: {risk.get('level')}")
    print(f"   ✅ Can execute: {readiness.get('canExecute')}")
    
    return True, f"Plan mode basic test passed, {len(steps)} steps planned"

def test_plan_mode_with_skip_options():
    """Test Case 2: Plan Mode - With Skip Options"""
    print("\n🧪 Test 2: Plan Mode - With Skip Options")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        },
        "meta": {"requestId": "plan-test-2", "mode": "plan"}
    }
    
    print(f"   📤 Sending POST request with skip options")
    print(f"   📋 Request ID: plan-test-2")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    result = data.get('result', {})
    plan = result.get('plan', {})
    
    # Verify stepsToSkip and stepsToExecute
    steps_to_skip = plan.get('stepsToSkip')
    steps_to_execute = plan.get('stepsToExecute')
    
    if steps_to_skip != 2:
        return False, f"Expected stepsToSkip=2, got {steps_to_skip}"
    
    if steps_to_execute != 2:
        return False, f"Expected stepsToExecute=2, got {steps_to_execute}"
    
    # Verify specific steps have willExecute=false and skipReason
    steps = plan.get('steps', [])
    skipped_steps = [step for step in steps if not step.get('willExecute')]
    
    if len(skipped_steps) != 2:
        return False, f"Expected 2 skipped steps, got {len(skipped_steps)}"
    
    # Check that skipped steps have skipReason
    for step in skipped_steps:
        if not step.get('skipReason'):
            return False, f"Skipped step missing skipReason: {step.get('name')}"
    
    print(f"   ✅ Steps to skip: {steps_to_skip}")
    print(f"   ✅ Steps to execute: {steps_to_execute}")
    print(f"   ✅ Skipped steps have reasons: {[s.get('skipReason') for s in skipped_steps]}")
    
    return True, f"Skip options test passed, {steps_to_skip} steps skipped"

def test_execute_mode_explicit():
    """Test Case 3: Execute Mode - Explicit"""
    print("\n🧪 Test 3: Execute Mode - Explicit")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-biz",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        },
        "meta": {"requestId": "exec-test-unique", "mode": "execute"}
    }
    
    print(f"   📤 Sending POST request with mode=execute")
    print(f"   📋 Request ID: exec-test-unique")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify this is NOT plan mode
    if data.get('mode') == 'plan':
        return False, "Response indicates plan mode, expected execute mode"
    
    # Verify result.ready is present (actual execution happened)
    result = data.get('result', {})
    if 'ready' not in result:
        return False, "Missing result.ready field (indicates execution didn't happen)"
    
    # Verify NOT returning plan structure
    if 'plan' in result:
        return False, "Execute mode should not return plan structure"
    
    # Verify execution fields are present
    required_fields = ['ok', 'requestId', 'tool', 'durationMs', 'executedAt']
    for field in required_fields:
        if field not in data:
            return False, f"Missing execution field: {field}"
    
    print(f"   ✅ Execute mode completed")
    print(f"   ✅ Ready status: {result.get('ready')}")
    print(f"   ✅ Execution duration: {data.get('durationMs')}ms")
    
    return True, f"Execute mode explicit test passed, ready={result.get('ready')}"

def test_execute_mode_default():
    """Test Case 4: Execute Mode - Default (no mode specified)"""
    print("\n🧪 Test 4: Execute Mode - Default")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {"businessId": "test-biz"},
        "meta": {"requestId": "exec-test-default"}
        # Note: no mode specified, should default to execute
    }
    
    print(f"   📤 Sending POST request with no mode (should default to execute)")
    print(f"   📋 Request ID: exec-test-default")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify this behaves same as mode="execute"
    if data.get('mode') == 'plan':
        return False, "Default mode should be execute, not plan"
    
    # Verify result.ready is present
    result = data.get('result', {})
    if 'ready' not in result:
        return False, "Missing result.ready field (indicates execution didn't happen)"
    
    print(f"   ✅ Default mode behaves as execute")
    print(f"   ✅ Ready status: {result.get('ready')}")
    
    return True, "Execute mode default test passed"

def test_plan_mode_invalid_tool():
    """Test Case 5: Plan Mode - Invalid Tool"""
    print("\n🧪 Test 5: Plan Mode - Invalid Tool")
    
    payload = {
        "tool": "invalid.tool",
        "payload": {},
        "meta": {"requestId": "plan-invalid", "mode": "plan"}
    }
    
    print(f"   📤 Sending POST request with invalid tool in plan mode")
    print(f"   📋 Request ID: plan-invalid")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    # Should return 400 with TOOL_NOT_ALLOWED error
    if response['status_code'] != 400:
        return False, f"Expected 400, got {response['status_code']}"
    
    data = response['data']
    error = data.get('error', {})
    error_code = error.get('code')
    
    if error_code != 'TOOL_NOT_ALLOWED':
        return False, f"Expected TOOL_NOT_ALLOWED error, got {error_code}"
    
    print(f"   ✅ Invalid tool properly rejected: {error_code}")
    print(f"   ✅ Error message: {error.get('message', 'N/A')}")
    
    return True, "Invalid tool test passed"

def test_plan_mode_missing_required_args():
    """Test Case 6: Plan Mode - Missing Required Args"""
    print("\n🧪 Test 6: Plan Mode - Missing Required Args")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {},  # Missing businessId
        "meta": {"requestId": "plan-no-args", "mode": "plan"}
    }
    
    print(f"   📤 Sending POST request with missing required args in plan mode")
    print(f"   📋 Request ID: plan-no-args")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    # Should return 400 with ARGS_VALIDATION_ERROR
    if response['status_code'] != 400:
        return False, f"Expected 400, got {response['status_code']}"
    
    data = response['data']
    error = data.get('error', {})
    error_code = error.get('code')
    
    if error_code != 'ARGS_VALIDATION_ERROR':
        return False, f"Expected ARGS_VALIDATION_ERROR, got {error_code}"
    
    print(f"   ✅ Missing args properly rejected: {error_code}")
    print(f"   ✅ Error message: {error.get('message', 'N/A')}")
    
    return True, "Missing required args test passed"

def test_plan_mode_legacy_format():
    """Test Case 7: Plan Mode - Legacy Format Support"""
    print("\n🧪 Test 7: Plan Mode - Legacy Format Support")
    
    payload = {
        "requestId": "plan-legacy",
        "tool": "tenant.bootstrap",
        "mode": "plan",
        "args": {"businessId": "test-biz"}
    }
    
    print(f"   📤 Sending POST request with legacy format")
    print(f"   📋 Request ID: plan-legacy")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}: {response.get('data', '')}"
    
    data = response['data']
    
    # Verify plan mode works with legacy format
    if data.get('mode') != 'plan':
        return False, f"Expected mode='plan', got {data.get('mode')}"
    
    if not data.get('ok'):
        return False, f"Response ok is false: {data.get('error', 'No error details')}"
    
    # Verify result structure (same as basic plan test)
    result = data.get('result', {})
    if 'plan' not in result:
        return False, "Missing plan in result"
    
    print(f"   ✅ Legacy format works with plan mode")
    print(f"   ✅ Response mode: {data.get('mode')}")
    
    return True, "Legacy format support test passed"

def test_plan_response_structure_validation():
    """Test Case 8: Plan Response Structure Validation"""
    print("\n🧪 Test 8: Plan Response Structure Validation")
    
    payload = {
        "tool": "tenant.bootstrap",
        "payload": {"businessId": "test-biz"},
        "meta": {"requestId": "plan-structure-test", "mode": "plan"}
    }
    
    print(f"   📤 Sending POST request for complete structure validation")
    print(f"   📋 Request ID: plan-structure-test")
    
    response = make_request('POST', API_ENDPOINT, payload, HEADERS)
    
    if not response['success']:
        return False, f"Request failed: {response['error']}"
    
    if response['status_code'] != 200:
        return False, f"Expected 200, got {response['status_code']}"
    
    data = response['data']
    result = data.get('result', {})
    
    # Verify result.description is a string
    description = result.get('description')
    if not isinstance(description, str):
        return False, f"result.description should be string, got {type(description)}"
    
    # Verify result.args.provided matches input
    args = result.get('args', {})
    provided = args.get('provided', {})
    if provided.get('businessId') != 'test-biz':
        return False, f"args.provided doesn't match input: {provided}"
    
    # Verify result.plan.steps structure
    plan = result.get('plan', {})
    steps = plan.get('steps', [])
    for i, step in enumerate(steps):
        required_fields = ['order', 'name', 'description', 'mutates', 'willExecute']
        for field in required_fields:
            if field not in step:
                return False, f"Step {i+1} missing {field}"
    
    # Verify result.sideEffects structure
    side_effects = result.get('sideEffects', [])
    for i, effect in enumerate(side_effects):
        required_fields = ['type', 'operation', 'collection']
        for field in required_fields:
            if field not in effect:
                return False, f"SideEffect {i+1} missing {field}"
    
    # Verify result.requiredSecrets structure
    required_secrets = result.get('requiredSecrets', [])
    for i, secret in enumerate(required_secrets):
        required_fields = ['name', 'required', 'isConfigured', 'status']
        for field in required_fields:
            if field not in secret:
                return False, f"RequiredSecret {i+1} missing {field}"
    
    # Verify result.risk structure
    risk = result.get('risk', {})
    risk_fields = ['level', 'mutates', 'reversible']
    for field in risk_fields:
        if field not in risk:
            return False, f"Risk missing {field}"
    
    # Verify result.readiness structure
    readiness = result.get('readiness', {})
    readiness_fields = ['canExecute', 'missingSecrets', 'warnings']
    for field in readiness_fields:
        if field not in readiness:
            return False, f"Readiness missing {field}"
    
    # Verify result.nextStep is a string
    next_step = result.get('nextStep')
    if not isinstance(next_step, str):
        return False, f"nextStep should be string, got {type(next_step)}"
    
    print(f"   ✅ Description: {description[:50]}...")
    print(f"   ✅ Steps count: {len(steps)}")
    print(f"   ✅ Side effects count: {len(side_effects)}")
    print(f"   ✅ Required secrets count: {len(required_secrets)}")
    print(f"   ✅ Risk level: {risk.get('level')}")
    print(f"   ✅ Can execute: {readiness.get('canExecute')}")
    print(f"   ✅ Next step: {next_step[:50]}...")
    
    return True, f"Complete structure validation passed, all fields present"

def main():
    """Run all Plan Mode tests"""
    print("🚀 Starting Plan Mode Feature Tests")
    print(f"📍 Testing endpoint: {API_ENDPOINT}")
    print(f"🔑 Using auth header: {AUTH_HEADER[:10]}...")
    
    results = TestResults()
    
    # Test 1: Plan Mode - Basic
    try:
        passed, details = test_plan_mode_basic()
        results.add_test("Plan Mode - Basic", passed, details)
    except Exception as e:
        results.add_test("Plan Mode - Basic", False, f"Exception: {str(e)}")
    
    # Test 2: Plan Mode - With Skip Options
    try:
        passed, details = test_plan_mode_with_skip_options()
        results.add_test("Plan Mode - With Skip Options", passed, details)
    except Exception as e:
        results.add_test("Plan Mode - With Skip Options", False, f"Exception: {str(e)}")
    
    # Test 3: Execute Mode - Explicit
    try:
        passed, details = test_execute_mode_explicit()
        results.add_test("Execute Mode - Explicit", passed, details)
    except Exception as e:
        results.add_test("Execute Mode - Explicit", False, f"Exception: {str(e)}")
    
    # Test 4: Execute Mode - Default
    try:
        passed, details = test_execute_mode_default()
        results.add_test("Execute Mode - Default", passed, details)
    except Exception as e:
        results.add_test("Execute Mode - Default", False, f"Exception: {str(e)}")
    
    # Test 5: Plan Mode - Invalid Tool
    try:
        passed, details = test_plan_mode_invalid_tool()
        results.add_test("Plan Mode - Invalid Tool", passed, details)
    except Exception as e:
        results.add_test("Plan Mode - Invalid Tool", False, f"Exception: {str(e)}")
    
    # Test 6: Plan Mode - Missing Required Args
    try:
        passed, details = test_plan_mode_missing_required_args()
        results.add_test("Plan Mode - Missing Required Args", passed, details)
    except Exception as e:
        results.add_test("Plan Mode - Missing Required Args", False, f"Exception: {str(e)}")
    
    # Test 7: Plan Mode - Legacy Format Support
    try:
        passed, details = test_plan_mode_legacy_format()
        results.add_test("Plan Mode - Legacy Format Support", passed, details)
    except Exception as e:
        results.add_test("Plan Mode - Legacy Format Support", False, f"Exception: {str(e)}")
    
    # Test 8: Plan Response Structure Validation
    try:
        passed, details = test_plan_response_structure_validation()
        results.add_test("Plan Response Structure Validation", passed, details)
    except Exception as e:
        results.add_test("Plan Response Structure Validation", False, f"Exception: {str(e)}")
    
    # Print results
    results.print_summary()
    
    # Return exit code
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)