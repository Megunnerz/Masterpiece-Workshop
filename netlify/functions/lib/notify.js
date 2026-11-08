// netlify/functions/lib/notify.js
//
// Small shared helper for sending emails via Resend.
//   - sendNotification: email to YOU (new paid booking, new contact message).
//   - sendCustomerEmail: email to a parent (booking confirmation).
// Neither ever throws — an email failure should never break the booking or
// the contact form itself, so callers just await and ignore errors.

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared sending domain works immediately with zero setup.
// Once you verify mymasterpieceworkshop.com in Resend (see SETUP.md),
// switch FROM_EMAIL to something like "bookings@mymasterpieceworkshop.com".
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || 'Masterpiece Workshop <onboarding@resend.dev>';

// Parent-facing emails always come from the verified business domain.
const CUSTOMER_FROM_EMAIL =
  process.env.CUSTOMER_FROM_EMAIL || 'Masterpiece Workshop <bookings@mymasterpieceworkshop.com>';
const REPLY_TO = process.env.CUSTOMER_REPLY_TO || 'info@mymasterpieceworkshop.com';

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

async function sendCustomerEmail({ to, subject, html, text }) {
  if (!resend || !to) {
    console.warn('Customer email not sent (missing RESEND_API_KEY or recipient) — skipping.');
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: CUSTOMER_FROM_EMAIL,
      to,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });
    if (error) console.error('Resend rejected customer email', error);
  } catch (e) {
    console.error('Failed to send customer email', e);
  }
}

module.exports = { sendNotification, sendCustomerEmail };
