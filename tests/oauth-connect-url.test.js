const {
  buildGoogleConnectUrl,
  GOOGLE_OAUTH_USER_CONNECT_PURPOSE,
  validateGoogleAuthEntryQuery
} = require('../app/lib/oauth-connect-url.js')

describe('oauth-connect-url (BOO-112B)', () => {
  test('buildGoogleConnectUrl requires jwt', () => {
    expect(() => buildGoogleConnectUrl({})).toThrow(/jwt required/)
  })

  test('buildGoogleConnectUrl includes businessId and returnTo', () => {
    const u = buildGoogleConnectUrl({
      jwt: 'tok',
      businessId: 'biz_x',
      returnTo: 'https://example.com/done'
    })
    expect(u).toContain('/api/integrations/google/auth?')
    expect(u).toContain('jwt=tok')
    expect(u).toContain('businessId=biz_x')
    expect(u).toContain(encodeURIComponent('https://example.com/done'))
  })

  test('buildGoogleConnectUrl adds purpose=user_connect', () => {
    const u = buildGoogleConnectUrl({
      jwt: 'tok',
      purpose: GOOGLE_OAUTH_USER_CONNECT_PURPOSE
    })
    expect(u).toContain(`purpose=${GOOGLE_OAUTH_USER_CONNECT_PURPOSE}`)
    expect(u).not.toContain('businessId=')
  })

  test('validateGoogleAuthEntryQuery allows businessId', () => {
    expect(validateGoogleAuthEntryQuery({ businessId: 'biz_a', purpose: null })).toEqual({ allowed: true })
    expect(validateGoogleAuthEntryQuery({ businessId: '  biz_b  ', purpose: null })).toEqual({ allowed: true })
  })

  test('validateGoogleAuthEntryQuery allows purpose=user_connect without businessId', () => {
    expect(
      validateGoogleAuthEntryQuery({ businessId: null, purpose: GOOGLE_OAUTH_USER_CONNECT_PURPOSE })
    ).toEqual({ allowed: true })
  })

  test('validateGoogleAuthEntryQuery rejects missing businessId and wrong purpose', () => {
    const r = validateGoogleAuthEntryQuery({ businessId: '', purpose: null })
    expect(r.allowed).toBe(false)
    expect(r.body.code).toBe('BUSINESS_ID_OR_PURPOSE_REQUIRED')
  })
})
