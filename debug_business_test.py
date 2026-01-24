#!/usr/bin/env python3
"""
Debug Business Registration - Check what's happening with Stripe checkout
"""

import requests
import json
import os
import uuid

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://oauth-fix-10.preview.emergentagent.com')

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request with detailed logging"""
    url = f"{BASE_URL}{endpoint}"
    
    default_headers = {'Content-Type': 'application/json'}
    if headers:
        default_headers.update(headers)
        
    try:
        if method.upper() == 'POST':
            response = requests.post(url, json=data, headers=default_headers, timeout=30)
        elif method.upper() == 'GET':
            response = requests.get(url, headers=default_headers, timeout=30)
        
        # Parse JSON response
        try:
            response_data = response.json()
        except:
            response_data = {'raw_response': response.text}
        
        print(f"{method} {endpoint} -> {response.status_code}")
        print(f"Response: {json.dumps(response_data, indent=2)}")
        
        return {
            'success': response.status_code < 400,
            'status_code': response.status_code,
            'data': response_data
        }
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return {'success': False, 'error': str(e)}

def debug_business_flow():
    print("🔍 Debugging Business Registration Flow")
    print("=" * 50)
    
    # 1. Register user
    unique_id = str(uuid.uuid4())[:8]
    user_email = f"debug-business-{unique_id}@example.com"
    
    register_data = {
        "email": user_email,
        "password": "TestPassword123!",
        "name": f"Debug User {unique_id}"
    }
    
    print("\n1. Registering user...")
    result = make_request('POST', '/api/auth/register', register_data)
    
    if not result['success'] or not result['data'].get('token'):
        print("❌ User registration failed")
        return
    
    jwt_token = result['data']['token']
    headers = {'Authorization': f'Bearer {jwt_token}'}
    
    # 2. Register business
    print("\n2. Registering business...")
    business_data = {
        "name": "Debug Test Business",
        "skipVoiceTest": True,
        "skipBillingCheck": True
    }
    
    result = make_request('POST', '/api/business/register', business_data, headers)
    
    if not result['success'] or not result['data'].get('businessId'):
        print("❌ Business registration failed")
        return
    
    business_id = result['data']['businessId']
    print(f"✅ Business created: {business_id}")
    
    # 3. Get business status
    print(f"\n3. Getting business status for {business_id}...")
    result = make_request('GET', f'/api/business/{business_id}', headers=headers)
    
    # 4. Try Stripe checkout
    print(f"\n4. Testing Stripe checkout for {business_id}...")
    result = make_request('POST', f'/api/business/{business_id}/billing/checkout', {}, headers)
    
    print(f"\n✅ Debug complete for user: {user_email}")

if __name__ == "__main__":
    debug_business_flow()