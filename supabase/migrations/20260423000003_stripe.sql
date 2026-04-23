-- Stripe integration — private-pay checkout fields.
-- Storing stripe_customer_id on profiles lets a rider reuse saved cards
-- across bookings. PaymentIntent + status live on trips for v1; when we
-- introduce multi-trip invoices we'll move the PI to the invoice instead.

create type payment_status as enum (
  'none',              -- no payment needed (facility-billed, claim, etc.)
  'pending',           -- intent created, not yet paid
  'authorized',        -- card authorized (hold); not captured
  'paid',              -- captured
  'failed',
  'refunded',
  'partially_refunded'
);

alter table profiles
  add column stripe_customer_id text;

create index profiles_stripe_customer_idx
  on profiles(stripe_customer_id)
  where stripe_customer_id is not null;

alter table trips
  add column stripe_payment_intent_id text,
  add column stripe_checkout_session_id text,
  add column payment_status payment_status not null default 'none';

create index trips_stripe_pi_idx
  on trips(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
