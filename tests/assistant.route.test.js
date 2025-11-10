import { POST } from '@/api/assistant/route'

// Mock env to enable assistant and base URL
jest.mock('@/lib/env', () => ({ env: { BASE_URL: 'http://localhost:3000', FEATURES: { ASSISTANT: true } } }))
jest.mock('@/lib/telemetry', () => ({ logTelemetry: jest.fn() }))

// Stub fetch to return fake availability
beforeAll(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      hostTimeZone: 'UTC',
      slots: [
        { start: new Date(Date.now() + 24*60*60*1000).toISOString(), end: new Date(Date.now() + 25*60*60*1000).toISOString() }
      ]
    })
  }))
})

afterAll(() => {
  global.fetch.mockRestore?.()
})

function mkHeaders(extra = {}) {
  return new Headers({ 'x-client-timezone': 'UTC', 'x-assistant-handle': 'tester', ...extra })
}

describe('/api/assistant normalization', () => {
  test('accepts text/plain body', async () => {
    const req = new Request('http://localhost/api/assistant', {
      method: 'POST',
      headers: mkHeaders({ 'Content-Type': 'text/plain' }),
      body: '30m tomorrow afternoon'
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.intent).toBe('find_slots')
    expect(Array.isArray(data.slots)).toBe(true)
  })

  test('accepts JSON {query}', async () => {
    const req = new Request('http://localhost/api/assistant', {
      method: 'POST',
      headers: mkHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query: '30m tomorrow afternoon' })
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.intent).toBe('find_slots')
    expect(Array.isArray(data.slots)).toBe(true)
  })
})
