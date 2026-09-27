// netlify/functions/stripe-webhook.js
//
// Stripe calls this URL directly (not the browser) whenever something
// happens to a Checkout Session. We listen for two events:
//   - checkout.session.completed  -> mark the booking "paid", email you
//   - checkout.session.expired    -> mark the booking "expired" (frees the seat)
//
// This is the only place a booking is ever marked "paid" — never trust a
// success_url redirect alone, since a customer could in theory land on it
// without actually paying.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendNotification } = require('./lib/notify');

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
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'paid' })
      .eq('stripe_session_id', session.id)
      .select('name, age, email, phone, session_key, slot, session_date, amount_cents')
      .single();

    if (error) {
      console.error('failed to mark booking paid', error);
    } else if (data) {
      const amount = (data.amount_cents / 100).toFixed(2);
      await sendNotification({
        subject: `New paid booking: ${data.name} — ${SESSION_LABELS[data.session_key] || data.session_key}`,
        html: `
          <h2>New paid booking 🎉</h2>
          <p><strong>${data.name}</strong> (age ${data.age ?? '—'}) is booked for:</p>
          <p>${SESSION_LABELS[data.session_key] || data.session_key}<br>
             ${data.session_date} · ${SLOT_LABELS[data.slot] || data.slot}</p>
          <p><strong>Paid:</strong> $${amount}</p>
          <p><strong>Parent email:</strong> ${data.email}<br>
             <strong>Phone:</strong> ${data.phone || '—'}</p>
        `,
      });
    }
  }

  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object;
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'expired' })
      .eq('stripe_session_id', session.id);
    if (error) console.error('failed to mark booking expired', error);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
