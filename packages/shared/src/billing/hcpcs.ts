/**
 * NEMT HCPCS codes and modifiers. These are the billing codes that appear on
 * invoices and 837P claims. Verify against your state Medicaid fee schedule
 * before going live — rates and covered codes vary.
 */

export type MobilityType =
  | "ambulatory"
  | "wheelchair"
  | "wheelchair_power"
  | "stretcher"
  | "bariatric";

export interface HcpcsCode {
  code: string;
  description: string;
  unit: "trip" | "mile" | "hour";
  mobility: MobilityType[];
}

export const HCPCS: Record<string, HcpcsCode> = {
  A0080: {
    code: "A0080",
    description: "Non-emergency transport, no vested interest, volunteer",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0090: {
    code: "A0090",
    description: "Non-emergency transport, vested interest, volunteer",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0100: {
    code: "A0100",
    description: "Non-emergency transport, taxi",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0110: {
    code: "A0110",
    description: "Non-emergency transport, bus, intra- or inter-state carrier",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0120: {
    code: "A0120",
    description: "Non-emergency transport, mini-bus, mountain area transports, or other transportation systems",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0130: {
    code: "A0130",
    description: "Non-emergency transport, wheelchair van",
    unit: "trip",
    mobility: ["wheelchair", "wheelchair_power"],
  },
  A0140: {
    code: "A0140",
    description: "Non-emergency transport, air travel (private or commercial) intra- or inter-state",
    unit: "trip",
    mobility: ["ambulatory", "wheelchair", "stretcher"],
  },
  A0160: {
    code: "A0160",
    description: "Non-emergency transport, per mile, case worker or social worker",
    unit: "mile",
    mobility: ["ambulatory"],
  },
  A0170: {
    code: "A0170",
    description: "Transport parking fees, tolls, other",
    unit: "trip",
    mobility: ["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"],
  },
  A0180: {
    code: "A0180",
    description: "Non-emergency transport, ancillary: lodging, recipient",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0200: {
    code: "A0200",
    description: "Non-emergency transport, ancillary: lodging, escort",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  A0425: {
    code: "A0425",
    description: "Ground mileage, per statute mile",
    unit: "mile",
    mobility: ["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"],
  },
  A0428: {
    code: "A0428",
    description: "Ambulance service, basic life support, non-emergency transport (BLS)",
    unit: "trip",
    mobility: ["stretcher"],
  },
  A0999: {
    code: "A0999",
    description: "Unlisted ambulance service",
    unit: "trip",
    mobility: ["stretcher"],
  },
  T2001: {
    code: "T2001",
    description: "Non-emergency transportation; patient attendant/escort",
    unit: "trip",
    mobility: ["ambulatory", "wheelchair", "wheelchair_power", "stretcher", "bariatric"],
  },
  T2003: {
    code: "T2003",
    description: "Non-emergency transportation; encounter/trip",
    unit: "trip",
    mobility: ["ambulatory"],
  },
  T2005: {
    code: "T2005",
    description: "Non-emergency transportation; stretcher van",
    unit: "trip",
    mobility: ["stretcher"],
  },
};

/**
 * CMS HCPCS origin/destination modifiers. The first char describes pickup,
 * second char describes drop-off. Sent concatenated on the 837P line.
 */
export const LOCATION_MODIFIERS = {
  D: "Diagnostic or therapeutic site (non-P, non-H)",
  E: "Residential, domiciliary, custodial facility",
  G: "Hospital-based dialysis facility",
  H: "Hospital",
  I: "Transfer between modes of ambulance transport",
  J: "Non-hospital based dialysis facility",
  N: "Skilled nursing facility",
  P: "Physician's office",
  R: "Residence",
  S: "Scene of accident or acute event",
  X: "Destination only — intermediate stop at physician's office",
} as const;

export type LocationModifier = keyof typeof LOCATION_MODIFIERS;

/**
 * Pick the most likely HCPCS code for a trip given mobility needs. Override
 * at the org or state level as needed.
 */
export function defaultHcpcsForMobility(mobility: MobilityType): string {
  switch (mobility) {
    case "ambulatory":
      return "A0100";
    case "wheelchair":
    case "wheelchair_power":
      return "A0130";
    case "stretcher":
      return "T2005";
    case "bariatric":
      return "A0130";
  }
}

export function buildOriginDestinationModifier(
  origin: LocationModifier,
  destination: LocationModifier,
): string {
  return `${origin}${destination}`;
}
