import { describe, it, expect } from "vitest";
import { computeSlots, type RecurringTemplate } from "./index";

const baseTemplate = (overrides: Partial<RecurringTemplate> = {}): RecurringTemplate => ({
  id: "s1",
  daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
  pickupTimeLocal: "09:00",
  timezone: "America/New_York",
  startDate: new Date("2026-04-27"), // Monday
  endDate: null,
  skipDates: [],
  lastGeneratedThrough: null,
  ...overrides,
});

describe("computeSlots", () => {
  it("generates slots only on the configured days of week", () => {
    const slots = computeSlots(baseTemplate(), new Date("2026-05-04"));
    // 2026-04-27 (Mon), 04-29 (Wed), 05-01 (Fri), 05-04 (Mon)
    expect(slots.map((s) => s.serviceDate)).toEqual([
      "2026-04-27",
      "2026-04-29",
      "2026-05-01",
      "2026-05-04",
    ]);
  });

  it("skips days listed in skipDates", () => {
    const slots = computeSlots(
      baseTemplate({ skipDates: [new Date("2026-04-29")] }),
      new Date("2026-05-04"),
    );
    expect(slots.map((s) => s.serviceDate)).toEqual([
      "2026-04-27",
      "2026-05-01",
      "2026-05-04",
    ]);
  });

  it("starts from the day after lastGeneratedThrough", () => {
    const slots = computeSlots(
      baseTemplate({ lastGeneratedThrough: new Date("2026-04-29") }),
      new Date("2026-05-04"),
    );
    expect(slots.map((s) => s.serviceDate)).toEqual(["2026-05-01", "2026-05-04"]);
  });

  it("respects endDate", () => {
    const slots = computeSlots(
      baseTemplate({ endDate: new Date("2026-04-30") }),
      new Date("2026-05-31"),
    );
    expect(slots.map((s) => s.serviceDate)).toEqual(["2026-04-27", "2026-04-29"]);
  });

  it("converts pickup time to UTC using the schedule timezone", () => {
    const slots = computeSlots(
      baseTemplate({ daysOfWeek: [1], pickupTimeLocal: "09:00" }),
      new Date("2026-04-27"),
    );
    // 9 AM EDT (UTC-4) → 13:00 UTC
    expect(slots).toHaveLength(1);
    expect(slots[0]!.scheduledPickupAt.toISOString()).toBe("2026-04-27T13:00:00.000Z");
  });

  it("returns empty when start is after horizon", () => {
    const slots = computeSlots(
      baseTemplate({ startDate: new Date("2026-06-01") }),
      new Date("2026-05-15"),
    );
    expect(slots).toEqual([]);
  });
});
