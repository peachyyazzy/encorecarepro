-- Polish: webhook idempotency + helper for facility booker context.

-- Stripe (and any other) webhooks: dedup table. We only insert successful
-- handler runs; duplicate events are rejected via the unique key.
create table webhook_events (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,                 -- 'stripe', etc.
  external_event_id text not null,        -- e.g. evt_xxx
  event_type text not null,
  payload_summary jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

alter table webhook_events enable row level security;

create policy webhook_events_admin_read on webhook_events
  for select using (is_admin());

-- Lookup: what facility (if any) is this user acting on behalf of? Returns
-- the first one so it's deterministic; for multi-facility staff we'll add
-- an explicit "active facility" toggle later.
create or replace function user_primary_facility() returns uuid as $$
  select facility_id from public.facility_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
$$ language sql stable security definer set search_path = public;
