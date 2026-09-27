// netlify/functions/_notify.js
//
// Small shared helper for sending you an email notification via Resend.
// Used by stripe-webhook.js (new paid booking) and contact.js (new
// message). Never throws — a notification failure should never break the
// booking or the contact form itself, so callers just fire-and-forget
// (or await + ignore errors) this.

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared sending domain works immediately with zero setup.
// Once you verify mymasterpieceworkshop.com in Resend (see SETUP.md),
// switch FROM_EMAIL to something like "bookings@mymasterpieceworkshop.com".
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || 'Masterpiece Workshop <onboarding@resend.dev>';

async function sendNotification({ subject, html }) {
  const to = process.env.NOTIFY_EMAIL;
  if (!resend || !to) {
    console.warn('Email notifications not configured (missing RESEND_API_KEY or NOTIFY_EMAIL) — skipping.');
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } catch (e) {
    // Logged only — a failed notification email should never fail the
    // booking or contact-form request that triggered it.
    console.error('Failed to send notification email', e);
  }
}

module.exports = { sendNotification };
