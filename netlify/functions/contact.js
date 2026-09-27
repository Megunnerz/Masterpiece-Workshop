// netlify/functions/contact.js
//
// Stores a contact-form submission in Supabase (Table Editor:
// contact_messages) and emails you a notification.

const { createClient } = require('@supabase/supabase-js');
const { sendNotification } = require('./lib/notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Very small HTML-escape — these values get interpolated into an email.
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

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

  const { name, email, phone, message } = body;
  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const { error } = await supabase
    .from('contact_messages')
    .insert({ name, email, phone: phone || null, message });

  if (error) {
    console.error('contact insert failed', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not send message, try again' }) };
  }

  await sendNotification({
    subject: `New contact message from ${name}`,
    html: `
      <h2>New contact form message</h2>
      <p><strong>From:</strong> ${esc(name)} (${esc(email)})<br>
         <strong>Phone:</strong> ${esc(phone || '—')}</p>
      <p><strong>Message:</strong></p>
      <p>${esc(message).replace(/\n/g, '<br>')}</p>
    `,
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
