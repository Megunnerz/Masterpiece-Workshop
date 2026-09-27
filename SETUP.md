# Masterpiece Workshop — Backend Setup Guide

This turns your booking page from a demo into a real site that takes real
payments and enforces a real, shared 10-spot cap per session. You're
starting from zero, so this guide assumes no existing accounts.

**Time estimate:** 45–75 minutes, mostly waiting on account verification emails.

---

## What you're setting up, and why

| Piece | What it does | You'll use |
|---|---|---|
| Database | Tracks who's booked which seat, so the cap is real and shared by everyone, not just one browser | **Supabase** (free tier) |
| Payments | Actually charges the $50 and confirms it before a seat is finalized | **Stripe** (pay-as-you-go, no monthly fee) |
| Hosting | Runs the site itself, plus the small bits of backend code ("functions") that talk to Stripe and Supabase | **Netlify** (free tier) |
| Email notifications | Emails **info@mymasterpieceworkshop.com** every time someone books and pays, or sends a contact message | **Resend** (free tier) |
| Domain | Points mymasterpieceworkshop.com at your new Netlify site | Wherever you bought the domain |

None of these cost anything to set up. Stripe takes a small percentage
per transaction (2.9% + $0.30 is typical in the US) — that's it.

---

## Step 1 — Create a Supabase project (the database)

1. Go to **supabase.com** → Sign up (GitHub or email) → **New project**.
2. Name it `masterpiece-workshop`, set a database password (save it
   somewhere — you likely won't need it again, but keep it just in case),
   pick the region closest to you, and click **Create new project**.
   Wait ~2 minutes for it to spin up.
3. In the left sidebar, open **SQL Editor** → **New query**.
4. Open `supabase/schema.sql` from this project folder, copy its entire
   contents, paste into the SQL Editor, and click **Run**. This creates
   the `bookings` and `contact_messages` tables and the seat-claiming
   logic. You should see "Success. No rows returned."
5. In the left sidebar, open **Project Settings → API**. You'll need two
   values from this page in Step 3:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **service_role key** (under "Project API keys" — click "Reveal".
     **This key is secret** — it bypasses all the safety rules, so it only
     ever goes into Netlify's environment variables, never into the
     website's own code.)

---

## Step 2 — Create a Stripe account (payments)

1. Go to **stripe.com** → Sign up.
2. You can start in **test mode** immediately (a toggle in the top-right
   of the dashboard) — this lets you run through the whole flow with fake
   card numbers before any real money is involved. Switch to **live
   mode** only once you've tested everything end to end (Step 7 covers
   activating your account for live payments, which asks for your
   business/bank details).
3. Go to **Developers → API keys**. You'll need the **Secret key**
   (starts with `sk_test_...` in test mode, `sk_live_...` once you go
   live) for Step 4.
4. Leave this tab open — you'll come back after your site is deployed to
   set up the webhook (Step 6).

---

## Step 3 — Create a Resend account (email notifications)

This is what emails **info@mymasterpieceworkshop.com** every time someone
books and pays, or sends a contact message.

1. Go to **resend.com** → Sign up.
2. Go to **API Keys → Create API Key**. Name it anything (e.g.
   "masterpiece-workshop"), leave permissions as default (full access),
   and copy the key (starts with `re_...`) for Step 4 — Resend only shows
   it once.
3. That's it for now. Resend's shared sending address
   (`onboarding@resend.dev`) works immediately with no further setup, so
   notification emails will start working as soon as you set the
   environment variables in the next step. (Optional upgrade, once
   everything else is working: verify mymasterpieceworkshop.com in Resend
   under **Domains** so notification emails come from your own domain
   instead of resend.dev — Resend walks you through adding a couple of
   DNS records for this, same place you'll add Netlify's records in
   Step 8.)

---

## Step 4 — Deploy to Netlify

1. Go to **netlify.com** → Sign up.
2. Easiest path: put this project folder in a GitHub repository
   (create a new repo, push these files), then in Netlify click **Add
   new site → Import an existing project → Deploy with GitHub**, and
   pick the repo.
   - Alternative with no GitHub: in Netlify, click **Add new site → Deploy
     manually**, and drag the whole project folder in. (You'll need to
     redeploy this way each time you change a file, so GitHub is worth
     the extra 5 minutes if you plan to keep tweaking the site.)
3. Netlify should auto-detect the settings from `netlify.toml`
   (publish directory `public`, functions directory `netlify/functions`).
   Click **Deploy site**.
4. Once deployed, go to **Site configuration → Environment variables**
   and add each of these (values from Steps 1–3):

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `STRIPE_SECRET_KEY` | your Stripe Secret key |
   | `STRIPE_WEBHOOK_SECRET` | *(leave blank for now — Step 6)* |
   | `RESEND_API_KEY` | your Resend API key |
   | `NOTIFY_EMAIL` | `info@mymasterpieceworkshop.com` |
   | `SITE_URL` | your Netlify site's URL for now, e.g. `https://masterpiece-workshop.netlify.app` (update this to `https://mymasterpieceworkshop.com` once Step 8 is done) |

5. Go to **Deploys** and click **Trigger deploy → Deploy site** so the
   new environment variables take effect.

---

## Step 5 — Test it before connecting your real domain

1. Open your `https://[your-site].netlify.app` URL.
2. Pick a session, pick a date, fill in the booking form, click **Pay $50
   & reserve my spot**. You should land on Stripe's real Checkout page.
3. Since Stripe is still in **test mode**, use a test card:
   **4242 4242 4242 4242**, any future expiry date, any 3-digit CVC, any
   ZIP.
4. After paying, you should land on `booking-confirmed.html` and see it
   flip from "Confirming…" to "You're booked!" within a couple of
   seconds — **but this last part needs Step 6 first**, or it'll stay on
   "Still confirming" forever (the webhook is what marks it paid, and
   sends the notification email).

---

## Step 6 — Connect the Stripe webhook

This is the step that actually marks a booking "paid" once Stripe
confirms the charge, and triggers your notification email.

1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://[your-site].netlify.app/.netlify/functions/stripe-webhook`
   (use your real domain here once Step 8 is done instead).
3. Click **Select events**, and add:
   - `checkout.session.completed`
   - `checkout.session.expired`
4. Click **Add endpoint**. Click into the new endpoint and reveal the
   **Signing secret** (starts with `whsec_...`).
5. Back in Netlify → Environment variables, set `STRIPE_WEBHOOK_SECRET`
   to that value, then **Trigger deploy** again.
6. Repeat the Step 5 test — this time it should flip to "You're booked!"
   automatically, and info@mymasterpieceworkshop.com should get an email
   within a few seconds.
7. In Supabase, open **Table Editor → bookings** — you should see your
   test booking with `status = paid`.
8. Also test the contact form on the site — submitting it should email
   info@mymasterpieceworkshop.com too.

---

## Step 7 — Go live (real money)

1. In Stripe, finish **Activate your account** (business details, bank
   account for payouts) — this is Stripe's own onboarding, found under
   the "Activate account" banner or Settings.
2. Toggle Stripe to **Live mode** (top right).
3. Get your **live** Secret key from Developers → API keys, and repeat
   Step 6's webhook setup in live mode too (test-mode and live-mode
   webhooks are separate).
4. In Netlify, update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to
   the live values, then **Trigger deploy**.
5. Do one real $50 test booking yourself with a real card to confirm
   everything works, then refund it from the Stripe dashboard if you
   don't want to keep it.

---

## Step 8 — Point mymasterpieceworkshop.com at the site

1. In Netlify: **Site configuration → Domain management → Add a domain**,
   enter `mymasterpieceworkshop.com`.
2. Netlify shows you DNS records to add (usually an A record or ALIAS/CNAME
   for the root domain, plus a CNAME for `www`).
3. Go to wherever you registered the domain (GoDaddy, Namecheap, Google
   Domains, etc.), find **DNS settings**, and add the records Netlify
   showed you.
4. This can take anywhere from a few minutes to a few hours to take
   effect. Netlify auto-issues a free SSL certificate once it verifies
   the domain, so the site will load as `https://mymasterpieceworkshop.com`.
5. Update the `SITE_URL` environment variable in Netlify to
   `https://mymasterpieceworkshop.com` and redeploy, so Stripe's
   redirect links point to your real domain.
6. Update the Stripe webhook URL (Step 6) to use the real domain too.

---

## Ongoing: viewing bookings and messages

- **Email**: info@mymasterpieceworkshop.com gets an email for every paid
  booking and every contact-form message, automatically — nothing further
  to do.
- **Bookings**: Supabase → Table Editor → `bookings` is still there as
  the full record if you ever need to look something up (filter by
  `status = paid` for confirmed ones).
- **Contact messages**: Supabase → Table Editor → `contact_messages`.

## Nice-to-haves you can add later

- **Apple Pay / Google Pay / PayPal on Stripe Checkout**: enable them in
  Stripe Dashboard → Settings → Payment methods — no code changes needed,
  they'll just appear as options on the Checkout page once you widen
  `payment_method_types` in `create-checkout-session.js` (or remove that
  line entirely to let Stripe show whatever's enabled).
- **Your own domain as the "from" address**: once you verify
  mymasterpieceworkshop.com in Resend (Step 3), set the
  `NOTIFY_FROM_EMAIL` environment variable (see `.env.example`) so
  notification emails come from your own domain instead of resend.dev.
- **Admin view**: a simple password-protected page listing upcoming
  bookings, so you don't have to open Supabase — happy to build this if
  useful.
