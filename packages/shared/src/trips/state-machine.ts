/**
 * Trip state machine. The DB doesn't enforce these transitions — this
 * helper does, and every code path that updates `trips.status` must go
 * through `assertTransition`.
 *
 * Roles:
 *   - dispatcher / admin can do anything
 *   - driver can advance their assigned trip through the operational arc
 *   - facility / family / rider booker can cancel up to driver_arrived
 */

import type { TripStatus, UserRole } from "../types";

const OPERATIONAL_ARC: TripStatus[] = [
  "requested",
  "scheduled",
  "assigned",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "dropped_off",
  "completed",
];

const TERMINAL: TripStatus[] = ["completed", "canceled", "no_show"];

const ALLOWED: Record<TripStatus, TripStatus[]> = {
  requested:        ["scheduled", "assigned", "canceled"],
  scheduled:        ["assigned", "canceled"],
  assigned:         ["driver_en_route", "scheduled", "canceled"],
  driver_en_route:  ["driver_arrived", "canceled"],
  driver_arrived:   ["in_progress", "no_show", "canceled"],
  in_progress:      ["dropped_off"],
  dropped_off:      ["completed"],
  completed:        [],
  canceled:         [],
  no_show:          [],
};

const DRIVER_ALLOWED: TripStatus[] = [
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "dropped_off",
  "completed",
  "no_show",
];

const BOOKER_ALLOWED: TripStatus[] = ["canceled"];

export interface AssertOpts {
  role: UserRole;
  isAssignedDriver?: boolean;
  isBooker?: boolean;
}

export class InvalidTripTransition extends Error {
  constructor(public from: TripStatus, public to: TripStatus, public reason: string) {
    super(`Cannot transition trip ${from} -> ${to}: ${reason}`);
    this.name = "InvalidTripTransition";
  }
}

export function isTerminal(status: TripStatus): boolean {
  return TERMINAL.includes(status);
}

export function nextStatusesFor(
  current: TripStatus,
  opts: AssertOpts,
): TripStatus[] {
  if (isTerminal(current)) return [];
  const possible = ALLOWED[current];

  if (opts.role === "admin" || opts.role === "dispatcher") return possible;
  if (opts.role === "driver" && opts.isAssignedDriver) {
    return possible.filter((s) => DRIVER_ALLOWED.includes(s));
  }
  if (opts.isBooker) {
    return possible.filter((s) => BOOKER_ALLOWED.includes(s));
  }
  return [];
}

export function assertTransition(
  from: TripStatus,
  to: TripStatus,
  opts: AssertOpts,
): void {
  if (from === to) {
    throw new InvalidTripTransition(from, to, "no-op transition");
  }
  if (isTerminal(from)) {
    throw new InvalidTripTransition(from, to, "already terminal");
  }
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidTripTransition(from, to, "not in allowed transitions");
  }
  const allowed = nextStatusesFor(from, opts);
  if (!allowed.includes(to)) {
    throw new InvalidTripTransition(from, to, `role ${opts.role} not permitted`);
  }
}

export const TRIP_OPERATIONAL_ARC = OPERATIONAL_ARC;

/** Driver-facing label for the action button that moves to `next`. */
export function driverActionLabel(next: TripStatus): string {
  switch (next) {
    case "driver_en_route":  return "I'm on my way";
    case "driver_arrived":   return "I've arrived";
    case "in_progress":      return "Start trip";
    case "dropped_off":      return "Drop-off complete";
    case "completed":        return "Finish trip";
    case "no_show":          return "Mark no-show";
    case "canceled":         return "Cancel";
    default:                 return next;
  }
}
