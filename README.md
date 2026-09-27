# Masterpiece Workshop — Website + Backend

This is the full site, ready to deploy:

- `public/index.html` — the booking site (same design as before, now
  wired to call a real backend instead of storing bookings in the
  browser).
- `public/booking-confirmed.html` — the page customers land on after
  paying with Stripe.
- `netlify/functions/` — the small serverless backend: creates Stripe
  Checkout sessions, handles Stripe's webhook, checks availability,
  stores contact-form messages, and emails you a notification (via
  Resend) for every paid booking and every contact message. Runs on
  Netlify for free.
- `supabase/schema.sql` — the database schema (run this once in
  Supabase's SQL Editor).
- `SETUP.md` — **start here.** Step-by-step instructions from zero
  accounts to a live site on mymasterpieceworkshop.com.

## Quick start

Open `SETUP.md` and follow it top to bottom — it's written for someone
who hasn't used Supabase, Stripe, or Netlify before.
