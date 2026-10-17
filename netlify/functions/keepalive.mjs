// netlify/functions/keepalive.mjs
//
// Runs once a day (Netlify scheduled function) and makes a tiny read from
// Supabase so the free-plan project never counts as inactive and gets
// auto-paused (which made the booking calendar show 10 spots everywhere).

export default async () => {
  const res = await fetch(
    process.env.SUPABASE_URL + '/rest/v1/bookings?select=id&limit=1',
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );
  console.log('supabase keepalive status', res.status);
  return new Response('ok ' + res.status);
};

export const config = { schedule: '0 15 * * *' };
