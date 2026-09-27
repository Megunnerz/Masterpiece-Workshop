// netlify/functions/booking-status.js
//
// GET /.netlify/functions/booking-status?booking_id=123
//
// Used by booking-confirmed.html to show the customer whether their
// payment has been confirmed yet (the webhook usually marks it "paid"
// within a second or two of Stripe redirecting them here).
// Only returns non-sensitive fields — no email/phone.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const { booking_id } = event.queryStringParameters || {};
  if (!booking_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing booking_id' }) };
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, session_key, slot, session_date, status, name')
    .eq('id', booking_id)
    .single();

  if (error || !data) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Booking not found' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      status: data.status,
      sessionKey: data.session_key,
      slot: data.slot,
      date: data.session_date,
      name: data.name,
    }),
  };
};
