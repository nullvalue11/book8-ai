/**
 * Tests for /api/internal/ops/execute payload format support
 * 
 * Validates that the extractToolArgs function correctly handles:
 * 1. Nested input object: { input: { businessId, name } }
 * 2. Nested args object: { args: { businessId, name } }
 * 3. Flat top-level args: { businessId, name }
 */

const { env } = require('@/lib/env')

const BASE_URL = env.BASE_URL || 'http://localhost:3000'
const API_SECRET = env.OPS_INTERNAL_SECRET || env.ADMIN_TOKEN

const basePayload = {
  tool: 'tenant.ensure',
  requestId: `test-payload-${Date.now()}`,
  dryRun: true
}

const expectedArgs = {
  businessId: 'test-coach-business',
  name: 'Test Coach Business'
}

async function testPayloadFormat(payloadType, payload) {
  console.log(`\nTesting ${payloadType} format...`)
  
  const response = await fetch(`${BASE_URL}/api/internal/ops/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-internal-secret': API_SECRET
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json()
  
  if (!response.ok) {
    console.error(`❌ ${payloadType} FAILED:`, data.error)
    return false
  }
  
  if (data.ok) {
    console.log(`✅ ${payloadType} SUCCESS`)
    return true
  } else {
    console.error(`❌ ${payloadType} FAILED:`, data.error)
    return false
  }
}

async function runTests() {
  console.log('Testing ops/execute API payload formats...\n')
  
  // Test 1: Nested input object (n8n format)
  const test1 = await testPayloadFormat(
    'Nested input object',
    {
      ...basePayload,
      requestId: `test-input-${Date.now()}`,
      input: expectedArgs
    }
  )
  
  // Test 2: Nested args object
  const test2 = await testPayloadFormat(
    'Nested args object',
    {
      ...basePayload,
      requestId: `test-args-${Date.now()}`,
      args: expectedArgs
    }
  )
  
  // Test 3: Flat top-level args
  const test3 = await testPayloadFormat(
    'Flat top-level args',
    {
      ...basePayload,
      requestId: `test-flat-${Date.now()}`,
      ...expectedArgs
    }
  )
  
  console.log('\n' + '='.repeat(50))
  console.log('Test Results:')
  console.log(`  Nested input: ${test1 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Nested args:  ${test2 ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Flat args:    ${test3 ? '✅ PASS' : '❌ FAIL'}`)
  console.log('='.repeat(50))
  
  if (test1 && test2 && test3) {
    console.log('\n🎉 All payload formats work correctly!')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed')
    process.exit(1)
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Test execution failed:', err)
    process.exit(1)
  })
}

module.exports = { runTests }
