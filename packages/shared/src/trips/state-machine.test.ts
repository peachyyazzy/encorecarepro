import { describe, it, expect } from "vitest";
import {
  assertTransition,
  nextStatusesFor,
  InvalidTripTransition,
  isTerminal,
} from "./state-machine";

describe("trip state machine", () => {
  it("admin can advance from any non-terminal state", () => {
    expect(() =>
      assertTransition("scheduled", "assigned", { role: "admin" }),
    ).not.toThrow();
    expect(() =>
      assertTransition("driver_arrived", "no_show", { role: "admin" }),
    ).not.toThrow();
  });

  it("rejects transitions out of terminal statuses", () => {
    expect(() =>
      assertTransition("completed", "in_progress", { role: "admin" }),
    ).toThrow(InvalidTripTransition);
    expect(() =>
      assertTransition("canceled", "scheduled", { role: "admin" }),
    ).toThrow(InvalidTripTransition);
  });

  it("driver can only progress along the operational arc and only when assigned", () => {
    expect(() =>
      assertTransition("assigned", "driver_en_route", {
        role: "driver",
        isAssignedDriver: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertTransition("assigned", "driver_en_route", {
        role: "driver",
        isAssignedDriver: false,
      }),
    ).toThrow(InvalidTripTransition);

    // Driver can't reschedule
    expect(() =>
      assertTransition("assigned", "scheduled", {
        role: "driver",
        isAssignedDriver: true,
      }),
    ).toThrow(InvalidTripTransition);
  });

  it("booker can cancel up through driver_arrived but not after", () => {
    expect(() =>
      assertTransition("scheduled", "canceled", {
        role: "rider",
        isBooker: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertTransition("in_progress", "canceled", {
        role: "rider",
        isBooker: true,
      }),
    ).toThrow(InvalidTripTransition);
  });

  it("nextStatusesFor returns role-filtered set", () => {
    const driverNext = nextStatusesFor("driver_arrived", {
      role: "driver",
      isAssignedDriver: true,
    });
    expect(driverNext).toEqual(["in_progress", "no_show"]);
  });

  it("isTerminal flags only terminal states", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("canceled")).toBe(true);
    expect(isTerminal("no_show")).toBe(true);
    expect(isTerminal("scheduled")).toBe(false);
  });
});
