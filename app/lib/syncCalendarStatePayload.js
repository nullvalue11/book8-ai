/**
 * BOO-117B — Request body for POST /internal/business/sync-calendar-state (book8-core-api).
 * Kept env-free so unit tests can import without loading `env.js`.
 */

export function buildSyncCalendarStatePayload({
  businessId,
  connected,
  provider,
  connectedAt,
  calendarId,
  lastSyncedAt
}) {
  return {
    businessId,
    calendar: {
      connected: Boolean(connected),
      provider: provider || null,
      connectedAt: connectedAt ?? null,
      calendarId: calendarId ?? null,
      lastSyncedAt: lastSyncedAt ?? null
    },
    calendarProvider: provider || null
  }
}
