import { describe, it, expect } from "vitest";
import { quotePrivatePay } from "./pricing";
import { buildServiceLines, buildDraftClaim } from "./claim";
import { buildInvoice } from "./invoice";
import { defaultHcpcsForMobility } from "./hcpcs";

describe("quotePrivatePay", () => {
  it("computes ambulatory base + mileage at midday", () => {
    const q = quotePrivatePay({
      mobility: "ambulatory",
      loadedMiles: 10,
      scheduledPickupAt: new Date("2026-05-01T13:00:00Z"),
    });
    // Base 1500, per-mile 275 * 10 = 2750. Total 4250 (no after-hours).
    expect(q.baseFareCents).toBe(1500);
    expect(q.mileageFareCents).toBe(2750);
    expect(q.totalCents).toBe(4250);
  });

  it("doubles base + mileage on round trips", () => {
    const oneWay = quotePrivatePay({
      mobility: "ambulatory",
      loadedMiles: 10,
      scheduledPickupAt: new Date("2026-05-01T13:00:00Z"),
    });
    const round = quotePrivatePay({
      mobility: "ambulatory",
      loadedMiles: 10,
      scheduledPickupAt: new Date("2026-05-01T13:00:00Z"),
      roundTrip: true,
    });
    expect(round.baseFareCents).toBe(oneWay.baseFareCents * 2);
    expect(round.mileageFareCents).toBe(oneWay.mileageFareCents * 2);
  });

  it("applies the after-hours surcharge before 6am or after 8pm local", () => {
    // 11pm UTC ~ varies by user tz; the impl uses local hour, so use a Date
    // whose JS Date getHours() returns >= 20. Set explicitly.
    const late = new Date(2026, 4, 1, 22, 0); // 10pm local
    const q = quotePrivatePay({
      mobility: "ambulatory",
      loadedMiles: 10,
      scheduledPickupAt: late,
    });
    expect(q.afterHoursSurchargeCents).toBeGreaterThan(0);
  });

  it("enforces the minimum fare", () => {
    const q = quotePrivatePay({
      mobility: "ambulatory",
      loadedMiles: 0.1,
      scheduledPickupAt: new Date(2026, 4, 1, 13, 0),
    });
    expect(q.totalCents).toBeGreaterThanOrEqual(2500);
  });
});

describe("billing code mappings", () => {
  it("maps wheelchair mobility to A0130", () => {
    expect(defaultHcpcsForMobility("wheelchair")).toBe("A0130");
  });

  it("maps stretcher mobility to T2005", () => {
    expect(defaultHcpcsForMobility("stretcher")).toBe("T2005");
  });
});

describe("buildServiceLines", () => {
  it("emits a base line and a mileage line with O/D modifiers", () => {
    const lines = buildServiceLines({
      tripId: "t1",
      serviceDate: "2026-05-01",
      mobility: "wheelchair",
      loadedMiles: 12.4,
      originModifier: "R",
      destinationModifier: "H",
      diagnosisCodes: ["N18.6"],
      trunkChargeCents: 6500,
      mileageChargeCents: 4500,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]!.hcpcsCode).toBe("A0130");
    expect(lines[0]!.modifiers).toEqual(["RH"]);
    expect(lines[1]!.hcpcsCode).toBe("A0425");
    expect(lines[1]!.units).toBe(12.4);
  });

  it("omits the mileage line when miles is zero", () => {
    const lines = buildServiceLines({
      tripId: "t1",
      serviceDate: "2026-05-01",
      mobility: "ambulatory",
      loadedMiles: 0,
      originModifier: "R",
      destinationModifier: "H",
      diagnosisCodes: [],
      trunkChargeCents: 2500,
      mileageChargeCents: 0,
    });
    expect(lines).toHaveLength(1);
  });
});

describe("buildDraftClaim", () => {
  it("aggregates multiple trips and totals charges across all lines", () => {
    const claim = buildDraftClaim({
      patient: {
        firstName: "Jane", lastName: "Doe", dateOfBirth: "1950-04-01",
        memberId: "M1234", addressLine1: "1 Main", city: "Albany",
        state: "NY", postalCode: "12207",
      },
      payer: { payerId: "MEDICAID-NY", payerName: "NY Medicaid" },
      provider: {
        billingNpi: "1234567890", billingTaxId: "12-3456789",
        billingName: "Encore Care", billingAddress: {
          line1: "1 HQ", city: "NYC", state: "NY", postalCode: "10001",
        },
      },
      diagnosisCodes: ["N18.6"],
      trips: [
        {
          tripId: "t1", serviceDate: "2026-05-01", mobility: "wheelchair",
          loadedMiles: 10, originModifier: "R", destinationModifier: "H",
          diagnosisCodes: ["N18.6"], trunkChargeCents: 6500,
          mileageChargeCents: 3750,
        },
        {
          tripId: "t2", serviceDate: "2026-05-03", mobility: "wheelchair",
          loadedMiles: 10, originModifier: "H", destinationModifier: "R",
          diagnosisCodes: ["N18.6"], trunkChargeCents: 6500,
          mileageChargeCents: 3750,
        },
      ],
    });
    expect(claim.serviceLines).toHaveLength(4);
    expect(claim.totalChargeCents).toBe((6500 + 3750) * 2);
    expect(claim.serviceLines[0]!.lineNumber).toBe(1);
    expect(claim.serviceLines[3]!.lineNumber).toBe(4);
  });
});

describe("buildInvoice", () => {
  it("creates one or two line items per trip and sums to subtotal", () => {
    const invoice = buildInvoice({
      invoiceNumber: "ECP-2026-000001",
      issuedAt: new Date(),
      provider: {
        legalName: "Encore Care", addressLine1: "1 HQ", city: "NYC",
        state: "NY", postalCode: "10001", phone: "555-0100",
        email: "billing@encorecare.org",
      },
      patient: { firstName: "Jane", lastName: "Doe", dateOfBirth: "1950-04-01" },
      billedTo: { name: "Jane Doe" },
      trips: [
        {
          tripId: "t1", serviceDate: "2026-05-01", pickupTime: "09:00",
          dropoffTime: "09:30", pickupAddress: "1 Main St", dropoffAddress: "Hospital",
          mobility: "ambulatory", loadedMiles: 10, originModifier: "R",
          destinationModifier: "H", driverName: "John D", vehicleDescription: "2024 Sedan",
          baseFareCents: 1500, mileageFareCents: 2750, extrasCents: 0,
          totalCents: 4250,
        },
      ],
    });
    expect(invoice.lines).toHaveLength(2);
    expect(invoice.subtotalCents).toBe(4250);
  });
});
