/**
 * Map a completed trip to an 837P-shaped claim service line. The clearinghouse
 * integration (Office Ally, Availity, Waystar) consumes this and produces EDI.
 *
 * This is an intermediate representation — not raw EDI. It captures every
 * field a clearinghouse or direct 837P generator will ask for.
 */

import {
  defaultHcpcsForMobility,
  buildOriginDestinationModifier,
  type LocationModifier,
  type MobilityType,
} from "./hcpcs";

export interface ClaimPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  memberId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  genderCode?: "M" | "F" | "U";
}

export interface ClaimPayer {
  payerId: string;
  payerName: string;
}

export interface ClaimProvider {
  billingNpi: string;
  billingTaxId: string;
  billingName: string;
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  };
  renderingNpi?: string;
  renderingName?: string;
}

export interface ClaimTripInput {
  tripId: string;
  serviceDate: string; // YYYY-MM-DD
  mobility: MobilityType;
  loadedMiles: number;
  originModifier: LocationModifier;
  destinationModifier: LocationModifier;
  priorAuthNumber?: string;
  diagnosisCodes: string[]; // ICD-10 codes
  trunkChargeCents: number;
  mileageChargeCents: number;
  overrideHcpcs?: string;
  placeOfService?: string; // CMS POS, e.g. "99" for other, "12" for home
}

export interface ClaimServiceLine {
  lineNumber: number;
  hcpcsCode: string;
  modifiers: string[];
  serviceDate: string;
  placeOfService: string;
  units: number;
  chargeCents: number;
  diagnosisPointer: string;
}

export interface DraftClaim {
  patient: ClaimPatient;
  payer: ClaimPayer;
  provider: ClaimProvider;
  diagnosisCodes: string[];
  priorAuthNumber?: string;
  serviceLines: ClaimServiceLine[];
  totalChargeCents: number;
}

/**
 * Build the service lines for a single trip. A one-way trip generates:
 *   line 1: base trip HCPCS with origin/destination modifier
 *   line 2: A0425 ground mileage, units = loaded miles
 */
export function buildServiceLines(
  trip: ClaimTripInput,
  startLineNumber = 1,
): ClaimServiceLine[] {
  const baseHcpcs = trip.overrideHcpcs ?? defaultHcpcsForMobility(trip.mobility);
  const locationModifier = buildOriginDestinationModifier(
    trip.originModifier,
    trip.destinationModifier,
  );
  const pos = trip.placeOfService ?? "99";
  const pointer = trip.diagnosisCodes.length > 0 ? "A" : "";

  const lines: ClaimServiceLine[] = [
    {
      lineNumber: startLineNumber,
      hcpcsCode: baseHcpcs,
      modifiers: [locationModifier],
      serviceDate: trip.serviceDate,
      placeOfService: pos,
      units: 1,
      chargeCents: trip.trunkChargeCents,
      diagnosisPointer: pointer,
    },
  ];

  if (trip.loadedMiles > 0 && trip.mileageChargeCents > 0) {
    lines.push({
      lineNumber: startLineNumber + 1,
      hcpcsCode: "A0425",
      modifiers: [locationModifier],
      serviceDate: trip.serviceDate,
      placeOfService: pos,
      units: Number(trip.loadedMiles.toFixed(1)),
      chargeCents: trip.mileageChargeCents,
      diagnosisPointer: pointer,
    });
  }

  return lines;
}

export function buildDraftClaim(params: {
  patient: ClaimPatient;
  payer: ClaimPayer;
  provider: ClaimProvider;
  diagnosisCodes: string[];
  trips: ClaimTripInput[];
}): DraftClaim {
  let lineNumber = 1;
  const serviceLines: ClaimServiceLine[] = [];

  for (const trip of params.trips) {
    const lines = buildServiceLines(trip, lineNumber);
    serviceLines.push(...lines);
    lineNumber += lines.length;
  }

  const totalChargeCents = serviceLines.reduce(
    (sum, line) => sum + line.chargeCents,
    0,
  );

  return {
    patient: params.patient,
    payer: params.payer,
    provider: params.provider,
    diagnosisCodes: params.diagnosisCodes,
    priorAuthNumber: params.trips.find((t) => t.priorAuthNumber)?.priorAuthNumber,
    serviceLines,
    totalChargeCents,
  };
}
