export type UserRole =
  | "rider"
  | "family"
  | "facility_staff"
  | "facility_admin"
  | "driver"
  | "dispatcher"
  | "admin";

export type TripStatus =
  | "requested"
  | "scheduled"
  | "assigned"
  | "driver_en_route"
  | "driver_arrived"
  | "in_progress"
  | "dropped_off"
  | "completed"
  | "canceled"
  | "no_show";

export type TripType = "one_way" | "round_trip" | "will_call_return";

export type PayerType =
  | "private_pay"
  | "medicaid"
  | "medicare"
  | "mco"
  | "waiver_program"
  | "va"
  | "workers_comp"
  | "facility_billed";

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  assigned: "Driver assigned",
  driver_en_route: "Driver on the way",
  driver_arrived: "Driver arrived",
  in_progress: "In progress",
  dropped_off: "Dropped off",
  completed: "Completed",
  canceled: "Canceled",
  no_show: "No show",
};

export const MOBILITY_LABELS = {
  ambulatory: "Walks on own",
  wheelchair: "Manual wheelchair",
  wheelchair_power: "Power wheelchair",
  stretcher: "Stretcher / gurney",
  bariatric: "Bariatric",
} as const;

/** A claim uses Medicaid/MCO billing; a private-pay trip uses invoices. */
export function requiresClaim(payerType: PayerType): boolean {
  return (
    payerType === "medicaid" ||
    payerType === "medicare" ||
    payerType === "mco" ||
    payerType === "waiver_program" ||
    payerType === "va" ||
    payerType === "workers_comp"
  );
}
