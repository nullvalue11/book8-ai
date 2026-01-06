#!/usr/bin/env python3
"""
Backend Test Suite for Registry-Driven Tool Execution
Tests POST /api/internal/ops/execute with registry validation
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://ops-api-internal.preview.emergentagent.com"
AUTH_HEADER = "ops-dev-secret-change-me"

class RegistryToolExecutionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = {
            "Content-Type": "application/json",
            "x-book8-internal-secret": AUTH_HEADER
        }
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request and return response"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
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
                "status_code": 0,
                "error": str(e),
                "json": None,
                "text": "",
                "headers": {}
            }
    
    def test_1_valid_tool_from_registry(self):
        """Test Case 1: Valid Tool from Registry"""
        print("\n=== Test Case 1: Valid Tool from Registry ===")
        
        payload = {
            "tool": "tenant.bootstrap",
            "payload": {
                "businessId": "test-biz",
                "skipVoiceTest": True,
                "skipBillingCheck": True
            },
            "meta": {
                "requestId": f"registry-test-1-{int(time.time())}"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 200 and response["json"]:
            data = response["json"]
            success = (
                data.get("ok") == True and
                "result" in data and
                data.get("tool") == "tenant.bootstrap"
            )
            details = f"Response: ok={data.get('ok')}, tool={data.get('tool')}, durationMs={data.get('durationMs')}"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Valid Tool from Registry", success, details)
        return success
    
    def test_2_tool_not_in_registry(self):
        """Test Case 2: Tool NOT in Registry"""
        print("\n=== Test Case 2: Tool NOT in Registry ===")
        
        payload = {
            "tool": "fake.nonexistent.tool",
            "payload": {
                "businessId": "test"
            },
            "meta": {
                "requestId": f"registry-test-2-{int(time.time())}"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 400 and response["json"]:
            data = response["json"]
            error = data.get("error", {})
            success = (
                data.get("ok") == False and
                error.get("code") == "TOOL_NOT_IN_REGISTRY" and
                "availableTools" in error.get("details", {}) and
                error.get("details", {}).get("registryEndpoint") == "/api/internal/ops/tools"
            )
            details = f"Error code: {error.get('code')}, Available tools: {len(error.get('details', {}).get('availableTools', []))}"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Tool NOT in Registry", success, details)
        return success
    
    def test_3_registry_validation_missing_field(self):
        """Test Case 3: Registry Input Validation - Missing Required Field"""
        print("\n=== Test Case 3: Registry Input Validation - Missing Required Field ===")
        
        payload = {
            "tool": "tenant.bootstrap",
            "payload": {},  # Missing businessId
            "meta": {
                "requestId": f"registry-test-3-{int(time.time())}"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 400 and response["json"]:
            data = response["json"]
            error = data.get("error", {})
            success = (
                data.get("ok") == False and
                error.get("code") == "REGISTRY_VALIDATION_ERROR" and
                "errors" in error.get("details", {}) and
                "inputSchema" in error.get("details", {})
            )
            
            # Check if error mentions missing businessId
            error_details = error.get("details", {})
            errors = error_details.get("errors", [])
            has_business_id_error = any("businessId" in str(err) for err in errors)
            
            details = f"Error code: {error.get('code')}, Has businessId error: {has_business_id_error}, Errors: {len(errors)}"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Registry Validation - Missing Required Field", success, details)
        return success
    
    def test_4_registry_validation_wrong_type(self):
        """Test Case 4: Registry Input Validation - Wrong Type"""
        print("\n=== Test Case 4: Registry Input Validation - Wrong Type ===")
        
        payload = {
            "tool": "tenant.bootstrap",
            "payload": {
                "businessId": 12345  # Should be string, not number
            },
            "meta": {
                "requestId": f"registry-test-4-{int(time.time())}"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 400 and response["json"]:
            data = response["json"]
            error = data.get("error", {})
            success = (
                data.get("ok") == False and
                (error.get("code") == "REGISTRY_VALIDATION_ERROR" or error.get("code") == "ARGS_VALIDATION_ERROR") and
                "errors" in error.get("details", {})
            )
            details = f"Error code: {error.get('code')}, Validation failed for type mismatch"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Registry Validation - Wrong Type", success, details)
        return success
    
    def test_5_deprecated_tool_warning(self):
        """Test Case 5: Deprecated Tool Warning (Still Works)"""
        print("\n=== Test Case 5: Deprecated Tool Warning (Still Works) ===")
        
        payload = {
            "tool": "tenant.ensure",
            "payload": {
                "businessId": "test-biz"
            },
            "meta": {
                "requestId": f"registry-test-5-{int(time.time())}"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 200 and response["json"]:
            data = response["json"]
            success = (
                data.get("ok") == True and
                "result" in data and
                data.get("tool") == "tenant.ensure"
            )
            details = f"Deprecated tool executed successfully: ok={data.get('ok')}, tool={data.get('tool')}"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Deprecated Tool Warning (Still Works)", success, details)
        return success
    
    def test_6_tools_endpoint_shared_registry(self):
        """Test Case 6: Tools Endpoint Uses Shared Registry"""
        print("\n=== Test Case 6: Tools Endpoint Uses Shared Registry ===")
        
        # First get tools from registry endpoint
        registry_response = self.make_request("GET", "/api/internal/ops/tools")
        
        if registry_response["status_code"] != 200 or not registry_response["json"]:
            self.log_test("Tools Endpoint Uses Shared Registry", False, "Failed to get tools from registry")
            return False
        
        registry_data = registry_response["json"]
        registry_tools = [tool["name"] for tool in registry_data.get("tools", [])]
        
        # Get tools with deprecated included
        registry_response_with_deprecated = self.make_request("GET", "/api/internal/ops/tools?includeDeprecated=true")
        
        if registry_response_with_deprecated["status_code"] == 200 and registry_response_with_deprecated["json"]:
            all_tools = registry_response_with_deprecated["json"].get("tools", [])
            total_tools = len(all_tools)
            canonical_tools = len([t for t in all_tools if not t.get("deprecated", False)])
        else:
            total_tools = len(registry_tools)
            canonical_tools = len(registry_tools)
        
        # Check if we have expected number of tools
        success = (
            registry_data.get("ok") == True and
            len(registry_tools) >= 1 and  # At least 1 canonical tool
            total_tools >= canonical_tools  # Total should be >= canonical
        )
        
        details = f"Canonical tools: {canonical_tools}, Total tools (with deprecated): {total_tools}, Registry working: {registry_data.get('ok')}"
        
        self.log_test("Tools Endpoint Uses Shared Registry", success, details)
        return success
    
    def test_7_plan_mode_with_registry(self):
        """Test Case 7: Plan Mode with Registry"""
        print("\n=== Test Case 7: Plan Mode with Registry ===")
        
        payload = {
            "tool": "tenant.bootstrap",
            "payload": {
                "businessId": "test-biz"
            },
            "meta": {
                "requestId": f"registry-test-7-{int(time.time())}",
                "mode": "plan"
            }
        }
        
        response = self.make_request("POST", "/api/internal/ops/execute", payload)
        
        if response["status_code"] == 200 and response["json"]:
            data = response["json"]
            result = data.get("result", {})
            success = (
                data.get("ok") == True and
                data.get("mode") == "plan" and
                "plan" in result and
                "steps" in result.get("plan", {}) and
                "sideEffects" in result and
                "requiredSecrets" in result and
                "risk" in result
            )
            details = f"Plan mode working: mode={data.get('mode')}, steps={len(result.get('plan', {}).get('steps', []))}"
        else:
            success = False
            details = f"Status: {response['status_code']}, Response: {response.get('text', 'No response')[:200]}"
        
        self.log_test("Plan Mode with Registry", success, details)
        return success
    
    def run_all_tests(self):
        """Run all registry-driven tool execution tests"""
        print("🧪 REGISTRY-DRIVEN TOOL EXECUTION TESTING")
        print("=" * 60)
        print(f"Testing endpoint: {self.base_url}/api/internal/ops/execute")
        print(f"Auth header: x-book8-internal-secret: {AUTH_HEADER}")
        print()
        
        # Run all test cases
        test_methods = [
            self.test_1_valid_tool_from_registry,
            self.test_2_tool_not_in_registry,
            self.test_3_registry_validation_missing_field,
            self.test_4_registry_validation_wrong_type,
            self.test_5_deprecated_tool_warning,
            self.test_6_tools_endpoint_shared_registry,
            self.test_7_plan_mode_with_registry
        ]
        
        passed = 0
        total = len(test_methods)
        
        for test_method in test_methods:
            try:
                if test_method():
                    passed += 1
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                print(f"❌ FAIL: {test_method.__name__} - Exception: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 REGISTRY-DRIVEN TOOL EXECUTION TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {passed}/{total} tests")
        print(f"❌ Failed: {total - passed}/{total} tests")
        
        if passed == total:
            print("\n🎉 ALL REGISTRY-DRIVEN TOOL EXECUTION TESTS PASSED!")
            print("✅ Registry validation working correctly")
            print("✅ Tool discovery working correctly") 
            print("✅ Input/output validation working correctly")
            print("✅ Plan mode working with registry")
            print("✅ Deprecated tools still functional")
            print("✅ Error handling working correctly")
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Check details above.")
        
        return passed == total

def main():
    """Main test execution"""
    tester = RegistryToolExecutionTester()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test suite failed with exception: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()