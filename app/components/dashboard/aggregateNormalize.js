/**
 * Normalize BOO-67A aggregate payloads — tolerant of field naming differences.
 */

export function normalizeAggregateStats(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      totalBookings: 0,
      totalCalls: 0,
      noShowRate: null,
      activeLocations: 0,
      locationRows: []
    }
  }
  const loc =
    raw.locations ||
    raw.byLocation ||
    raw.businesses ||
    raw.items ||
    []

  const pct = (v) => {
    if (v == null) return null
    const n = Number(v)
    if (Number.isNaN(n)) return null
    return n <= 1 ? n * 100 : n
  }

  // book8-core-api GET /aggregate/stats returns totalBookingsThisMonth / totalCallsThisMonth (BOO-67A)
  return {
    totalBookings:
      Number(
        raw.totalBookingsThisMonth ??
          raw.totalBookings ??
          raw.bookings ??
          raw.bookingsThisMonth ??
          0
      ) || 0,
    totalCalls:
      Number(
        raw.totalCallsThisMonth ?? raw.totalCalls ?? raw.calls ?? raw.callsThisMonth ?? 0
      ) || 0,
    noShowRate: pct(raw.noShowRate ?? raw.no_show_rate ?? raw.avgNoShowRate),
    activeLocations:
      Number(raw.activeLocations ?? raw.totalBusinesses ?? raw.locationsCount ?? loc.length ?? 0) ||
      0,
    locationRows: Array.isArray(loc) ? loc.map(normalizeLocationRow) : []
  }
}

function normalizeLocationRow(row) {
  if (!row || typeof row !== 'object') return {}
  return {
    businessId: row.businessId || row.id || row.business_id,
    name: row.name || row.businessName || 'Location',
    address: row.address || row.formattedAddress || row.city || '',
    bookingsToday: Number(row.bookingsToday ?? row.todayBookings ?? 0) || 0,
    callsToday: Number(row.callsToday ?? row.todayCalls ?? 0) || 0,
    noShowRate:
      row.noShowRate != null
        ? Number(row.noShowRate) <= 1
          ? Number(row.noShowRate) * 100
          : Number(row.noShowRate)
        : null
  }
}

function asList(payload, keys) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const k of keys) {
    if (Array.isArray(payload[k])) return payload[k]
  }
  return []
}

export function mergeActivityItems(bookingsPayload, callsPayload) {
  const out = []

  const bookingList = asList(bookingsPayload, ['items', 'bookings', 'data', 'results'])

  const callList = asList(callsPayload, ['items', 'calls', 'data', 'results'])

  for (const b of bookingList) {
    const ts = b.createdAt || b.updatedAt || b.slot?.start || b.startTime
    out.push({
      kind: 'booking',
      ts: ts ? new Date(ts).getTime() : 0,
      title: b.serviceName || b.serviceId || 'Booking',
      status: b.status || b.state,
      locationName: b.locationName || b.businessName || b.businessId || '',
      raw: b
    })
  }

  for (const c of callList) {
    const ts = c.startTime || c.createdAt
    out.push({
      kind: 'call',
      ts: ts ? new Date(ts).getTime() : 0,
      title: c.elevenLabs?.transcriptSummary || c.summary || 'Call',
      status: c.status,
      locationName: c.locationName || c.businessName || c.businessId || '',
      raw: c
    })
  }

  out.sort((a, b) => b.ts - a.ts)
  return out.slice(0, 10)
}

export function normalizeAnalyticsChartData(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      bookingsTrend: [],
      topServices: [],
      languages: [],
      locationComparison: []
    }
  }

  const trend =
    raw.bookingsTrend ||
    raw.trend ||
    raw.series ||
    raw.dailyBookings ||
    []

  const topServices = raw.topServices || raw.services || raw.serviceBreakdown || []

  const langs = raw.languageDistribution || raw.languages || raw.languageBreakdown || []

  const locCmp = raw.locationComparison || raw.bookingsByLocation || raw.locations || []

  const bookingsTrend = Array.isArray(trend)
    ? trend.map((row) => {
        if (!row || typeof row !== 'object') return { date: '', total: 0 }
        const date = row.date || row.day || row.label || ''
        const total = Number(row.total ?? row.count ?? row.bookings ?? 0) || 0
        const rest = { ...row }
        delete rest.date
        delete rest.day
        delete rest.label
        delete rest.total
        delete rest.count
        delete rest.bookings
        return { date: String(date), total, ...rest }
      })
    : []

  const topServicesNorm = Array.isArray(topServices)
    ? topServices.map((row) => ({
        name: String(row.name || row.serviceName || row.serviceId || 'Service'),
        count: Number(row.count ?? row.bookings ?? 0) || 0
      }))
    : []

  const languagesNorm = Array.isArray(langs)
    ? langs.map((row) => ({
        name: String(row.language || row.name || row.code || '—'),
        value: Number(row.count ?? row.value ?? row.percent ?? 0) || 0
      }))
    : []

  const locationComparisonNorm = Array.isArray(locCmp)
    ? locCmp.map((row) => ({
        name: String(row.name || row.businessName || row.businessId || '—'),
        bookings: Number(row.bookings ?? row.count ?? 0) || 0
      }))
    : []

  return {
    bookingsTrend,
    topServices: topServicesNorm,
    languages: languagesNorm,
    locationComparison: locationComparisonNorm
  }
}
