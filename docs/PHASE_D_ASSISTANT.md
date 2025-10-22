# Phase D — Assistant MVP

Branch: feat/ai-booking-assistant

Deliverables:
- Page /b/[handle]/assistant — chat UI with bubbles, input, quick chips
- API POST /api/assistant — intents: find_slots, book, clarify
- Rule-based parser in lib/assistantParser.js
- Uses existing availability and book endpoints
- Dual-TZ slot cards; Book button → inline confirmation modal (name, email, title)
- Feature flags: FEATURE_ASSISTANT (default false), FEATURE_ASSISTANT_LLM (default false)
- Rate limit: 20 req / 5m per IP+handle
- Telemetry event: assistant_turn (mask emails)
- Tests: parser unit tests + mock integration path (UI triggers booking via public API)

QA Script:
1. Navigate to /b/[handle]/assistant
2. Type "30m tomorrow afternoon" — expect suggested slots in guest timezone, host label secondary
3. Click a slot → modal opens; enter name+email → Book
4. Verify confirmation message and calendar invite emails (if email is enabled)
5. Try repeated requests >20 within 5 minutes — expect 429
6. Toggle FEATURE_ASSISTANT=false — API returns 404; page shows disabled notice (optional)

Notes:
- LLM fallback (FEATURE_ASSISTANT_LLM=true) will be wired later.
- Server-side internal API calls use env.BASE_URL; no hardcoded URLs.
