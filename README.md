# Book8 AI — MVP

A modern, modular scheduling and AI integration service.

This repository contains the Next.js (App Router) app with MongoDB and a single catch‑all API route. It supports JWT auth, bookings CRUD, and stubs for Google Calendar, OpenAI Realtime Audio, Tavily, Stripe billing, and n8n. Stripe subscriptions (test mode) are implemented with webhooks.

## Quick Links
- App entry: `/` (dashboard)
- Legacy shim: `/account` (redirect info + link to dashboard)
- API root: `/api`

## Environment
Required environment variables (set these in Vercel Project → Settings → Environment Variables):

- `MONGO_URL`
- `DB_NAME`
- `NEXT_PUBLIC_BASE_URL` (e.g. `https://book8-ai.vercel.app`) — used to build absolute success/cancel/return URLs
- `CORS_ORIGINS` (optional, defaults to `*` for MVP)

Stripe (test mode):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_ENTERPRISE`

## Stripe return URLs (environment‑aware)
We centralize base URL resolution in `lib/baseUrl.js`. API routes call this helper using the `Host` header so that return URLs work in production and preview environments.

- Checkout success: `${base}/?success=true&session_id={CHECKOUT_SESSION_ID}`
- Checkout cancel: `${base}/?canceled=true`
- Customer portal return: `${base}/?portal_return=true`

The dashboard shows a small banner when any of these query flags are present.

## Webhook
`POST /api/billing/stripe/webhook` uses `request.text()` to verify the Stripe signature with `STRIPE_WEBHOOK_SECRET` and updates the user’s `subscription` object.

Events handled:
- `checkout.session.completed`
- `customer.subscription.updated`
- `invoice.payment_succeeded`
- `customer.subscription.deleted`

## Dev Notes
- All API routes must be called with `/api` prefix (K8s ingress rule).
- MongoDB responses avoid ObjectId by using UUIDs.
- JWT auth via `jsonwebtoken`, passwords with `bcryptjs`.

## Trigger a Vercel build
This repo is designed for Git‑based deploys. Push any change (like this README) to your connected branch to trigger a new deployment.

Example commands:
```
# from the repository root
git add -A
# sign commit if configured (SSH signing recommended)
git commit -S -m "docs: add README and deployment notes"
git push origin main
```

If using a Deploy Hook instead, create a hook for the production branch and `POST` to it. The hook will redeploy the latest commit from Git.

## Roadmap
- Google Calendar OAuth + sync
- Tavily live search integration
- OpenAI Realtime Audio call flows
- n8n workflow templates
- Analytics dashboard (Phase 2)
