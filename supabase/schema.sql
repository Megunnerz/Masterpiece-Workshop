-- Masterpiece Workshop — database schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query > paste > Run)

-- One row per person who has started or completed booking one seat in one
-- session/slot/date. A "pending" row holds a seat for 15 minutes while the
-- customer is on the Stripe Checkout page; it becomes "paid" once Stripe
-- confirms the charge (via the webhook), or is ignored/cleaned up if they
-- never pay.
create table if not exists bookings (
  id bigint generated always as identity primary key,
  session_key text not null,         -- 'mon' | 'fri' | 'sat'
  slot text not null,                -- 'main' | 'am' | 'pm'
  session_date date not null,        -- the calendar date booked
  slot_number int not null check (slot_number between 1 and 10),
  name text not null,
  age int,
  email text not null,
  phone text,
  stripe_session_id text,
  amount_cents int not null default 5000,
  status text not null default 'pending', -- 'pending' | 'paid' | 'expired' | 'canceled'
  created_at timestamptz not null default now(),
  unique (session_key, slot, session_date, slot_number)
);

create index if not exists bookings_lookup
  on bookings (session_key, slot, session_date, status);

create table if not exists contact_messages (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Atomically claims the next open seat (1-10) for a session/slot/date, or
-- returns null if all 10 are taken (counting seats already paid, or still
-- pending within the last 15 minutes). Uses a transaction-scoped advisory
-- lock so two people clicking "pay" at the same instant can never claim the
-- same seat.
create or replace function claim_slot(
  p_session_key text,
  p_slot text,
  p_date date,
  p_name text,
  p_age int,
  p_email text,
  p_phone text
) returns table(booking_id bigint, slot_number int) as $$
declare
  v_lock_key bigint;
  v_taken int;
  v_next int;
  v_id bigint;
begin
  v_lock_key := hashtextextended(p_session_key || '|' || p_slot || '|' || p_date::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  select count(*) into v_taken
  from bookings
  where session_key = p_session_key
    and slot = p_slot
    and session_date = p_date
    and (status = 'paid' or (status = 'pending' and created_at > now() - interval '15 minutes'));

  if v_taken >= 10 then
    return; -- empty result = full
  end if;

  v_next := v_taken + 1;

  insert into bookings (session_key, slot, session_date, slot_number, name, age, email, phone, status)
  values (p_session_key, p_slot, p_date, v_next, p_name, p_age, p_email, p_phone, 'pending')
  returning id into v_id;

  return query select v_id, v_next;
end;
$$ language plpgsql;

-- Read-only view the frontend calendar queries for spots-left per date.
-- (Row Level Security below restricts writes to the service role only —
-- all writes happen through the Netlify functions, never the browser.)
alter table bookings enable row level security;
alter table contact_messages enable row level security;

-- Allow the anon/public key to READ booking counts (no personal fields
-- exposed — the frontend only ever calls the /availability function,
-- which itself uses the service-role key server-side; this policy is a
-- safety net in case anything queries the table directly).
create policy "no direct anon access" on bookings
  for all using (false);
create policy "no direct anon access to messages" on contact_messages
  for all using (false);
