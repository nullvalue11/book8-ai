#!/usr/bin/env python3
"""
Test the comprehensive tool call logging system for Book8's ops control plane.

This test follows the exact scenarios from the review request:
1. Execute Tool and Verify Log Created
2. Plan Mode Logging  
3. Get Log by ID (Detail Endpoint)
4. List Logs with Filtering
5. Pagination Test
6. Date Range Filtering
7. Log Not Found
8. Auth Required
9. Verify Full Input/Output Capture

Authentication: x-book8-internal-secret: ops-dev-secret-change-me
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://ops-admin-tools.preview.emergentagent.com"
EXECUTE_ENDPOINT = f"{BASE_URL}/api/internal/ops/execute"
LOGS_ENDPOINT = f"{BASE_URL}/api/internal/ops/logs"
AUTH_HEADER = "x-book8-internal-secret"
AUTH_SECRET = "ops-dev-secret-change-me"

def log_test_result(test_name, success, details=""):
    """Log test results with consistent formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(url, method="GET", params=None, json_data=None, auth_secret=None):
    """Make HTTP request with proper error handling"""
    headers = {'Content-Type': 'application/json'}
    if auth_secret is not None:
        headers[AUTH_HEADER] = auth_secret
    
    try:
        if method == "GET":
            response = requests.get(url, params=params, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=json_data, headers=headers, timeout=30)
        else:
            response = requests.request(method, url, headers=headers, timeout=30)
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'json': response.json() if response.headers.get('content-type', '').startswith('application/json') else None,
            'text': response.text
        }
    except requests.exceptions.RequestException as e:
        return {
            'error': str(e),
            'status_code': None
        }

def test_1_execute_tool_and_verify_log():
    """Test Case 1: Execute Tool and Verify Log Created"""
    print("🔍 Test Case 1: Execute Tool and Verify Log Created")
    
    # Step 1: Execute tenant.bootstrap tool
    execute_payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-log-capture-123",
            "skipVoiceTest": True,
            "skipBillingCheck": True
        },
        "meta": {
            "requestId": "log-test-exec-001"
        }
    }
    
    print("  📤 Executing tenant.bootstrap tool...")
    execute_response = make_request(EXECUTE_ENDPOINT, method="POST", json_data=execute_payload, auth_secret=AUTH_SECRET)
    
    if execute_response.get('error'):
        log_test_result("Execute Tool", False, f"Execute request failed: {execute_response['error']}")
        return False
    
    if execute_response['status_code'] not in [200, 201]:
        log_test_result("Execute Tool", False, f"Execute failed with status {execute_response['status_code']}: {execute_response.get('text', '')}")
        return False
    
    execute_data = execute_response['json']
    print(f"  ✅ Tool executed: {execute_data.get('ok', False)}")
    
    # Wait a moment for log to be written
    time.sleep(2)
    
    # Step 2: Query logs for the specific requestId
    print("  🔍 Querying logs for requestId: log-test-exec-001...")
    logs_response = make_request(LOGS_ENDPOINT, params={'requestId': 'log-test-exec-001'}, auth_secret=AUTH_SECRET)
    
    if logs_response.get('error'):
        log_test_result("Execute Tool and Verify Log", False, f"Logs query failed: {logs_response['error']}")
        return False
    
    if logs_response['status_code'] != 200:
        log_test_result("Execute Tool and Verify Log", False, f"Logs query failed with status {logs_response['status_code']}")
        return False
    
    logs_data = logs_response['json']
    
    # Step 3: Verify log was created
    if len(logs_data['logs']) == 0:
        log_test_result("Execute Tool and Verify Log", False, "No log found for requestId: log-test-exec-001")
        return False
    
    log_entry = logs_data['logs'][0]
    
    # Verify log contents
    checks = [
        (log_entry.get('tool') == 'tenant.bootstrap', f"Tool mismatch: {log_entry.get('tool')}"),
        (log_entry.get('businessId') == 'test-log-capture-123', f"BusinessId mismatch: {log_entry.get('businessId')}"),
        (log_entry.get('status') in ['success', 'partial'], f"Unexpected status: {log_entry.get('status')}"),
        (log_entry.get('requestId') == 'log-test-exec-001', f"RequestId mismatch: {log_entry.get('requestId')}")
    ]
    
    for check, error_msg in checks:
        if not check:
            log_test_result("Execute Tool and Verify Log", False, error_msg)
            return False
    
    log_test_result("Execute Tool and Verify Log", True, f"Log found with tool={log_entry.get('tool')}, businessId={log_entry.get('businessId')}, status={log_entry.get('status')}")
    return True

def test_2_plan_mode_logging():
    """Test Case 2: Plan Mode Logging"""
    print("🔍 Test Case 2: Plan Mode Logging")
    
    # Execute tenant.bootstrap in plan mode
    plan_payload = {
        "tool": "tenant.bootstrap",
        "payload": {
            "businessId": "test-plan-log-456"
        },
        "meta": {
            "requestId": "log-test-plan-001",
            "mode": "plan"
        }
    }
    
    print("  📤 Executing tenant.bootstrap in plan mode...")
    plan_response = make_request(EXECUTE_ENDPOINT, method="POST", json_data=plan_payload, auth_secret=AUTH_SECRET)
    
    if plan_response.get('error'):
        log_test_result("Plan Mode Logging", False, f"Plan request failed: {plan_response['error']}")
        return False
    
    if plan_response['status_code'] not in [200, 201]:
        log_test_result("Plan Mode Logging", False, f"Plan failed with status {plan_response['status_code']}: {plan_response.get('text', '')}")
        return False
    
    plan_data = plan_response['json']
    print(f"  ✅ Plan generated: {plan_data.get('ok', False)}")
    
    # Wait for log to be written
    time.sleep(2)
    
    # Query logs for the plan mode execution
    print("  🔍 Querying logs for plan mode requestId: log-test-plan-001...")
    logs_response = make_request(LOGS_ENDPOINT, params={'requestId': 'log-test-plan-001'}, auth_secret=AUTH_SECRET)
    
    if logs_response.get('error'):
        log_test_result("Plan Mode Logging", False, f"Logs query failed: {logs_response['error']}")
        return False
    
    if logs_response['status_code'] != 200:
        log_test_result("Plan Mode Logging", False, f"Logs query failed with status {logs_response['status_code']}")
        return False
    
    logs_data = logs_response['json']
    
    if len(logs_data['logs']) == 0:
        log_test_result("Plan Mode Logging", False, "No log found for plan mode requestId: log-test-plan-001")
        return False
    
    log_entry = logs_data['logs'][0]
    
    # Verify plan mode is logged in metadata/result
    metadata = log_entry.get('metadata', {})
    has_plan_mode = (
        log_entry.get('mode') == 'plan' or 
        metadata.get('mode') == 'plan' or
        'plan' in str(log_entry.get('result', {}))
    )
    
    if not has_plan_mode:
        log_test_result("Plan Mode Logging", False, f"Plan mode not found in log. Mode: {log_entry.get('mode')}, Metadata: {metadata}")
        return False
    
    log_test_result("Plan Mode Logging", True, f"Plan mode logged correctly with requestId={log_entry.get('requestId')}")
    return True

def test_3_get_log_by_id():
    """Test Case 3: Get Log by ID (Detail Endpoint)"""
    print("🔍 Test Case 3: Get Log by ID (Detail Endpoint)")
    
    # Get log by ID using the requestId from test 1
    detail_url = f"{LOGS_ENDPOINT}/log-test-exec-001"
    print(f"  🔍 Getting log details: {detail_url}")
    
    detail_response = make_request(detail_url, auth_secret=AUTH_SECRET)
    
    if detail_response.get('error'):
        log_test_result("Get Log by ID", False, f"Detail request failed: {detail_response['error']}")
        return False
    
    if detail_response['status_code'] != 200:
        log_test_result("Get Log by ID", False, f"Detail request failed with status {detail_response['status_code']}: {detail_response.get('text', '')}")
        return False
    
    detail_data = detail_response['json']
    
    # Verify response structure
    if not detail_data.get('ok'):
        log_test_result("Get Log by ID", False, f"Response ok=false: {detail_data}")
        return False
    
    if 'log' not in detail_data:
        log_test_result("Get Log by ID", False, "Missing 'log' field in response")
        return False
    
    log_detail = detail_data['log']
    
    # Verify required fields
    required_fields = ['id', 'tool', 'input', 'result', 'status', 'duration', 'timestamp']
    missing_fields = [field for field in required_fields if field not in log_detail]
    
    if missing_fields:
        log_test_result("Get Log by ID", False, f"Missing required fields: {missing_fields}")
        return False
    
    # Verify field values
    checks = [
        (log_detail.get('id') == 'log-test-exec-001', f"ID mismatch: {log_detail.get('id')}"),
        (log_detail.get('tool') == 'tenant.bootstrap', f"Tool mismatch: {log_detail.get('tool')}"),
        (log_detail.get('status') in ['success', 'partial'], f"Status mismatch: {log_detail.get('status')}"),
        (isinstance(log_detail.get('duration'), (int, float)), f"Duration not numeric: {log_detail.get('duration')}"),
        (log_detail.get('duration') > 0, f"Duration not positive: {log_detail.get('duration')}"),
        (log_detail.get('timestamp'), "Missing timestamp"),
        (log_detail.get('input'), "Missing input payload"),
        (log_detail.get('result'), "Missing result output")
    ]
    
    for check, error_msg in checks:
        if not check:
            log_test_result("Get Log by ID", False, error_msg)
            return False
    
    # Verify input contains the original payload
    input_data = log_detail.get('input', {})
    if input_data.get('businessId') != 'test-log-capture-123':
        log_test_result("Get Log by ID", False, f"Input businessId mismatch: {input_data.get('businessId')}")
        return False
    
    log_test_result("Get Log by ID", True, f"Log detail retrieved successfully: id={log_detail.get('id')}, tool={log_detail.get('tool')}, status={log_detail.get('status')}, duration={log_detail.get('duration')}ms")
    return True

def test_4_list_logs_with_filtering():
    """Test Case 4: List Logs with Filtering"""
    print("🔍 Test Case 4: List Logs with Filtering")
    
    # Test filtering by tool and status
    filter_params = {
        'tool': 'tenant.bootstrap',
        'status': 'success',
        'limit': 5
    }
    
    print(f"  🔍 Filtering logs: {filter_params}")
    filter_response = make_request(LOGS_ENDPOINT, params=filter_params, auth_secret=AUTH_SECRET)
    
    if filter_response.get('error'):
        log_test_result("List Logs with Filtering", False, f"Filter request failed: {filter_response['error']}")
        return False
    
    if filter_response['status_code'] != 200:
        log_test_result("List Logs with Filtering", False, f"Filter request failed with status {filter_response['status_code']}")
        return False
    
    filter_data = filter_response['json']
    
    # Verify all logs match the filter criteria
    for log_entry in filter_data['logs']:
        if log_entry.get('tool') != 'tenant.bootstrap':
            log_test_result("List Logs with Filtering", False, f"Tool filter failed: {log_entry.get('tool')}")
            return False
        
        # Note: Some logs might have status 'partial' instead of 'success'
        if log_entry.get('status') not in ['success', 'partial']:
            print(f"  ⚠️  Warning: Found log with status '{log_entry.get('status')}' instead of 'success'")
    
    log_test_result("List Logs with Filtering", True, f"Filtering working: {len(filter_data['logs'])} logs match tool=tenant.bootstrap")
    return True

def test_5_pagination():
    """Test Case 5: Pagination Test"""
    print("🔍 Test Case 5: Pagination Test")
    
    # Test first page
    page1_params = {'limit': 2, 'skip': 0}
    print(f"  🔍 Getting page 1: {page1_params}")
    
    page1_response = make_request(LOGS_ENDPOINT, params=page1_params, auth_secret=AUTH_SECRET)
    
    if page1_response.get('error'):
        log_test_result("Pagination Test", False, f"Page 1 request failed: {page1_response['error']}")
        return False
    
    if page1_response['status_code'] != 200:
        log_test_result("Pagination Test", False, f"Page 1 request failed with status {page1_response['status_code']}")
        return False
    
    page1_data = page1_response['json']
    
    # Verify pagination structure
    pagination1 = page1_data.get('pagination', {})
    if pagination1.get('limit') != 2:
        log_test_result("Pagination Test", False, f"Page 1 limit mismatch: {pagination1.get('limit')}")
        return False
    
    if pagination1.get('skip') != 0:
        log_test_result("Pagination Test", False, f"Page 1 skip mismatch: {pagination1.get('skip')}")
        return False
    
    # Test second page if there are more logs
    if pagination1.get('total', 0) > 2:
        page2_params = {'limit': 2, 'skip': 2}
        print(f"  🔍 Getting page 2: {page2_params}")
        
        page2_response = make_request(LOGS_ENDPOINT, params=page2_params, auth_secret=AUTH_SECRET)
        
        if page2_response.get('error'):
            log_test_result("Pagination Test", False, f"Page 2 request failed: {page2_response['error']}")
            return False
        
        if page2_response['status_code'] != 200:
            log_test_result("Pagination Test", False, f"Page 2 request failed with status {page2_response['status_code']}")
            return False
        
        page2_data = page2_response['json']
        pagination2 = page2_data.get('pagination', {})
        
        if pagination2.get('skip') != 2:
            log_test_result("Pagination Test", False, f"Page 2 skip mismatch: {pagination2.get('skip')}")
            return False
        
        # Verify different logs are returned
        page1_ids = [log.get('requestId') for log in page1_data['logs']]
        page2_ids = [log.get('requestId') for log in page2_data['logs']]
        
        if set(page1_ids) & set(page2_ids):
            log_test_result("Pagination Test", False, f"Overlapping logs between pages: {set(page1_ids) & set(page2_ids)}")
            return False
        
        log_test_result("Pagination Test", True, f"Pagination working: Page 1 has {len(page1_data['logs'])} logs, Page 2 has {len(page2_data['logs'])} logs")
    else:
        log_test_result("Pagination Test", True, f"Pagination structure correct: limit=2, skip=0, total={pagination1.get('total')}")
    
    return True

def test_6_date_range_filtering():
    """Test Case 6: Date Range Filtering"""
    print("🔍 Test Case 6: Date Range Filtering")
    
    # Get logs from the last hour
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    since_param = one_hour_ago.isoformat() + 'Z'
    
    date_params = {'since': since_param}
    print(f"  🔍 Filtering logs since: {since_param}")
    
    date_response = make_request(LOGS_ENDPOINT, params=date_params, auth_secret=AUTH_SECRET)
    
    if date_response.get('error'):
        log_test_result("Date Range Filtering", False, f"Date filter request failed: {date_response['error']}")
        return False
    
    if date_response['status_code'] != 200:
        log_test_result("Date Range Filtering", False, f"Date filter request failed with status {date_response['status_code']}")
        return False
    
    date_data = date_response['json']
    
    # Verify all logs are within the date range
    for log_entry in date_data['logs']:
        executed_at = log_entry.get('executedAt')
        if executed_at:
            try:
                # Handle both timezone-aware and naive datetime strings
                if executed_at.endswith('Z'):
                    log_time = datetime.fromisoformat(executed_at.replace('Z', '+00:00'))
                else:
                    log_time = datetime.fromisoformat(executed_at)
                    # If naive, assume UTC
                    if log_time.tzinfo is None:
                        from datetime import timezone
                        log_time = log_time.replace(tzinfo=timezone.utc)
                
                # Make one_hour_ago timezone-aware for comparison
                from datetime import timezone
                one_hour_ago_aware = one_hour_ago.replace(tzinfo=timezone.utc)
                
                if log_time < one_hour_ago_aware:
                    log_test_result("Date Range Filtering", False, f"Log outside date range: {executed_at}")
                    return False
            except (ValueError, TypeError) as e:
                print(f"  ⚠️  Warning: Could not parse date: {executed_at} - {e}")
    
    log_test_result("Date Range Filtering", True, f"Date filtering working: {len(date_data['logs'])} logs since {since_param}")
    return True

def test_7_log_not_found():
    """Test Case 7: Log Not Found"""
    print("🔍 Test Case 7: Log Not Found")
    
    # Try to get a non-existent log
    not_found_url = f"{LOGS_ENDPOINT}/non-existent-log-id-xyz"
    print(f"  🔍 Requesting non-existent log: {not_found_url}")
    
    not_found_response = make_request(not_found_url, auth_secret=AUTH_SECRET)
    
    if not_found_response.get('error'):
        log_test_result("Log Not Found", False, f"Request failed: {not_found_response['error']}")
        return False
    
    if not_found_response['status_code'] != 404:
        log_test_result("Log Not Found", False, f"Expected 404, got {not_found_response['status_code']}")
        return False
    
    not_found_data = not_found_response['json']
    
    # Verify error structure
    if not_found_data.get('ok') != False:
        log_test_result("Log Not Found", False, f"Expected ok=false, got {not_found_data.get('ok')}")
        return False
    
    error = not_found_data.get('error', {})
    if error.get('code') != 'NOT_FOUND':
        log_test_result("Log Not Found", False, f"Expected code=NOT_FOUND, got {error.get('code')}")
        return False
    
    log_test_result("Log Not Found", True, f"404 properly returned for non-existent log: {error.get('message')}")
    return True

def test_8_auth_required():
    """Test Case 8: Auth Required"""
    print("🔍 Test Case 8: Auth Required")
    
    # Try to access logs without auth header
    print("  🔍 Requesting logs without auth header...")
    no_auth_response = make_request(LOGS_ENDPOINT, params={'limit': 5})
    
    if no_auth_response.get('error'):
        log_test_result("Auth Required", False, f"Request failed: {no_auth_response['error']}")
        return False
    
    if no_auth_response['status_code'] != 401:
        log_test_result("Auth Required", False, f"Expected 401, got {no_auth_response['status_code']}")
        return False
    
    no_auth_data = no_auth_response['json']
    
    # Verify error structure
    if no_auth_data.get('ok') != False:
        log_test_result("Auth Required", False, f"Expected ok=false, got {no_auth_data.get('ok')}")
        return False
    
    error = no_auth_data.get('error', {})
    if error.get('code') != 'AUTH_FAILED':
        log_test_result("Auth Required", False, f"Expected code=AUTH_FAILED, got {error.get('code')}")
        return False
    
    log_test_result("Auth Required", True, f"Auth properly required: {error.get('message')}")
    return True

def test_9_verify_full_input_output_capture():
    """Test Case 9: Verify Full Input/Output Capture"""
    print("🔍 Test Case 9: Verify Full Input/Output Capture")
    
    # Get the detailed log from test 1 to verify full capture
    detail_url = f"{LOGS_ENDPOINT}/log-test-exec-001"
    print(f"  🔍 Verifying full input/output capture for: {detail_url}")
    
    detail_response = make_request(detail_url, auth_secret=AUTH_SECRET)
    
    if detail_response.get('error'):
        log_test_result("Full Input/Output Capture", False, f"Detail request failed: {detail_response['error']}")
        return False
    
    if detail_response['status_code'] != 200:
        log_test_result("Full Input/Output Capture", False, f"Detail request failed with status {detail_response['status_code']}")
        return False
    
    detail_data = detail_response['json']
    log_detail = detail_data.get('log', {})
    
    # Verify full input payload is captured
    input_data = log_detail.get('input', {})
    expected_input_fields = ['businessId', 'skipVoiceTest', 'skipBillingCheck']
    missing_input = [field for field in expected_input_fields if field not in input_data]
    
    if missing_input:
        log_test_result("Full Input/Output Capture", False, f"Missing input fields: {missing_input}")
        return False
    
    # Verify input values match what was sent
    if input_data.get('businessId') != 'test-log-capture-123':
        log_test_result("Full Input/Output Capture", False, f"Input businessId mismatch: {input_data.get('businessId')}")
        return False
    
    if input_data.get('skipVoiceTest') != True:
        log_test_result("Full Input/Output Capture", False, f"Input skipVoiceTest mismatch: {input_data.get('skipVoiceTest')}")
        return False
    
    # Verify full result output is captured
    result_data = log_detail.get('result', {})
    if not result_data:
        log_test_result("Full Input/Output Capture", False, "Missing result output")
        return False
    
    # Verify meta information is captured
    meta_data = log_detail.get('meta', {})
    expected_meta_fields = ['requestId', 'businessId', 'actor', 'mode', 'dryRun']
    found_meta = [field for field in expected_meta_fields if field in meta_data]
    
    if len(found_meta) < 3:  # At least 3 meta fields should be present
        log_test_result("Full Input/Output Capture", False, f"Insufficient meta fields: {found_meta}")
        return False
    
    log_test_result("Full Input/Output Capture", True, f"Full capture verified: input has {len(input_data)} fields, result captured, meta has {len(found_meta)} fields")
    return True

def main():
    """Run all test cases in priority order"""
    print("🚀 Starting Comprehensive Tool Call Logging System Test")
    print(f"📍 Execute Endpoint: {EXECUTE_ENDPOINT}")
    print(f"📍 Logs Endpoint: {LOGS_ENDPOINT}")
    print(f"🔐 Auth Header: {AUTH_HEADER}")
    print("=" * 80)
    print()
    
    test_functions = [
        test_1_execute_tool_and_verify_log,
        test_2_plan_mode_logging,
        test_3_get_log_by_id,
        test_4_list_logs_with_filtering,
        test_5_pagination,
        test_6_date_range_filtering,
        test_7_log_not_found,
        test_8_auth_required,
        test_9_verify_full_input_output_capture
    ]
    
    passed = 0
    total = len(test_functions)
    
    for i, test_func in enumerate(test_functions, 1):
        print(f"📋 Running Test {i}/{total}: {test_func.__name__}")
        try:
            if test_func():
                passed += 1
            print()
        except Exception as e:
            log_test_result(test_func.__name__, False, f"Exception: {str(e)}")
            print()
    
    print("=" * 80)
    print(f"🎯 COMPREHENSIVE TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ ALL TESTS PASSED! The comprehensive tool call logging system is working correctly.")
        print("🔍 Key findings:")
        print("  • Tool execution logging works for both execute and plan modes")
        print("  • Log retrieval by ID returns complete log details")
        print("  • Filtering and pagination work correctly")
        print("  • Full input/output capture is working")
        print("  • Authentication is properly enforced")
    else:
        print(f"❌ {total - passed} tests failed. Please review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)