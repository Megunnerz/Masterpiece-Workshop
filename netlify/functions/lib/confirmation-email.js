// netlify/functions/lib/confirmation-email.js
//
// Builds the booking-confirmation email that parents receive right after
// their payment goes through. Pure function (no network), so it is easy to
// preview and test.

const SESSION_LABELS = {
  mon: 'Monday Night Build',
  fri: 'Friday Night Build',
  sat: 'Saturday Build',
};
const SLOT_LABELS = {
  main: '6:00 – 8:00 pm',
  am: '10:00 am – 12:00 pm',
  pm: '4:00 – 6:00 pm',
};

const LOCATION_LINES = ['8648 US-82, Unit A-9', 'Brookston, TX'];
const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('8648 US-82 Unit A-9, Brookston, TX');
const SITE_URL = 'https://mymasterpieceworkshop.com';
const CONTACT_EMAIL = 'info@mymasterpieceworkshop.com';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettyDate(iso) {
  // iso is "YYYY-MM-DD"; format it in UTC so the weekday never shifts.
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function buildConfirmationEmail(b) {
  const child = esc(b.name);
  const parent = esc(b.parent_name || 'there');
  const when = esc(prettyDate(b.session_date));
  const time = esc(SLOT_LABELS[b.slot] || b.slot);
  const session = esc(SESSION_LABELS[b.session_key] || b.session_key);
  const amount = (Number(b.amount_cents || 0) / 100).toFixed(2);

  const subject = `You're booked! ${b.name} · ${prettyDate(b.session_date)}`;

  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;color:#7a6a4a;font-size:14px;width:34%;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;color:#241408;font-size:16px;font-weight:700;vertical-align:top;">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#fff6e0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e0;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#3d2314;padding:22px 28px;text-align:center;">
          <div style="color:#ffc93c;font-size:14px;letter-spacing:1px;text-transform:uppercase;">Masterpiece Workshop</div>
          <div style="color:#ffffff;font-size:26px;font-weight:700;margin-top:6px;">You're booked! 🔨</div>
        </td></tr>
        <tr><td style="padding:26px 28px 8px 28px;color:#241408;font-size:16px;line-height:1.5;">
          <p style="margin:0 0 12px 0;">Hi ${parent},</p>
          <p style="margin:0;">Thank you for booking! <strong>${child}</strong> has a spot in our kids woodworking class, and your payment was received. Here are all the details.</p>
        </td></tr>
        <tr><td style="padding:8px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #f1e3c3;border-bottom:2px solid #f1e3c3;">
            ${row('Child', child)}
            ${row('Class', session)}
            ${row('Date', when)}
            ${row('Time', time)}
            ${row(
              'Location',
              `${esc(LOCATION_LINES[0])}<br>${esc(LOCATION_LINES[1])}<br><a href="${MAPS_URL}" style="color:#d5312e;font-size:14px;font-weight:700;">Open in Maps</a>`
            )}
            ${row('Amount paid', `$${amount} USD`)}
          </table>
        </td></tr>
        <tr><td style="padding:16px 28px 8px 28px;color:#241408;font-size:15px;line-height:1.5;">
          <p style="margin:0 0 10px 0;"><strong>Need to change something or have a question?</strong><br>
          Just reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:#d5312e;">${CONTACT_EMAIL}</a>.</p>
          <p style="margin:0;">Please keep this email as your confirmation.</p>
        </td></tr>
        <tr><td style="padding:18px 28px 28px 28px;text-align:center;">
          <a href="${SITE_URL}" style="display:inline-block;background:#ff5e5b;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 26px;border-radius:999px;">Book another class</a>
          <p style="margin:16px 0 0 0;color:#7a6a4a;font-size:13px;">Masterpiece Workshop · 8648 US-82, Unit A-9, Brookston, TX<br>
          <a href="${SITE_URL}" style="color:#7a6a4a;">mymasterpieceworkshop.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${b.parent_name || 'there'},`,
    '',
    `Thank you for booking! ${b.name} has a spot in our kids woodworking class, and your payment was received.`,
    '',
    `Child: ${b.name}`,
    `Class: ${SESSION_LABELS[b.session_key] || b.session_key}`,
    `Date: ${prettyDate(b.session_date)}`,
    `Time: ${SLOT_LABELS[b.slot] || b.slot}`,
    `Location: ${LOCATION_LINES.join(', ')}`,
    `Amount paid: $${amount} USD`,
    '',
    `Questions or changes? Reply to this email or write to ${CONTACT_EMAIL}.`,
    'Please keep this email as your confirmation.',
    '',
    'Masterpiece Workshop · mymasterpieceworkshop.com',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { buildConfirmationEmail };
