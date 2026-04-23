/**
 * Geo types shared by web + mobile. Actual Places / Distance Matrix calls
 * happen in apps (with the right API key restrictions).
 *
 * HIPAA note: never send patient names or member IDs to Google. Only send
 * street addresses and coordinates. Google does NOT sign a BAA.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedAddress extends Coordinates {
  placeId: string;
  formattedAddress: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;      // 2-char USPS code
  postalCode: string;
  country: string;    // ISO-2
}

export interface DistanceResult {
  distanceMeters: number;
  distanceMiles: number;
  durationSeconds: number;
  source: "google" | "haversine";
}

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Great-circle distance in meters. Used as a fallback when Distance Matrix
 * is unavailable, or for sanity-checking payer-submitted miles.
 * Not a replacement for road distance — undershoots by 10-30%.
 */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function haversineDistance(a: Coordinates, b: Coordinates): DistanceResult {
  const distanceMeters = haversineMeters(a, b);
  return {
    distanceMeters,
    distanceMiles: metersToMiles(distanceMeters),
    durationSeconds: Math.round((distanceMeters / 1609.344) * 90), // ~40mph avg
    source: "haversine",
  };
}

/**
 * Parse Google Places address components into the flat shape we persist.
 * Accepts the Places API (New) shape; callers adapt as needed.
 */
export function parseAddressComponents(
  components: Array<{ types: string[]; short_name?: string; long_name?: string; shortText?: string; longText?: string }>,
): Pick<ResolvedAddress, "line1" | "city" | "state" | "postalCode" | "country"> {
  const get = (type: string, prefer: "short" | "long" = "long") => {
    const c = components.find((x) => x.types.includes(type));
    if (!c) return "";
    if (prefer === "short") {
      return c.short_name ?? c.shortText ?? c.long_name ?? c.longText ?? "";
    }
    return c.long_name ?? c.longText ?? c.short_name ?? c.shortText ?? "";
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  const city =
    get("locality") ||
    get("postal_town") ||
    get("sublocality_level_1") ||
    get("administrative_area_level_2");
  const state = get("administrative_area_level_1", "short");
  const postalCode = get("postal_code");
  const country = get("country", "short");
  return { line1, city, state, postalCode, country };
}
