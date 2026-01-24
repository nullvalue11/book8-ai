#!/usr/bin/env python3
"""
Backend Test Suite for tenant.recovery Ops Tool
Tests the comprehensive tenant.recovery ops tool at /api/internal/ops/execute

Test Cases:
1. Plan Mode - Call with meta.mode: "plan" to get execution plan
2. Dry Run Mode - Call with meta.dryRun: true
3. Execute Mode - Healthy Tenant (create test tenant first)
4. Execute Mode - Non-existent Tenant
5. AutoFix Enabled - Call with payload.autoFix: true
6. Skip Voice Test - Call with payload.runVoiceTest: false
7. Skip Billing Check - Call with payload.recheckBilling: false
8. Input Validation - Test with missing businessId
"""

import requests
import json
import os
import uuid
import time
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://oauth-fix-10.preview.emergentagent.com')
OPS_SECRET = os.getenv('OPS_INTERNAL_SECRET', 'ops-dev-secret-change-me')

class TenantRecoveryTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = {
            'Content-Type': 'application/json',
            'x-book8-internal-secret': OPS_SECRET
        }
        self.test_results = []
        
    def log_test(self, test_name, success, details):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def make_request(self, payload):
        """Make request to ops execute endpoint"""
        try:
            url = f"{self.base_url}/api/internal/ops/execute"
            print(f"\n🔄 Making request to: {url}")
            print(f"📤 Payload: {json.dumps(payload, indent=2)}")
            
            response = requests.post(url, json=payload, headers=self.headers, timeout=30)
            
            print(f"📥 Status: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"📥 Response: {json.dumps(response_data, indent=2)}")
                return response.status_code, response_data
            except json.JSONDecodeError:
                print(f"📥 Response (text): {response.text}")
                return response.status_code, {'error': 'Invalid JSON response', 'text': response.text}
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request failed: {str(e)}")
            return 500, {'error': str(e)}
    
    def test_1_plan_mode(self):
        """Test 1: Plan Mode - Call with meta.mode: 'plan'"""
        print("\n" + "="*60)
        print("TEST 1: Plan Mode")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_plan",
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": False
            },
            "meta": {
                "mode": "plan",
                "requestId": f"test-plan-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify plan mode response
        success = (
            status_code == 200 and
            response.get('ok') == True and
            response.get('mode') == 'plan' and
            'plan' in response.get('result', {}) and
            response.get('result', {}).get('executed') == False
        )
        
        details = f"Status: {status_code}, Mode: {response.get('mode')}, Executed: {response.get('result', {}).get('executed')}"
        if success and 'plan' in response.get('result', {}):
            plan = response['result']['plan']
            details += f", Steps: {len(plan.get('steps', []))}"
            
            # Verify plan includes expected steps
            steps = plan.get('steps', [])
            step_actions = [step.get('action') for step in steps]
            expected_actions = ['tenant.status', 'voice.diagnostics', 'billing.validateStripeConfig', 'aggregate_results']
            
            if all(action in step_actions for action in expected_actions):
                details += " - All expected steps present"
            else:
                details += f" - Missing steps: {set(expected_actions) - set(step_actions)}"
        
        self.log_test("Plan Mode", success, details)
        return success
    
    def test_2_dry_run_mode(self):
        """Test 2: Dry Run Mode - Call with meta.dryRun: true"""
        print("\n" + "="*60)
        print("TEST 2: Dry Run Mode")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_dryrun",
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": True
            },
            "meta": {
                "mode": "execute",
                "dryRun": True,
                "requestId": f"test-dryrun-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify dry run response
        success = (
            status_code == 200 and
            response.get('ok') == True and
            response.get('dryRun') == True and
            response.get('result', {}).get('executed') == False
        )
        
        details = f"Status: {status_code}, DryRun: {response.get('dryRun')}, Executed: {response.get('result', {}).get('executed')}"
        if success:
            result = response.get('result', {})
            if 'simulatedResult' in result:
                details += " - Contains simulated result"
            if 'wouldExecute' in result:
                details += " - Contains execution plan"
        
        self.log_test("Dry Run Mode", success, details)
        return success
    
    def test_3_create_test_tenant(self):
        """Test 3a: Create a test tenant using tenant.bootstrap"""
        print("\n" + "="*60)
        print("TEST 3a: Create Test Tenant")
        print("="*60)
        
        payload = {
            "tool": "tenant.bootstrap",
            "payload": {
                "businessId": "test_business_healthy",
                "name": "Test Business for Recovery",
                "skipVoiceTest": True,  # Skip to avoid external dependencies
                "skipBillingCheck": True  # Skip to avoid Stripe dependencies
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-bootstrap-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify tenant creation
        success = (
            status_code == 200 and
            response.get('ok') == True
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Ready: {result.get('ready')}"
            if 'checklist' in result:
                details += f", Checklist items: {len(result['checklist'])}"
        
        self.log_test("Create Test Tenant", success, details)
        return success
    
    def test_4_execute_healthy_tenant(self):
        """Test 3b: Execute Mode - Healthy Tenant"""
        print("\n" + "="*60)
        print("TEST 3b: Execute Mode - Healthy Tenant")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_healthy",
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": False
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-execute-healthy-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify execution response
        success = (
            status_code == 200 and
            response.get('ok') == True and
            response.get('result', {}).get('recoveryStatus') in ['healthy', 'needs_attention']
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Recovery Status: {result.get('recoveryStatus')}"
            details += f", Issues Found: {result.get('issuesFound', 0)}"
            details += f", Issues Fixed: {result.get('issuesFixed', 0)}"
            
            # Verify response structure
            if 'checks' in result:
                checks = result['checks']
                details += f", Checks: voice={checks.get('voice', {}).get('status')}"
                details += f", billing={checks.get('billing', {}).get('status')}"
                details += f", provisioning={checks.get('provisioning', {}).get('ready')}"
        
        self.log_test("Execute Mode - Healthy Tenant", success, details)
        return success
    
    def test_5_execute_nonexistent_tenant(self):
        """Test 4: Execute Mode - Non-existent Tenant"""
        print("\n" + "="*60)
        print("TEST 4: Execute Mode - Non-existent Tenant")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": f"nonexistent_business_{uuid.uuid4().hex[:8]}",
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": False
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-nonexistent-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Should still return 200 but with issues identified
        success = (
            status_code == 200 and
            response.get('ok') == True
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Recovery Status: {result.get('recoveryStatus')}"
            details += f", Issues Found: {result.get('issuesFound', 0)}"
            
            # Should have issues for non-existent tenant
            if result.get('issuesFound', 0) > 0:
                details += " - Issues correctly identified"
            else:
                details += " - Warning: No issues found for non-existent tenant"
        
        self.log_test("Execute Mode - Non-existent Tenant", success, details)
        return success
    
    def test_6_autofix_enabled(self):
        """Test 5: AutoFix Enabled - Call with payload.autoFix: true"""
        print("\n" + "="*60)
        print("TEST 5: AutoFix Enabled")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_healthy",
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": True
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-autofix-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify autofix response
        success = (
            status_code == 200 and
            response.get('ok') == True
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Recovery Status: {result.get('recoveryStatus')}"
            details += f", Issues Found: {result.get('issuesFound', 0)}"
            details += f", Issues Fixed: {result.get('issuesFixed', 0)}"
            
            # Verify actions array shows auto-fix attempts
            actions = result.get('actions', [])
            if any('AutoFix' in action for action in actions):
                details += " - AutoFix actions present"
            else:
                details += " - No AutoFix actions (may be healthy)"
            
            # Verify recommendations
            recommendations = result.get('recommendations', [])
            details += f", Recommendations: {len(recommendations)}"
        
        self.log_test("AutoFix Enabled", success, details)
        return success
    
    def test_7_skip_voice_test(self):
        """Test 6: Skip Voice Test - Call with payload.runVoiceTest: false"""
        print("\n" + "="*60)
        print("TEST 6: Skip Voice Test")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_healthy",
                "runVoiceTest": False,
                "recheckBilling": True,
                "autoFix": False
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-skip-voice-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify voice test is skipped
        success = (
            status_code == 200 and
            response.get('ok') == True
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Recovery Status: {result.get('recoveryStatus')}"
            
            # Verify voice check is skipped
            voice_check = result.get('checks', {}).get('voice', {})
            if voice_check.get('status') == 'skipped':
                details += " - Voice check correctly skipped"
            else:
                details += f" - Voice check status: {voice_check.get('status')}"
            
            # Verify other checks still run
            billing_check = result.get('checks', {}).get('billing', {})
            provisioning_check = result.get('checks', {}).get('provisioning', {})
            details += f", Billing: {billing_check.get('status')}, Provisioning: {provisioning_check.get('ready')}"
        
        self.log_test("Skip Voice Test", success, details)
        return success
    
    def test_8_skip_billing_check(self):
        """Test 7: Skip Billing Check - Call with payload.recheckBilling: false"""
        print("\n" + "="*60)
        print("TEST 7: Skip Billing Check")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                "businessId": "test_business_healthy",
                "runVoiceTest": True,
                "recheckBilling": False,
                "autoFix": False
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-skip-billing-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Verify billing check is skipped
        success = (
            status_code == 200 and
            response.get('ok') == True
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if success:
            result = response.get('result', {})
            details += f", Recovery Status: {result.get('recoveryStatus')}"
            
            # Verify billing check is skipped
            billing_check = result.get('checks', {}).get('billing', {})
            if billing_check.get('status') == 'skipped':
                details += " - Billing check correctly skipped"
            else:
                details += f" - Billing check status: {billing_check.get('status')}"
            
            # Verify other checks still run
            voice_check = result.get('checks', {}).get('voice', {})
            provisioning_check = result.get('checks', {}).get('provisioning', {})
            details += f", Voice: {voice_check.get('status')}, Provisioning: {provisioning_check.get('ready')}"
        
        self.log_test("Skip Billing Check", success, details)
        return success
    
    def test_9_input_validation(self):
        """Test 8: Input Validation - Test with missing businessId"""
        print("\n" + "="*60)
        print("TEST 8: Input Validation - Missing businessId")
        print("="*60)
        
        payload = {
            "tool": "tenant.recovery",
            "payload": {
                # Missing businessId
                "runVoiceTest": True,
                "recheckBilling": True,
                "autoFix": False
            },
            "meta": {
                "mode": "execute",
                "requestId": f"test-validation-{uuid.uuid4().hex[:8]}"
            }
        }
        
        status_code, response = self.make_request(payload)
        
        # Should return validation error
        success = (
            status_code == 400 and
            response.get('ok') == False and
            'businessId' in str(response.get('error', {}))
        )
        
        details = f"Status: {status_code}, OK: {response.get('ok')}"
        if response.get('error'):
            error_msg = response['error'].get('message', '')
            details += f", Error: {error_msg}"
            if 'businessId' in error_msg:
                details += " - Correctly validates missing businessId"
        
        self.log_test("Input Validation - Missing businessId", success, details)
        return success
    
    def run_all_tests(self):
        """Run all test cases"""
        print("🚀 Starting tenant.recovery Ops Tool Comprehensive Testing")
        print(f"🔗 Base URL: {self.base_url}")
        print(f"🔑 Using OPS_INTERNAL_SECRET: {OPS_SECRET[:10]}...")
        
        start_time = time.time()
        
        # Run all tests
        tests = [
            self.test_1_plan_mode,
            self.test_2_dry_run_mode,
            self.test_3_create_test_tenant,
            self.test_4_execute_healthy_tenant,
            self.test_5_execute_nonexistent_tenant,
            self.test_6_autofix_enabled,
            self.test_7_skip_voice_test,
            self.test_8_skip_billing_check,
            self.test_9_input_validation
        ]
        
        passed = 0
        failed = 0
        
        for test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Test {test_func.__name__} crashed: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        # Print summary
        total_time = time.time() - start_time
        print("\n" + "="*60)
        print("🏁 TEST SUMMARY")
        print("="*60)
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Total: {passed + failed}")
        print(f"⏱️  Duration: {total_time:.2f}s")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        # Print detailed results
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['details']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = TenantRecoveryTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)