/**
 * Fare calculation. Two modes:
 *  - Private-pay rate card (what the rider actually pays)
 *  - Claim charge (billed to payer — typically higher "usual and customary")
 *
 * Rates here are placeholders; tune per market and payer contract.
 */

import type { MobilityType } from "./hcpcs";

export interface RateCard {
  baseFareCents: number;
  perMileCents: number;
  waitPerMinuteCents: number;
  attendantFlatCents: number;
  oxygenFlatCents: number;
  afterHoursMultiplier: number;
  minimumFareCents: number;
}

const DEFAULT_PRIVATE_PAY: Record<MobilityType, RateCard> = {
  ambulatory: {
    baseFareCents: 1500,
    perMileCents: 275,
    waitPerMinuteCents: 50,
    attendantFlatCents: 1000,
    oxygenFlatCents: 0,
    afterHoursMultiplier: 1.25,
    minimumFareCents: 2500,
  },
  wheelchair: {
    baseFareCents: 3500,
    perMileCents: 375,
    waitPerMinuteCents: 75,
    attendantFlatCents: 1500,
    oxygenFlatCents: 1500,
    afterHoursMultiplier: 1.25,
    minimumFareCents: 5000,
  },
  wheelchair_power: {
    baseFareCents: 4000,
    perMileCents: 375,
    waitPerMinuteCents: 75,
    attendantFlatCents: 1500,
    oxygenFlatCents: 1500,
    afterHoursMultiplier: 1.25,
    minimumFareCents: 5500,
  },
  stretcher: {
    baseFareCents: 9500,
    perMileCents: 600,
    waitPerMinuteCents: 125,
    attendantFlatCents: 2500,
    oxygenFlatCents: 2500,
    afterHoursMultiplier: 1.4,
    minimumFareCents: 15000,
  },
  bariatric: {
    baseFareCents: 6500,
    perMileCents: 500,
    waitPerMinuteCents: 100,
    attendantFlatCents: 2000,
    oxygenFlatCents: 2000,
    afterHoursMultiplier: 1.3,
    minimumFareCents: 9500,
  },
};

export interface QuoteInput {
  mobility: MobilityType;
  loadedMiles: number;
  needsAttendant?: boolean;
  needsOxygen?: boolean;
  scheduledPickupAt: Date;
  roundTrip?: boolean;
}

export interface Quote {
  baseFareCents: number;
  mileageFareCents: number;
  extrasCents: number;
  afterHoursSurchargeCents: number;
  subtotalCents: number;
  totalCents: number;
  breakdown: string[];
}

export function quotePrivatePay(input: QuoteInput, card?: RateCard): Quote {
  const rate = card ?? DEFAULT_PRIVATE_PAY[input.mobility];
  const hour = input.scheduledPickupAt.getHours();
  const afterHours = hour < 6 || hour >= 20;

  const tripMultiplier = input.roundTrip ? 2 : 1;
  const baseFareCents = rate.baseFareCents * tripMultiplier;
  const mileageFareCents = Math.round(
    rate.perMileCents * input.loadedMiles * tripMultiplier,
  );

  let extrasCents = 0;
  const breakdown: string[] = [];
  breakdown.push(`Base fare: $${(baseFareCents / 100).toFixed(2)}`);
  breakdown.push(
    `Mileage (${input.loadedMiles.toFixed(1)} mi @ $${(rate.perMileCents / 100).toFixed(2)}/mi): $${(mileageFareCents / 100).toFixed(2)}`,
  );

  if (input.needsAttendant) {
    extrasCents += rate.attendantFlatCents;
    breakdown.push(`Attendant: $${(rate.attendantFlatCents / 100).toFixed(2)}`);
  }
  if (input.needsOxygen) {
    extrasCents += rate.oxygenFlatCents;
    breakdown.push(`Oxygen: $${(rate.oxygenFlatCents / 100).toFixed(2)}`);
  }

  const subtotalCents = baseFareCents + mileageFareCents + extrasCents;
  const afterHoursSurchargeCents = afterHours
    ? Math.round(subtotalCents * (rate.afterHoursMultiplier - 1))
    : 0;
  if (afterHoursSurchargeCents > 0) {
    breakdown.push(
      `After-hours surcharge (${Math.round((rate.afterHoursMultiplier - 1) * 100)}%): $${(afterHoursSurchargeCents / 100).toFixed(2)}`,
    );
  }

  let totalCents = subtotalCents + afterHoursSurchargeCents;
  if (totalCents < rate.minimumFareCents) {
    breakdown.push(
      `Minimum fare applied: $${(rate.minimumFareCents / 100).toFixed(2)}`,
    );
    totalCents = rate.minimumFareCents;
  }

  return {
    baseFareCents,
    mileageFareCents,
    extrasCents,
    afterHoursSurchargeCents,
    subtotalCents,
    totalCents,
    breakdown,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
