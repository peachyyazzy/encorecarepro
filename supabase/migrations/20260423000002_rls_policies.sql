-- RLS policies: default deny, grant by role + relationship.
-- Service role bypasses all RLS and is used by backend jobs only.

-- ============================================================================
-- HELPER FUNCTIONS (security definer so they can peek at tables the caller
-- doesn't have direct SELECT on, without creating a recursion through RLS)
-- ============================================================================

create or replace function auth_role() returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function is_admin() returns boolean as $$
  select auth_role() = 'admin';
$$ language sql stable;

create or replace function is_dispatcher_or_admin() returns boolean as $$
  select auth_role() in ('admin', 'dispatcher');
$$ language sql stable;

create or replace function user_facility_ids() returns setof uuid as $$
  select facility_id from public.facility_members where user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Can the current user book/view this patient?
create or replace function can_access_patient(p_patient_id uuid) returns boolean as $$
  select exists (
    select 1 from public.patient_guardians g
    where g.patient_id = p_patient_id
      and (
        g.user_id = auth.uid()
        or g.facility_id in (select public.user_facility_ids())
      )
  ) or is_dispatcher_or_admin();
$$ language sql stable security definer set search_path = public;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

alter table profiles              enable row level security;
alter table addresses             enable row level security;
alter table facilities            enable row level security;
alter table facility_members      enable row level security;
alter table patients              enable row level security;
alter table patient_guardians     enable row level security;
alter table insurance_profiles    enable row level security;
alter table vehicles              enable row level security;
alter table drivers               enable row level security;
alter table driver_vehicles       enable row level security;
alter table trips                 enable row level security;
alter table trip_events           enable row level security;
alter table recurring_schedules   enable row level security;
alter table invoices              enable row level security;
alter table invoice_line_items    enable row level security;
alter table claims                enable row level security;
alter table claim_service_lines   enable row level security;
alter table payments              enable row level security;
alter table phi_access_log        enable row level security;

-- ============================================================================
-- PROFILES
-- ============================================================================

create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());

create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on profiles
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- FACILITIES
-- ============================================================================

create policy facilities_member_read on facilities
  for select using (
    id in (select user_facility_ids()) or is_admin()
  );

create policy facilities_admin_write on facilities
  for all using (is_admin()) with check (is_admin());

create policy facility_members_self_read on facility_members
  for select using (user_id = auth.uid() or is_admin());

create policy facility_members_admin_write on facility_members
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- ADDRESSES
-- ============================================================================

create policy addresses_owner_read on addresses
  for select using (
    owner_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_dispatcher_or_admin()
  );

create policy addresses_owner_write on addresses
  for all using (
    owner_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_admin()
  ) with check (
    owner_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_admin()
  );

-- ============================================================================
-- PATIENTS
-- ============================================================================

create policy patients_guardian_read on patients
  for select using (can_access_patient(id));

create policy patients_guardian_write on patients
  for update using (can_access_patient(id))
  with check (can_access_patient(id));

create policy patients_create on patients
  for insert with check (
    -- Any authenticated user can create a patient record (will add themselves as guardian after)
    auth.uid() is not null
  );

create policy patients_admin_delete on patients
  for delete using (is_admin());

-- ============================================================================
-- PATIENT GUARDIANS
-- ============================================================================

create policy guardians_self_read on patient_guardians
  for select using (
    user_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_admin()
  );

create policy guardians_self_write on patient_guardians
  for all using (
    user_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_admin()
  ) with check (
    user_id = auth.uid()
    or facility_id in (select user_facility_ids())
    or is_admin()
  );

-- ============================================================================
-- INSURANCE
-- ============================================================================

create policy insurance_guardian_read on insurance_profiles
  for select using (can_access_patient(patient_id));

create policy insurance_guardian_write on insurance_profiles
  for all using (can_access_patient(patient_id))
  with check (can_access_patient(patient_id));

-- ============================================================================
-- TRIPS
-- ============================================================================

create policy trips_related_read on trips
  for select using (
    can_access_patient(patient_id)
    or booked_by_user_id = auth.uid()
    or booked_by_facility_id in (select user_facility_ids())
    or assigned_driver_id in (select id from drivers where user_id = auth.uid())
    or is_dispatcher_or_admin()
  );

create policy trips_booker_insert on trips
  for insert with check (
    can_access_patient(patient_id)
  );

create policy trips_booker_update on trips
  for update using (
    (can_access_patient(patient_id) and status in ('requested','scheduled'))
    or assigned_driver_id in (select id from drivers where user_id = auth.uid())
    or is_dispatcher_or_admin()
  );

create policy trips_admin_delete on trips
  for delete using (is_admin());

create policy trip_events_read on trip_events
  for select using (
    trip_id in (select id from trips)  -- leans on trips RLS
  );

create policy trip_events_insert on trip_events
  for insert with check (
    actor_user_id = auth.uid()
  );

-- ============================================================================
-- RECURRING SCHEDULES
-- ============================================================================

create policy recurring_related_read on recurring_schedules
  for select using (
    can_access_patient(patient_id)
    or booked_by_user_id = auth.uid()
    or booked_by_facility_id in (select user_facility_ids())
    or is_dispatcher_or_admin()
  );

create policy recurring_booker_write on recurring_schedules
  for all using (can_access_patient(patient_id))
  with check (can_access_patient(patient_id));

-- ============================================================================
-- DRIVERS & VEHICLES
-- ============================================================================

create policy drivers_self_read on drivers
  for select using (
    user_id = auth.uid() or is_dispatcher_or_admin()
  );

create policy drivers_admin_write on drivers
  for all using (is_admin()) with check (is_admin());

create policy vehicles_all_read on vehicles
  for select using (auth.uid() is not null);

create policy vehicles_admin_write on vehicles
  for all using (is_admin()) with check (is_admin());

create policy driver_vehicles_read on driver_vehicles
  for select using (auth.uid() is not null);

create policy driver_vehicles_admin_write on driver_vehicles
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- INVOICES
-- ============================================================================

create policy invoices_related_read on invoices
  for select using (
    can_access_patient(patient_id)
    or billed_to_user_id = auth.uid()
    or billed_to_facility_id in (select user_facility_ids())
    or is_admin()
  );

create policy invoices_admin_write on invoices
  for all using (is_admin()) with check (is_admin());

create policy invoice_lines_read on invoice_line_items
  for select using (
    invoice_id in (select id from invoices)
  );

create policy invoice_lines_admin_write on invoice_line_items
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- CLAIMS — only admins/dispatchers should read/write. Patients don't see the
-- raw 837P data; they see invoices/receipts.
-- ============================================================================

create policy claims_admin_all on claims
  for all using (is_dispatcher_or_admin()) with check (is_dispatcher_or_admin());

create policy claim_lines_admin_all on claim_service_lines
  for all using (is_dispatcher_or_admin()) with check (is_dispatcher_or_admin());

-- ============================================================================
-- PAYMENTS
-- ============================================================================

create policy payments_related_read on payments
  for select using (
    invoice_id in (select id from invoices)
    or is_admin()
  );

create policy payments_admin_write on payments
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- AUDIT LOG — only admins can read. Anyone can insert (for their own actions).
-- ============================================================================

create policy phi_log_admin_read on phi_access_log
  for select using (is_admin());

create policy phi_log_self_insert on phi_access_log
  for insert with check (actor_user_id = auth.uid());
