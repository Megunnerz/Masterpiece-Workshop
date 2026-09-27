// netlify/functions/availability.js
//
// GET /.netlify/functions/availability?sessionKey=mon&slot=main&start=2026-11-01&end=2026-12-31
//
// Returns how many seats are left for every bookable date of that
// session/slot in the given range, so the calendar can show "N left" /
// "Full" without ever exposing anyone's name, email or phone number.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const { sessionKey, slot, start, end } = event.queryStringParameters || {};
  if (!sessionKey || !slot || !start || !end) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query params' }) };
  }

  // Count only seats that are paid, or pending within the last 15 minutes
  // (a stale pending row from someone who abandoned checkout shouldn't
  // permanently hold a seat).
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .select('session_date, status, created_at')
    .eq('session_key', sessionKey)
    .eq('slot', slot)
    .gte('session_date', start)
    .lte('session_date', end);

  if (error) {
    console.error('availability query failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load availability' }) };
  }

  const counts = {};
  for (const row of data) {
    const counted =
      row.status === 'paid' ||
      (row.status === 'pending' && row.created_at > fifteenMinAgo);
    if (!counted) continue;
    counts[row.session_date] = (counts[row.session_date] || 0) + 1;
  }

  const spotsLeft = {};
  for (const [date, taken] of Object.entries(counts)) {
    spotsLeft[date] = Math.max(0, 10 - taken);
  }

  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify({ spotsLeft }), // dates not listed = 10 left (untouched)
  };
};
