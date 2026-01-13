# Plans & Feature Gating

## Overview

Book8 uses Stripe for subscription management with three tiers:

| Plan | Price | Plan Tier |
|------|-------|-----------|
| Starter | $29/month | `starter` |
| Growth | $99/month | `growth` |
| Enterprise | $299/month | `enterprise` |

## Feature Access by Plan

### Free (No Subscription)
- ❌ Calendar integrations
- ❌ Analytics
- ❌ AI phone agent
- ❌ Multi-calendar support
- ❌ Advanced analytics
- ❌ Priority support
- ❌ Team members

### Starter ($29/month)
- ✅ Calendar integrations (Google, Microsoft)
- ✅ Basic analytics
- ✅ AI phone agent
- ❌ Multi-calendar support
- ❌ Advanced analytics
- ❌ Priority support
- ❌ Team members
- Max calendars: 1

### Growth ($99/month)
- ✅ Calendar integrations (Google, Microsoft)
- ✅ Full analytics
- ✅ AI phone agent
- ✅ Multi-calendar support (up to 3)
- ❌ Advanced analytics
- ❌ Priority support
- ❌ Team members
- Max calendars: 3

### Enterprise ($299/month)
- ✅ Calendar integrations (All providers)
- ✅ Full analytics
- ✅ AI phone agent
- ✅ Multi-calendar support (up to 10)
- ✅ Advanced analytics (call logs, metrics)
- ✅ Priority support
- ✅ Team members (coming soon)
- Max calendars: 10

## Implementation

### Backend (`/app/lib/subscription.js`)

```javascript
// Check if user is subscribed
isSubscribed(user) // Returns boolean

// Get plan tier from price ID
getPlanTier(priceId, env) // Returns 'free' | 'starter' | 'growth' | 'enterprise'

// Get features for a plan
getPlanFeatures(tier) // Returns feature object

// Get full subscription details
getSubscriptionDetails(user, env) // Returns complete subscription info
```

### API Endpoint (`GET /api/billing/me`)

Returns:
```json
{
  "ok": true,
  "subscribed": true,
  "planTier": "enterprise",
  "planName": "Enterprise",
  "features": {
    "calendar": true,
    "analytics": true,
    "agent": true,
    "multiCalendar": true,
    "advancedAnalytics": true,
    "prioritySupport": true,
    "teamMembers": true,
    "maxCalendars": 10
  },
  "subscription": { ... }
}
```

### Frontend Gating

The dashboard and feature pages check `features` from `/api/billing/me`:

```javascript
// Check if user can access calendar
if (!features.calendar) {
  router.push('/pricing?paywall=1&feature=calendar');
}

// Check for enterprise features
if (features.advancedAnalytics) {
  // Show advanced analytics section
}
```

## Stripe Webhook Events

The following events update subscription status:

- `checkout.session.completed` - Initial subscription
- `customer.subscription.updated` - Plan changes, renewals
- `customer.subscription.deleted` - Cancellation
- `invoice.paid` - Successful payment
- `invoice.payment_failed` - Failed payment

Webhook endpoint: `POST /api/webhooks/stripe`

## Database Schema

User subscription fields:
```javascript
{
  subscription: {
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none',
    stripeCustomerId: 'cus_xxx',
    stripeSubscriptionId: 'sub_xxx',
    stripePriceId: 'price_xxx',
    stripeCallMinutesItemId: 'si_xxx',
    currentPeriodStart: '2024-01-01T00:00:00Z',
    currentPeriodEnd: '2024-02-01T00:00:00Z'
  }
}
```

## Testing

1. Use Stripe test mode keys
2. Test card: `4242 4242 4242 4242`
3. After checkout, verify:
   - Banner disappears
   - Features unlock
   - `planTier` matches selected plan
4. Cancel in Stripe portal → verify features lock again
