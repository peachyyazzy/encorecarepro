/**
 * Claim-ready invoice (superbill). For private-pay riders this is the receipt
 * they submit to their payer, HSA, or care plan. Even for billed-claim riders,
 * we generate an invoice copy for their records.
 */

import type { LocationModifier, MobilityType } from "./hcpcs";
import { defaultHcpcsForMobility } from "./hcpcs";

export interface InvoiceTrip {
  tripId: string;
  serviceDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:MM local
  dropoffTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  mobility: MobilityType;
  loadedMiles: number;
  originModifier: LocationModifier;
  destinationModifier: LocationModifier;
  driverName: string;
  vehicleDescription: string;
  vehicleLicensePlate?: string;
  baseFareCents: number;
  mileageFareCents: number;
  extrasCents: number;
  totalCents: number;
  hcpcsCode?: string;
}

export interface InvoiceBuildInput {
  invoiceNumber: string;
  issuedAt: Date;
  provider: {
    legalName: string;
    doingBusinessAs?: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
    email: string;
    taxId?: string;
    npi?: string;
  };
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    memberId?: string;
    payerName?: string;
  };
  trips: InvoiceTrip[];
  billedTo: {
    name: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    email?: string;
  };
  notes?: string;
}

export interface InvoiceLineItem {
  description: string;
  hcpcsCode: string;
  modifiers: string[];
  serviceDate: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Invoice {
  invoiceNumber: string;
  issuedAt: Date;
  provider: InvoiceBuildInput["provider"];
  patient: InvoiceBuildInput["patient"];
  billedTo: InvoiceBuildInput["billedTo"];
  lines: InvoiceLineItem[];
  subtotalCents: number;
  totalCents: number;
  notes?: string;
}

export function buildInvoice(input: InvoiceBuildInput): Invoice {
  const lines: InvoiceLineItem[] = [];

  for (const trip of input.trips) {
    const hcpcs = trip.hcpcsCode ?? defaultHcpcsForMobility(trip.mobility);
    const modifier = `${trip.originModifier}${trip.destinationModifier}`;

    lines.push({
      description: `NEMT transport — ${trip.pickupAddress} → ${trip.dropoffAddress}`,
      hcpcsCode: hcpcs,
      modifiers: [modifier],
      serviceDate: trip.serviceDate,
      quantity: 1,
      unitPriceCents: trip.baseFareCents,
      totalCents: trip.baseFareCents,
    });

    if (trip.loadedMiles > 0 && trip.mileageFareCents > 0) {
      lines.push({
        description: "Ground mileage (loaded)",
        hcpcsCode: "A0425",
        modifiers: [modifier],
        serviceDate: trip.serviceDate,
        quantity: Number(trip.loadedMiles.toFixed(1)),
        unitPriceCents: Math.round(trip.mileageFareCents / Math.max(trip.loadedMiles, 0.1)),
        totalCents: trip.mileageFareCents,
      });
    }

    if (trip.extrasCents > 0) {
      lines.push({
        description: "Ancillary services (attendant / oxygen / wait)",
        hcpcsCode: "A0170",
        modifiers: [modifier],
        serviceDate: trip.serviceDate,
        quantity: 1,
        unitPriceCents: trip.extrasCents,
        totalCents: trip.extrasCents,
      });
    }
  }

  const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);

  return {
    invoiceNumber: input.invoiceNumber,
    issuedAt: input.issuedAt,
    provider: input.provider,
    patient: input.patient,
    billedTo: input.billedTo,
    lines,
    subtotalCents,
    totalCents: subtotalCents,
    notes: input.notes,
  };
}

/** Sequential invoice number in format ECP-YYYY-NNNNNN */
export function formatInvoiceNumber(year: number, sequence: number): string {
  return `ECP-${year}-${sequence.toString().padStart(6, "0")}`;
}
