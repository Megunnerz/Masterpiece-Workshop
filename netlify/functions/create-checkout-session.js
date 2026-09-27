// netlify/functions/create-checkout-session.js
//
// Called by the frontend when the customer clicks a "Pay" button.
// 1. Claims a seat in Supabase (fails cleanly if the session is full).
// 2. Creates a Stripe Checkout Session for $50.
// 3. Returns the Checkout URL for the browser to redirect to.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_LABELS = {
  mon: 'Monday Night Build',
  fri: 'Friday Night Build',
  sat: 'Saturday Workshop',
};
const SLOT_LABELS = {
  main: '6:00–8:00pm',
  am: '9:00–11:00am',
  pm: '4:00–6:00pm',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const { sessionKey, slot, date, name, age, email, phone } = body;

  if (!sessionKey || !slot || !date || !name || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }
  if (!SESSION_LABELS[sessionKey]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown session' }) };
  }

  // Reject anything outside the bookable window / closed dates server-side
  // too — the frontend already prevents this, but never trust the client.
  const d = new Date(date + 'T00:00:00Z');
  const BOOKABLE_START = new Date('2026-11-01T00:00:00Z');
  const BOOKABLE_END = new Date('2026-12-31T23:59:59Z');
  const CLOSED_DATES = new Set(['2026-12-25', '2026-12-26']);
  if (d < BOOKABLE_START || d > BOOKABLE_END || CLOSED_DATES.has(date)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'That date is not bookable' }) };
  }

  // 1. Claim a seat (atomic — safe against two people booking at once)
  const { data: claimRows, error: claimError } = await supabase.rpc('claim_slot', {
    p_session_key: sessionKey,
    p_slot: slot,
    p_date: date,
    p_name: name,
    p_age: age || null,
    p_email: email,
    p_phone: phone || null,
  });

  if (claimError) {
    console.error('claim_slot error', claimError);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not reserve a seat, try again' }) };
  }
  if (!claimRows || claimRows.length === 0) {
    return { statusCode: 409, body: JSON.stringify({ error: 'That session is full' }) };
  }

  const bookingId = claimRows[0].booking_id;
  const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

  // 2. Create the Stripe Checkout Session
  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 5000, // $50.00
            product_data: {
              name: `Masterpiece Workshop — ${SESSION_LABELS[sessionKey]}`,
              description: `${date} · ${SLOT_LABELS[slot]}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/booking-confirmed.html?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#classes`,
      metadata: { booking_id: String(bookingId), sessionKey, slot, date },
    });
  } catch (e) {
    console.error('stripe error', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Payment setup failed, try again' }) };
  }

  // 3. Attach the Stripe session id to the booking row
  await supabase
    .from('bookings')
    .update({ stripe_session_id: checkoutSession.id })
    .eq('id', bookingId);

  return {
    statusCode: 200,
    body: JSON.stringify({ url: checkoutSession.url }),
  };
};
