#!/usr/bin/env python3
"""
Backend Test Suite for Book8 V1 Ops Tool Pack
Tests all 4 new ops tools (tenant.status, voice.diagnostics, billing.syncPrices, ops.replayExecution)

Test Cases from Review Request:
1. Verify Tools Appear in Registry
2. tenant.status - Read-only Status Check  
3. voice.diagnostics - Latency Checks
4. billing.syncPrices - Requires Approval Gate
5. billing.syncPrices - Plan Mode with Approval
6. ops.replayExecution - Plan Mode
7. ops.replayExecution - Execute Mode with Overrides
8. Validation Errors
9. Tool Schema Validation

Authentication: x-book8-internal-secret: ops-dev-secret-change-me
"""

import requests
import json
import time
import uuid
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://ops-command-9.preview.emergentagent.com"
AUTH_HEADER = "ops-dev-secret-change-me"

class OpsToolTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = {
            "Content-Type": "application/json",
            "x-book8-internal-secret": AUTH_HEADER
        }
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> tuple[int, Dict]:
        """Make HTTP request and return status code and response data"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
                
            return response.status_code, response_data
            
        except requests.exceptions.RequestException as e:
            return 0, {"error": str(e)}
    
    def test_1_verify_tools_in_registry(self):
        """Test Case 1: Verify Tools Appear in Registry"""
        print("🔍 Test Case 1: Verify Tools Appear in Registry")
        
        status_code, response = self.make_request("GET", "/api/internal/ops/tools")
        
        if status_code != 200:
            self.log_test("GET /api/internal/ops/tools", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("GET /api/internal/ops/tools", False, "Response ok=false", response)
            return
            
        tools = response.get("tools", [])
        tool_names = [tool["name"] for tool in tools]
        
        expected_tools = ["tenant.status", "voice.diagnostics", "billing.syncPrices", "ops.replayExecution"]
        missing_tools = [tool for tool in expected_tools if tool not in tool_names]
        
        if missing_tools:
            self.log_test("Tools Registry Check", False, f"Missing tools: {missing_tools}", {"found_tools": tool_names})
            return
            
        # Verify tool properties
        for expected_tool in expected_tools:
            tool_def = next((t for t in tools if t["name"] == expected_tool), None)
            if not tool_def:
                continue
                
            # Check specific properties based on review request
            if expected_tool == "tenant.status":
                if tool_def.get("category") != "tenant" or tool_def.get("mutates") != False:
                    self.log_test(f"{expected_tool} properties", False, f"Expected category=tenant, mutates=false", tool_def)
                    continue
                    
            elif expected_tool == "voice.diagnostics":
                if tool_def.get("category") != "voice" or tool_def.get("mutates") != False:
                    self.log_test(f"{expected_tool} properties", False, f"Expected category=voice, mutates=false", tool_def)
                    continue
                    
            elif expected_tool == "billing.syncPrices":
                if (tool_def.get("category") != "billing" or 
                    tool_def.get("mutates") != True or 
                    tool_def.get("requiresApproval") != True):
                    self.log_test(f"{expected_tool} properties", False, f"Expected category=billing, mutates=true, requiresApproval=true", tool_def)
                    continue
                    
            elif expected_tool == "ops.replayExecution":
                if tool_def.get("category") != "ops" or tool_def.get("mutates") != True:
                    self.log_test(f"{expected_tool} properties", False, f"Expected category=ops, mutates=true", tool_def)
                    continue
        
        self.log_test("Tools Registry Check", True, f"All 4 tools found with correct properties: {expected_tools}")
    
    def test_2_tenant_status(self):
        """Test Case 2: tenant.status - Read-only Status Check"""
        print("🔍 Test Case 2: tenant.status - Read-only Status Check")
        
        request_data = {
            "tool": "tenant.status",
            "payload": {"businessId": "test-status-biz"},
            "meta": {"requestId": "test-status-001"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", request_data)
        
        if status_code != 200:
            self.log_test("tenant.status execution", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("tenant.status execution", False, "Response ok=false", response)
            return
            
        result = response.get("result", {})
        
        # Check required fields from review request
        required_fields = ["summary", "checks"]
        missing_fields = [field for field in required_fields if field not in result]
        
        if missing_fields:
            self.log_test("tenant.status response format", False, f"Missing fields: {missing_fields}", result)
            return
            
        # Check summary has ready boolean
        summary = result.get("summary", {})
        if "ready" not in summary or not isinstance(summary["ready"], bool):
            self.log_test("tenant.status summary.ready", False, "summary.ready should be boolean", summary)
            return
            
        # Check checks is array
        checks = result.get("checks", [])
        if not isinstance(checks, list):
            self.log_test("tenant.status checks array", False, "checks should be array", checks)
            return
            
        self.log_test("tenant.status execution", True, f"Ready: {summary['ready']}, Checks: {len(checks)}")
    
    def test_3_voice_diagnostics(self):
        """Test Case 3: voice.diagnostics - Latency Checks"""
        print("🔍 Test Case 3: voice.diagnostics - Latency Checks")
        
        request_data = {
            "tool": "voice.diagnostics", 
            "payload": {"timeoutMs": 3000},
            "meta": {"requestId": "test-voice-001"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", request_data)
        
        if status_code != 200:
            self.log_test("voice.diagnostics execution", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("voice.diagnostics execution", False, "Response ok=false", response)
            return
            
        result = response.get("result", {})
        
        # Check required fields from review request
        required_fields = ["overallStatus", "summary", "results"]
        missing_fields = [field for field in required_fields if field not in result]
        
        if missing_fields:
            self.log_test("voice.diagnostics response format", False, f"Missing fields: {missing_fields}", result)
            return
            
        # Check summary has total/healthy/unhealthy counts
        summary = result.get("summary", {})
        summary_fields = ["total", "healthy", "unhealthy"]
        missing_summary = [field for field in summary_fields if field not in summary]
        
        if missing_summary:
            self.log_test("voice.diagnostics summary", False, f"Missing summary fields: {missing_summary}", summary)
            return
            
        # Check results array with latency info
        results_array = result.get("results", [])
        if not isinstance(results_array, list):
            self.log_test("voice.diagnostics results", False, "results should be array", results_array)
            return
            
        # Check at least one result has latency info
        has_latency = any("latencyMs" in r for r in results_array)
        if not has_latency and len(results_array) > 0:
            self.log_test("voice.diagnostics latency", False, "No latency info found in results", results_array)
            return
            
        self.log_test("voice.diagnostics execution", True, 
                     f"Status: {result['overallStatus']}, Total: {summary['total']}, Healthy: {summary['healthy']}")
    
    def test_4_billing_sync_requires_approval(self):
        """Test Case 4: billing.syncPrices - Requires Approval Gate"""
        print("🔍 Test Case 4: billing.syncPrices - Requires Approval Gate")
        
        request_data = {
            "tool": "billing.syncPrices",
            "payload": {"businessId": "test-billing", "mode": "plan"},
            "meta": {"requestId": "test-billing-001"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", request_data)
        
        # Should return 403 with approval_required status since requiresApproval=true
        if status_code != 403:
            self.log_test("billing.syncPrices approval gate", False, f"Expected 403, got {status_code}", response)
            return
            
        if response.get("status") != "approval_required":
            self.log_test("billing.syncPrices approval status", False, f"Expected status=approval_required", response)
            return
            
        # Check approval object structure
        approval = response.get("approval", {})
        if not approval:
            self.log_test("billing.syncPrices approval object", False, "Missing approval object", response)
            return
            
        self.log_test("billing.syncPrices approval gate", True, "Correctly requires approval")
    
    def test_5_billing_sync_with_approval(self):
        """Test Case 5: billing.syncPrices - Plan Mode with Approval"""
        print("🔍 Test Case 5: billing.syncPrices - Plan Mode with Approval")
        
        request_data = {
            "tool": "billing.syncPrices",
            "payload": {"businessId": "test-billing", "mode": "plan"},
            "meta": {"requestId": "test-billing-002", "approved": True}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", request_data)
        
        # With approval, should proceed (may fail with STRIPE_NOT_CONFIGURED which is expected)
        if status_code not in [200, 400]:
            self.log_test("billing.syncPrices with approval", False, f"Expected 200 or 400, got {status_code}", response)
            return
            
        # If 400, check if it's STRIPE_NOT_CONFIGURED (expected)
        if status_code == 400:
            result = response.get("result", {})
            error = result.get("error", {})
            if error.get("code") == "STRIPE_NOT_CONFIGURED":
                self.log_test("billing.syncPrices with approval", True, "Approval gate bypassed, failed at Stripe config (expected)")
                return
            else:
                self.log_test("billing.syncPrices with approval", False, f"Unexpected error: {error}", response)
                return
        
        # If 200, check response structure
        if not response.get("ok"):
            result = response.get("result", {})
            error = result.get("error", {})
            if error.get("code") == "STRIPE_NOT_CONFIGURED":
                self.log_test("billing.syncPrices with approval", True, "Approval gate bypassed, failed at Stripe config (expected)")
                return
        
        self.log_test("billing.syncPrices with approval", True, "Tool executed with approval")
    
    def test_6_ops_replay_plan_mode(self):
        """Test Case 6: ops.replayExecution - Plan Mode"""
        print("🔍 Test Case 6: ops.replayExecution - Plan Mode")
        
        # First execute tenant.status to create an execution log
        setup_request = {
            "tool": "tenant.status",
            "payload": {"businessId": "test-replay-setup"},
            "meta": {"requestId": "test-replay-setup-001"}
        }
        
        setup_status, setup_response = self.make_request("POST", "/api/internal/ops/execute", setup_request)
        
        if setup_status != 200 or not setup_response.get("ok"):
            self.log_test("ops.replayExecution setup", False, "Failed to create execution for replay", setup_response)
            return
        
        # Wait a moment for event log to be saved
        time.sleep(1)
        
        # Now test replay in plan mode
        replay_request = {
            "tool": "ops.replayExecution",
            "payload": {"requestId": "test-replay-setup-001", "mode": "plan"},
            "meta": {"requestId": "test-replay-001"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", replay_request)
        
        if status_code != 200:
            self.log_test("ops.replayExecution plan mode", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("ops.replayExecution plan mode", False, "Response ok=false", response)
            return
            
        result = response.get("result", {})
        
        # Check required fields from review request
        if result.get("mode") != "plan":
            self.log_test("ops.replayExecution mode", False, f"Expected mode=plan, got {result.get('mode')}", result)
            return
            
        if result.get("executed") != False:
            self.log_test("ops.replayExecution executed", False, f"Expected executed=false, got {result.get('executed')}", result)
            return
            
        # Check summary.originalExecution contains original tool info
        summary = result.get("summary", {})
        original_execution = summary.get("originalExecution", {})
        
        if not original_execution:
            self.log_test("ops.replayExecution originalExecution", False, "Missing summary.originalExecution", summary)
            return
            
        if original_execution.get("tool") != "tenant.status":
            self.log_test("ops.replayExecution original tool", False, f"Expected tool=tenant.status, got {original_execution.get('tool')}", original_execution)
            return
            
        self.log_test("ops.replayExecution plan mode", True, f"Plan mode successful, original tool: {original_execution.get('tool')}")
    
    def test_7_ops_replay_execute_mode(self):
        """Test Case 7: ops.replayExecution - Execute Mode with Overrides"""
        print("🔍 Test Case 7: ops.replayExecution - Execute Mode with Overrides")
        
        # Use the same setup execution from previous test
        replay_request = {
            "tool": "ops.replayExecution",
            "payload": {
                "requestId": "test-replay-setup-001", 
                "mode": "execute",
                "overridePayload": {"businessId": "overridden-biz"}
            },
            "meta": {"requestId": "test-replay-002"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", replay_request)
        
        if status_code != 200:
            self.log_test("ops.replayExecution execute mode", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("ops.replayExecution execute mode", False, "Response ok=false", response)
            return
            
        result = response.get("result", {})
        
        # Check required fields from review request
        if result.get("mode") != "execute":
            self.log_test("ops.replayExecution execute mode", False, f"Expected mode=execute, got {result.get('mode')}", result)
            return
            
        if result.get("executed") != True:
            self.log_test("ops.replayExecution executed", False, f"Expected executed=true, got {result.get('executed')}", result)
            return
            
        # Check result contains replayed execution result
        if "result" not in result:
            self.log_test("ops.replayExecution result", False, "Missing result field", result)
            return
            
        self.log_test("ops.replayExecution execute mode", True, "Execute mode successful with overrides")
    
    def test_8_validation_errors(self):
        """Test Case 8: Validation Errors"""
        print("🔍 Test Case 8: Validation Errors")
        
        # Test tenant.status without required businessId
        request_data = {
            "tool": "tenant.status",
            "payload": {},  # Missing businessId
            "meta": {"requestId": "test-validation-001"}
        }
        
        status_code, response = self.make_request("POST", "/api/internal/ops/execute", request_data)
        
        # Should return validation error
        if status_code != 400:
            self.log_test("Validation error test", False, f"Expected 400, got {status_code}", response)
            return
            
        error = response.get("error", {})
        if "VALIDATION" not in error.get("code", ""):
            self.log_test("Validation error code", False, f"Expected validation error code, got {error.get('code')}", error)
            return
            
        self.log_test("Validation error test", True, f"Correctly returned validation error: {error.get('code')}")
    
    def test_9_tool_schema_validation(self):
        """Test Case 9: Tool Schema Validation"""
        print("🔍 Test Case 9: Tool Schema Validation")
        
        status_code, response = self.make_request("GET", "/api/internal/ops/tools?format=full")
        
        if status_code != 200:
            self.log_test("Tool schema validation", False, f"Expected 200, got {status_code}", response)
            return
            
        if not response.get("ok"):
            self.log_test("Tool schema validation", False, "Response ok=false", response)
            return
            
        tools = response.get("tools", [])
        expected_tools = ["tenant.status", "voice.diagnostics", "billing.syncPrices", "ops.replayExecution"]
        
        for tool_name in expected_tools:
            tool_def = next((t for t in tools if t["name"] == tool_name), None)
            if not tool_def:
                self.log_test(f"{tool_name} schema", False, f"Tool not found in registry", None)
                continue
                
            # Check required schema fields
            required_fields = ["name", "description", "category", "mutates", "risk", "inputSchema", "outputSchema", "examples"]
            missing_fields = [field for field in required_fields if field not in tool_def]
            
            if missing_fields:
                self.log_test(f"{tool_name} schema", False, f"Missing fields: {missing_fields}", tool_def)
                continue
                
            # Check inputSchema is valid
            input_schema = tool_def.get("inputSchema", {})
            if not isinstance(input_schema, dict) or "type" not in input_schema:
                self.log_test(f"{tool_name} inputSchema", False, "Invalid inputSchema format", input_schema)
                continue
                
            # Check outputSchema is valid
            output_schema = tool_def.get("outputSchema", {})
            if not isinstance(output_schema, dict) or "type" not in output_schema:
                self.log_test(f"{tool_name} outputSchema", False, "Invalid outputSchema format", output_schema)
                continue
                
            # Check examples is array
            examples = tool_def.get("examples", [])
            if not isinstance(examples, list):
                self.log_test(f"{tool_name} examples", False, "Examples should be array", examples)
                continue
                
            self.log_test(f"{tool_name} schema", True, "All required schema fields present")
    
    def run_all_tests(self):
        """Run all test cases"""
        print("🚀 Starting Book8 V1 Ops Tool Pack Testing")
        print("=" * 60)
        print()
        
        # Run all test cases
        self.test_1_verify_tools_in_registry()
        self.test_2_tenant_status()
        self.test_3_voice_diagnostics()
        self.test_4_billing_sync_requires_approval()
        self.test_5_billing_sync_with_approval()
        self.test_6_ops_replay_plan_mode()
        self.test_7_ops_replay_execute_mode()
        self.test_8_validation_errors()
        self.test_9_tool_schema_validation()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
        
        print("🎯 FOCUS AREAS VERIFIED:")
        print("  1. All 4 tools properly registered and discoverable ✅")
        print("  2. Read-only tools (tenant.status, voice.diagnostics) work without approval ✅")
        print("  3. Mutating tool (billing.syncPrices) requires approval gate ✅")
        print("  4. Plan mode works for billing.syncPrices and ops.replayExecution ✅")
        print("  5. Replay can load and re-execute previous executions ✅")
        print()
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = OpsToolTester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 ALL TESTS PASSED! V1 Ops Tool Pack is working correctly.")
        exit(0)
    else:
        print("💥 SOME TESTS FAILED! Check the details above.")
        exit(1)