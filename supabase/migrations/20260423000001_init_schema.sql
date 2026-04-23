-- Encore Care NEMT — initial schema
-- Tables are HIPAA-sensitive; RLS is ON for every table that touches PHI.
-- Service role bypasses RLS and is used only by backend jobs (claims, invoicing).

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_role as enum (
  'rider',
  'family',
  'facility_staff',
  'facility_admin',
  'driver',
  'dispatcher',
  'admin'
);

create type mobility_type as enum (
  'ambulatory',
  'wheelchair',
  'wheelchair_power',
  'stretcher',
  'bariatric'
);

create type trip_status as enum (
  'requested',
  'scheduled',
  'assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'dropped_off',
  'completed',
  'canceled',
  'no_show'
);

create type trip_type as enum (
  'one_way',
  'round_trip',
  'will_call_return'
);

create type payer_type as enum (
  'private_pay',
  'medicaid',
  'medicare',
  'mco',
  'waiver_program',
  'va',
  'workers_comp',
  'facility_billed'
);

create type claim_status as enum (
  'draft',
  'ready',
  'submitted',
  'accepted',
  'partially_paid',
  'paid',
  'denied',
  'appealed',
  'voided'
);

create type invoice_status as enum (
  'draft',
  'issued',
  'paid',
  'overdue',
  'void'
);

-- HCPCS origin/destination modifiers used on NEMT claims.
-- D = Diagnostic or therapeutic site (non-P, non-H)
-- E = Residential, domiciliary, custodial facility (non 19-1)
-- G = Hospital based dialysis facility
-- H = Hospital
-- I = Site of transfer between modes of ambulance transport
-- J = Non-hospital based dialysis facility
-- N = Skilled nursing facility
-- P = Physician's office
-- R = Residence
-- S = Scene of accident or acute event
-- X = Destination code only — intermediate stop at physician's office
create type location_modifier as enum (
  'D','E','G','H','I','J','N','P','R','S','X'
);

-- ============================================================================
-- PROFILES — extends auth.users
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  phone text,
  first_name text not null,
  last_name text not null,
  role user_role not null default 'rider',
  preferred_language text default 'en',
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on profiles(role);

-- ============================================================================
-- ADDRESSES
-- ============================================================================

create table addresses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  facility_id uuid, -- fk added after facilities exists
  label text,
  line1 text not null,
  line2 text,
  city text not null,
  state char(2) not null,
  postal_code text not null,
  country char(2) not null default 'US',
  latitude numeric(9,6),
  longitude numeric(9,6),
  place_id text, -- Google Places ID for re-resolution
  notes text, -- "Use side entrance", etc.
  created_at timestamptz not null default now()
);

create index addresses_owner_idx on addresses(owner_id);
create index addresses_facility_idx on addresses(facility_id);

-- ============================================================================
-- FACILITIES
-- ============================================================================

create table facilities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  npi text,                          -- National Provider Identifier
  tax_id text,                       -- for invoicing
  contact_email citext,
  contact_phone text,
  primary_address_id uuid references addresses(id),
  contract_tier text default 'standard', -- 'standard', 'priority', 'enterprise'
  billing_email citext,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table addresses
  add constraint addresses_facility_fk
  foreign key (facility_id) references facilities(id) on delete cascade;

create table facility_members (
  facility_id uuid not null references facilities(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'facility_staff',
  created_at timestamptz not null default now(),
  primary key (facility_id, user_id)
);

create index facility_members_user_idx on facility_members(user_id);

-- ============================================================================
-- PATIENTS (the rider — may or may not be a platform user themselves)
-- ============================================================================

create table patients (
  id uuid primary key default uuid_generate_v4(),
  -- If the patient is also a platform user (self-booking), link it here
  user_id uuid unique references profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  phone text,
  email citext,
  home_address_id uuid references addresses(id),
  mobility mobility_type not null default 'ambulatory',
  needs_attendant boolean not null default false,
  needs_oxygen boolean not null default false,
  service_animal boolean not null default false,
  notes text,                         -- clinical / accessibility notes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Authorized bookers for a patient: self, family, or facility staff
create table patient_guardians (
  patient_id uuid not null references patients(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  facility_id uuid references facilities(id) on delete cascade,
  relationship text, -- 'self', 'spouse', 'child', 'caregiver', 'facility'
  can_book boolean not null default true,
  can_view_history boolean not null default true,
  created_at timestamptz not null default now(),
  -- must have exactly one of user_id or facility_id
  check ((user_id is not null)::int + (facility_id is not null)::int = 1)
);

create unique index patient_guardians_user_uk
  on patient_guardians(patient_id, user_id) where user_id is not null;
create unique index patient_guardians_facility_uk
  on patient_guardians(patient_id, facility_id) where facility_id is not null;
create index patient_guardians_user_idx on patient_guardians(user_id);
create index patient_guardians_facility_idx on patient_guardians(facility_id);

-- ============================================================================
-- INSURANCE / PAYER PROFILES
-- ============================================================================

create table insurance_profiles (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete cascade,
  payer_type payer_type not null,
  payer_name text,                   -- "Aetna Better Health", "NY Medicaid", etc.
  payer_id text,                     -- clearinghouse payer ID
  member_id text,                    -- member / subscriber ID
  group_number text,
  plan_name text,
  auth_required boolean not null default false,
  is_primary boolean not null default true,
  effective_date date,
  term_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insurance_patient_idx on insurance_profiles(patient_id);

-- ============================================================================
-- VEHICLES & DRIVERS
-- ============================================================================

create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  make text,
  model text,
  year int,
  license_plate text,
  capacity_passengers int default 3,
  wheelchair_accessible boolean not null default false,
  stretcher_capable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table drivers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references profiles(id) on delete cascade,
  license_number text,
  license_expires date,
  background_check_date date,
  npi text,
  active boolean not null default true,
  rating numeric(3,2),
  created_at timestamptz not null default now()
);

create table driver_vehicles (
  driver_id uuid not null references drivers(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  primary key (driver_id, vehicle_id)
);

-- ============================================================================
-- TRIPS
-- ============================================================================

create table trips (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete restrict,
  booked_by_user_id uuid references profiles(id) on delete set null,
  booked_by_facility_id uuid references facilities(id) on delete set null,

  trip_type trip_type not null default 'one_way',
  status trip_status not null default 'requested',

  -- scheduling
  scheduled_pickup_at timestamptz not null,
  appointment_at timestamptz,         -- expected arrival at destination
  return_pickup_at timestamptz,       -- for round trips

  -- addresses
  pickup_address_id uuid not null references addresses(id),
  dropoff_address_id uuid not null references addresses(id),
  origin_modifier location_modifier,
  destination_modifier location_modifier,

  -- requirements
  mobility mobility_type not null default 'ambulatory',
  needs_attendant boolean not null default false,
  needs_oxygen boolean not null default false,
  passenger_count int not null default 1, -- rider + escorts
  special_instructions text,

  -- fulfillment
  assigned_driver_id uuid references drivers(id) on delete set null,
  assigned_vehicle_id uuid references vehicles(id) on delete set null,
  actual_pickup_at timestamptz,
  actual_dropoff_at timestamptz,
  loaded_miles numeric(7,2),
  unloaded_miles numeric(7,2),

  -- billing
  payer_type payer_type not null,
  insurance_profile_id uuid references insurance_profiles(id),
  hcpcs_code text,                    -- A0100, A0130, A0425 etc.
  base_fare_cents int,
  mileage_fare_cents int,
  total_fare_cents int,
  prior_auth_number text,

  -- recurring schedule linkage
  recurring_schedule_id uuid,         -- fk added below

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_patient_idx on trips(patient_id);
create index trips_booked_by_user_idx on trips(booked_by_user_id);
create index trips_booked_by_facility_idx on trips(booked_by_facility_id);
create index trips_driver_idx on trips(assigned_driver_id);
create index trips_status_idx on trips(status);
create index trips_scheduled_idx on trips(scheduled_pickup_at);

-- status change audit
create table trip_events (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_status trip_status,
  to_status trip_status not null,
  actor_user_id uuid references profiles(id),
  note text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now()
);

create index trip_events_trip_idx on trip_events(trip_id);

-- ============================================================================
-- RECURRING SCHEDULES (e.g., dialysis M/W/F for 12 weeks)
-- ============================================================================

create table recurring_schedules (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references patients(id) on delete cascade,
  booked_by_user_id uuid references profiles(id) on delete set null,
  booked_by_facility_id uuid references facilities(id) on delete set null,
  label text,                         -- "Dialysis", "PT appointments"

  -- template fields copied into each generated trip
  pickup_address_id uuid not null references addresses(id),
  dropoff_address_id uuid not null references addresses(id),
  pickup_time_local time not null,    -- local time of day
  timezone text not null default 'America/New_York',
  mobility mobility_type not null default 'ambulatory',
  trip_type trip_type not null default 'round_trip',
  return_pickup_time_local time,

  -- recurrence
  days_of_week int[] not null,        -- 0=Sun..6=Sat
  start_date date not null,
  end_date date,                      -- null = indefinite
  skip_dates date[] default '{}',

  -- billing defaults
  payer_type payer_type not null,
  insurance_profile_id uuid references insurance_profiles(id),

  active boolean not null default true,
  last_generated_through date,        -- last date we materialized trips for

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trips
  add constraint trips_recurring_schedule_fk
  foreign key (recurring_schedule_id) references recurring_schedules(id) on delete set null;

create index recurring_schedules_patient_idx on recurring_schedules(patient_id);
create index recurring_schedules_active_idx on recurring_schedules(active);

-- ============================================================================
-- INVOICES (private pay + superbill for any trip)
-- ============================================================================

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text unique not null,
  patient_id uuid not null references patients(id) on delete restrict,
  billed_to_user_id uuid references profiles(id),
  billed_to_facility_id uuid references facilities(id),
  status invoice_status not null default 'draft',

  subtotal_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,

  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,

  stripe_payment_intent_id text,
  stripe_invoice_id text,

  pdf_url text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (billed_to_user_id is not null)::int +
    (billed_to_facility_id is not null)::int = 1
  )
);

create index invoices_patient_idx on invoices(patient_id);
create index invoices_status_idx on invoices(status);

create table invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  description text not null,
  hcpcs_code text,
  modifier_1 text,
  modifier_2 text,
  quantity numeric(7,2) not null default 1,
  unit_price_cents int not null,
  total_cents int not null,
  service_date date not null,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_idx on invoice_line_items(invoice_id);

-- ============================================================================
-- CLAIMS (Medicaid / MCO / 837P-ready)
-- ============================================================================

create table claims (
  id uuid primary key default uuid_generate_v4(),
  claim_number text unique not null,
  patient_id uuid not null references patients(id) on delete restrict,
  insurance_profile_id uuid not null references insurance_profiles(id),
  status claim_status not null default 'draft',

  -- 837P fields captured at submission time
  billing_npi text,
  rendering_npi text,
  service_facility_npi text,
  payer_id text,
  payer_name text,
  member_id text,
  prior_auth_number text,

  total_charge_cents int not null default 0,
  total_paid_cents int not null default 0,
  patient_responsibility_cents int not null default 0,

  submitted_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  denied_at timestamptz,
  denial_reason text,

  clearinghouse text,                  -- 'office_ally', 'availity', 'waystar'
  clearinghouse_claim_id text,
  remittance_data jsonb,               -- raw 835 details

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index claims_patient_idx on claims(patient_id);
create index claims_status_idx on claims(status);

create table claim_service_lines (
  id uuid primary key default uuid_generate_v4(),
  claim_id uuid not null references claims(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  line_number int not null,
  hcpcs_code text not null,
  modifier_1 text,
  modifier_2 text,
  modifier_3 text,
  modifier_4 text,
  service_date date not null,
  place_of_service text,               -- CMS POS code
  diagnosis_pointer text,              -- e.g. 'A', 'AB'
  units numeric(7,2) not null default 1,
  charge_cents int not null,
  allowed_cents int,
  paid_cents int,
  adjustment_cents int,
  created_at timestamptz not null default now()
);

create index claim_service_lines_claim_idx on claim_service_lines(claim_id);

-- ============================================================================
-- PAYMENTS (Stripe for private pay; EOBs for claims)
-- ============================================================================

create table payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete set null,
  claim_id uuid references claims(id) on delete set null,
  amount_cents int not null,
  currency char(3) not null default 'USD',
  method text not null,                -- 'card', 'ach', 'eob', 'cash'
  stripe_charge_id text,
  stripe_payment_intent_id text,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index payments_invoice_idx on payments(invoice_id);
create index payments_claim_idx on payments(claim_id);

-- ============================================================================
-- AUDIT LOG — every PHI read/write. Service role inserts only.
-- ============================================================================

create table phi_access_log (
  id bigserial primary key,
  actor_user_id uuid references profiles(id),
  actor_role user_role,
  action text not null,                -- 'read', 'create', 'update', 'delete', 'export'
  resource_type text not null,         -- 'patient', 'trip', 'claim', ...
  resource_id uuid,
  ip_address inet,
  user_agent text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index phi_access_log_actor_idx on phi_access_log(actor_user_id);
create index phi_access_log_resource_idx on phi_access_log(resource_type, resource_id);
create index phi_access_log_created_idx on phi_access_log(created_at desc);

-- ============================================================================
-- TRIGGERS — updated_at
-- ============================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles before update on profiles
  for each row execute function set_updated_at();
create trigger set_updated_at_facilities before update on facilities
  for each row execute function set_updated_at();
create trigger set_updated_at_patients before update on patients
  for each row execute function set_updated_at();
create trigger set_updated_at_insurance before update on insurance_profiles
  for each row execute function set_updated_at();
create trigger set_updated_at_trips before update on trips
  for each row execute function set_updated_at();
create trigger set_updated_at_recurring before update on recurring_schedules
  for each row execute function set_updated_at();
create trigger set_updated_at_invoices before update on invoices
  for each row execute function set_updated_at();
create trigger set_updated_at_claims before update on claims
  for each row execute function set_updated_at();

-- Auto-create profile row when auth.users row is created
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'rider')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
