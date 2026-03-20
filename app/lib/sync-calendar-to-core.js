/**
 * Syncs calendar connection status to core-api's business record.
 * Called after Google or Outlook calendar connect/disconnect.
 */

export async function syncCalendarToCore({ businessId, provider, connected }) {
  const CORE_API_URL = process.env.BOOK8_CORE_API_URL || "https://book8-core-api.onrender.com";
  const secret = process.env.CORE_API_INTERNAL_SECRET || process.env.OPS_INTERNAL_SECRET;

  if (!businessId || typeof businessId !== "string") {
    console.warn("[sync-calendar-to-core] Missing/invalid businessId — skipping sync");
    return;
  }

  if (!secret) {
    console.warn("[sync-calendar-to-core] No internal secret configured — skipping sync");
    return;
  }

  try {
    const response = await fetch(`${CORE_API_URL}/internal/business/update-calendar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Some core-api implementations use x-book8-internal-secret; keep compatibility.
        "x-internal-secret": secret,
        "x-book8-internal-secret": secret
      },
      body: JSON.stringify({
        businessId,
        calendarProvider: connected ? provider : null, // "google" | "microsoft" | null
        calendarConnected: connected
      })
    });

    if (!response.ok) {
      console.warn("[sync-calendar-to-core] Core-api returned:", response.status);
    } else {
      console.log("[sync-calendar-to-core] Synced to core-api:", { businessId, provider, connected });
    }
  } catch (err) {
    // Fire-and-forget — never crash the connect flow
    console.warn("[sync-calendar-to-core] Failed to sync:", err.message);
  }
}

