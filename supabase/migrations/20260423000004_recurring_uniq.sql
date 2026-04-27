-- Idempotency for the recurring-trip materializer. A schedule should never
-- materialize the same pickup slot twice — even if last_generated_through
-- gets corrupted, this index is the safety net.

create unique index trips_recurring_slot_uk
  on trips (recurring_schedule_id, scheduled_pickup_at)
  where recurring_schedule_id is not null;
