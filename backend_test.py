#!/usr/bin/env python3
"""
Backend Test Suite for Book8 AI - Tenant Bootstrap Tool Testing
Tests the updated tenant.bootstrap tool at /api/internal/ops/execute
"""

import requests
import json
import uuid
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://ops-api-internal.preview.emergentagent.com"
API_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
AUTH_HEADER = "x-book8-internal-secret"
AUTH_TOKEN = "ops-dev-secret-change-me"

class TenantBootstrapTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            AUTH_HEADER: AUTH_TOKEN,
            "Content-Type": "application/json"
        })
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
        
    def make_request(self, method: str, data: Optional[Dict[Any, Any]] = None) -> requests.Response:
        """Make HTTP request to the API"""
        try:
            if method.upper() == "GET":
                return self.session.get(API_ENDPOINT)
            elif method.upper() == "POST":
                return self.session.post(API_ENDPOINT, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
        except Exception as e:
            print(f"Request failed: {e}")
            raise
            
    def test_basic_bootstrap_execution(self):
        """Test Case 1: Basic Bootstrap Execution"""
        print("\n=== Test Case 1: Basic Bootstrap Execution ===")
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "args": {"businessId": "test-business-xyz"}
        }
        
        try:
            response = self.make_request("POST", request_data)
            
            if response.status_code != 200:
                self.log_test("Basic Bootstrap - Status Code", False, f"Expected 200, got {response.status_code}")
                return
                
            data = response.json()
            
            # Check response structure
            required_fields = ["ok", "result"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                self.log_test("Basic Bootstrap - Response Structure", False, f"Missing fields: {missing_fields}")
                return
                
            # Check result structure
            result = data.get("result", {})
            required_result_fields = ["ready", "checklist", "details", "recommendations", "stats"]
            missing_result_fields = [field for field in required_result_fields if field not in result]
            if missing_result_fields:
                self.log_test("Basic Bootstrap - Result Structure", False, f"Missing result fields: {missing_result_fields}")
                return
                
            # Check checklist has 4 items (one per tool)
            checklist = result.get("checklist", [])
            if len(checklist) != 4:
                self.log_test("Basic Bootstrap - Checklist Length", False, f"Expected 4 items, got {len(checklist)}")
                return
                
            # Check checklist tools
            expected_tools = ["tenant.ensure", "billing.validateStripeConfig", "voice.smokeTest", "tenant.provisioningSummary"]
            actual_tools = [item.get("tool") for item in checklist]
            if actual_tools != expected_tools:
                self.log_test("Basic Bootstrap - Checklist Tools", False, f"Expected {expected_tools}, got {actual_tools}")
                return
                
            # Check details structure
            details = result.get("details", {})
            expected_detail_keys = ["tenant", "billing", "voice", "provisioning"]
            missing_detail_keys = [key for key in expected_detail_keys if key not in details]
            if missing_detail_keys:
                self.log_test("Basic Bootstrap - Details Structure", False, f"Missing detail keys: {missing_detail_keys}")
                return
                
            # Check stats structure
            stats = result.get("stats", {})
            expected_stat_keys = ["totalSteps", "completed", "warnings", "skipped", "failed"]
            missing_stat_keys = [key for key in expected_stat_keys if key not in stats]
            if missing_stat_keys:
                self.log_test("Basic Bootstrap - Stats Structure", False, f"Missing stat keys: {missing_stat_keys}")
                return
                
            self.log_test("Basic Bootstrap Execution", True, f"All 4 tools executed, ready: {result.get('ready')}")
            
        except Exception as e:
            self.log_test("Basic Bootstrap Execution", False, f"Exception: {str(e)}")
            
    def test_skip_options(self):
        """Test Case 2: Skip Options Test"""
        print("\n=== Test Case 2: Skip Options Test ===")
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "args": {
                "businessId": "test-business-xyz",
                "skipVoiceTest": True,
                "skipBillingCheck": True
            }
        }
        
        try:
            response = self.make_request("POST", request_data)
            
            if response.status_code != 200:
                self.log_test("Skip Options - Status Code", False, f"Expected 200, got {response.status_code}")
                return
                
            data = response.json()
            result = data.get("result", {})
            checklist = result.get("checklist", [])
            
            # Check that steps 2 and 3 are skipped
            if len(checklist) < 4:
                self.log_test("Skip Options - Checklist Length", False, f"Expected 4 items, got {len(checklist)}")
                return
                
            # Find billing and voice steps
            billing_step = next((item for item in checklist if item.get("tool") == "billing.validateStripeConfig"), None)
            voice_step = next((item for item in checklist if item.get("tool") == "voice.smokeTest"), None)
            
            if not billing_step or billing_step.get("status") != "skipped":
                self.log_test("Skip Options - Billing Skipped", False, f"Billing step not skipped: {billing_step}")
                return
                
            if not voice_step or voice_step.get("status") != "skipped":
                self.log_test("Skip Options - Voice Skipped", False, f"Voice step not skipped: {voice_step}")
                return
                
            self.log_test("Skip Options Test", True, "Both billing and voice steps correctly skipped")
            
        except Exception as e:
            self.log_test("Skip Options Test", False, f"Exception: {str(e)}")
            
    def test_dry_run_mode(self):
        """Test Case 3: Dry Run Mode"""
        print("\n=== Test Case 3: Dry Run Mode ===")
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "dryRun": True,
            "args": {"businessId": "test-business-xyz"}
        }
        
        try:
            response = self.make_request("POST", request_data)
            
            if response.status_code != 200:
                self.log_test("Dry Run - Status Code", False, f"Expected 200, got {response.status_code}")
                return
                
            data = response.json()
            
            # Check dryRun flag in response
            if not data.get("dryRun"):
                self.log_test("Dry Run - Response Flag", False, "dryRun flag not set in response")
                return
                
            result = data.get("result", {})
            
            # Check dryRun flag in result
            if not result.get("dryRun"):
                self.log_test("Dry Run - Result Flag", False, "dryRun flag not set in result")
                return
                
            # Check summary contains [DRY RUN]
            summary = result.get("summary", "")
            if "[DRY RUN]" not in summary:
                self.log_test("Dry Run - Summary", False, f"Summary doesn't contain [DRY RUN]: {summary}")
                return
                
            self.log_test("Dry Run Mode", True, "Dry run executed correctly with proper flags and summary")
            
        except Exception as e:
            self.log_test("Dry Run Mode", False, f"Exception: {str(e)}")
            
    def test_missing_business_id(self):
        """Test Case 4: Missing businessId"""
        print("\n=== Test Case 4: Missing businessId ===")
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "args": {}
        }
        
        try:
            response = self.make_request("POST", request_data)
            
            if response.status_code != 400:
                self.log_test("Missing businessId - Status Code", False, f"Expected 400, got {response.status_code}")
                return
                
            data = response.json()
            
            # Check error structure
            if not data.get("error"):
                self.log_test("Missing businessId - Error Structure", False, "No error field in response")
                return
                
            error = data.get("error", {})
            error_code = error.get("code")
            
            if error_code != "ARGS_VALIDATION_ERROR":
                self.log_test("Missing businessId - Error Code", False, f"Expected ARGS_VALIDATION_ERROR, got {error_code}")
                return
                
            self.log_test("Missing businessId", True, "Correctly returned 400 ARGS_VALIDATION_ERROR")
            
        except Exception as e:
            self.log_test("Missing businessId", False, f"Exception: {str(e)}")
            
    def test_response_format_validation(self):
        """Test Case 5: Response Format Validation"""
        print("\n=== Test Case 5: Response Format Validation ===")
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "args": {"businessId": "test-business-xyz"}
        }
        
        try:
            response = self.make_request("POST", request_data)
            
            if response.status_code != 200:
                self.log_test("Response Format - Status Code", False, f"Expected 200, got {response.status_code}")
                return
                
            data = response.json()
            result = data.get("result", {})
            
            # Validate exact structure as specified in review request
            expected_structure = {
                "ready": bool,
                "checklist": list,
                "details": dict,
                "recommendations": list,
                "stats": dict
            }
            
            validation_errors = []
            
            for field, expected_type in expected_structure.items():
                if field not in result:
                    validation_errors.append(f"Missing field: {field}")
                elif not isinstance(result[field], expected_type):
                    validation_errors.append(f"Field {field} should be {expected_type.__name__}, got {type(result[field]).__name__}")
                    
            if validation_errors:
                self.log_test("Response Format Validation", False, f"Validation errors: {validation_errors}")
                return
                
            # Check checklist items structure
            checklist = result.get("checklist", [])
            for i, item in enumerate(checklist):
                required_item_fields = ["step", "item", "tool", "status", "details"]
                missing_item_fields = [field for field in required_item_fields if field not in item]
                if missing_item_fields:
                    validation_errors.append(f"Checklist item {i} missing fields: {missing_item_fields}")
                    
            # Check stats structure
            stats = result.get("stats", {})
            required_stats = ["totalSteps", "completed", "warnings", "skipped", "failed"]
            for stat in required_stats:
                if stat not in stats or not isinstance(stats[stat], int):
                    validation_errors.append(f"Stats field {stat} missing or not integer")
                    
            if validation_errors:
                self.log_test("Response Format Validation", False, f"Structure validation errors: {validation_errors}")
                return
                
            self.log_test("Response Format Validation", True, "Response structure matches specification exactly")
            
        except Exception as e:
            self.log_test("Response Format Validation", False, f"Exception: {str(e)}")
            
    def test_authentication(self):
        """Test authentication requirements"""
        print("\n=== Authentication Test ===")
        
        # Test without auth header
        session_no_auth = requests.Session()
        session_no_auth.headers.update({"Content-Type": "application/json"})
        
        request_data = {
            "requestId": str(uuid.uuid4()),
            "tool": "tenant.bootstrap",
            "args": {"businessId": "test-business-xyz"}
        }
        
        try:
            response = session_no_auth.post(API_ENDPOINT, json=request_data)
            
            if response.status_code != 401:
                self.log_test("Authentication - No Header", False, f"Expected 401, got {response.status_code}")
                return
                
            data = response.json()
            error_code = data.get("error", {}).get("code")
            
            if error_code != "AUTH_FAILED":
                self.log_test("Authentication - Error Code", False, f"Expected AUTH_FAILED, got {error_code}")
                return
                
            self.log_test("Authentication Test", True, "Correctly requires x-book8-internal-secret header")
            
        except Exception as e:
            self.log_test("Authentication Test", False, f"Exception: {str(e)}")
            
    def run_all_tests(self):
        """Run all test cases"""
        print("🧪 Starting Tenant Bootstrap Tool Testing")
        print(f"📍 Testing endpoint: {API_ENDPOINT}")
        print(f"🔑 Using auth header: {AUTH_HEADER}")
        
        # Run all test cases
        self.test_authentication()
        self.test_basic_bootstrap_execution()
        self.test_skip_options()
        self.test_dry_run_mode()
        self.test_missing_business_id()
        self.test_response_format_validation()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
            
        return failed_tests == 0

if __name__ == "__main__":
    tester = TenantBootstrapTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)