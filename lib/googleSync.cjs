function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime(); const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime(); const be = new Date(bEnd).getTime();
  return as < be && bs < ae
}

function buildGoogleEventFromBooking(b) {
  const descriptionParts = []
  if (b.customerName) descriptionParts.push(`Customer: ${b.customerName}`)
  if (b.notes) descriptionParts.push(b.notes)
  const description = descriptionParts.join('\n')
  return {
    summary: b.title || 'Booking',
    description,
    start: { dateTime: new Date(b.startTime).toISOString(), timeZone: 'UTC' },
    end: { dateTime: new Date(b.endTime).toISOString(), timeZone: 'UTC' },
    extendedProperties: { private: { book8BookingId: b.id } },
  }
}

function mergeBook8WithGoogle(book8, googleEvents, mappingsByGoogleId) {
  const mappedGoogleIds = new Set(Object.keys(mappingsByGoogleId || {}))
  const merged = [...book8]
  for (const e of googleEvents || []) {
    if (!e) continue
    if (mappedGoogleIds.has(e.id)) continue
    const start = e.start?.dateTime || e.start?.date
    const end = e.end?.dateTime || e.end?.date
    if (!start || !end) continue
    const conflict = book8.some(b => overlaps(b.startTime, b.endTime, start, end))
    merged.push({
      id: `google:${e.id}`,
      userId: e.userId || '',
      title: e.summary || '(busy)',
      customerName: '',
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      status: 'external',
      notes: e.description || '',
      source: 'google',
      conflict,
      htmlLink: e.htmlLink || null,
    })
  }
  merged.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
  return merged
}

module.exports = { overlaps, buildGoogleEventFromBooking, mergeBook8WithGoogle }