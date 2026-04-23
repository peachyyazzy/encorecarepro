import { NextResponse } from "next/server";
import { validators, geo } from "@encorecare/shared";
import { getAuthUser } from "@/lib/supabase/auth-user";

/**
 * Proxies Google Distance Matrix. Only lat/lng is sent to Google — no PHI.
 * Both web and mobile call this. Mobile sends the Supabase access token as
 * a Bearer header so we can authenticate and rate-limit per user.
 *
 * NOTE on CORS: the mobile app runs on a different origin (or native), so
 * we include permissive CORS headers. Tighten to your app origins in prod.
 */

const GOOGLE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const authed = await getAuthUser(request);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  let body: ReturnType<typeof validators.distanceQuerySchema.parse>;
  try {
    body = validators.distanceQuerySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid input", details: String(err) },
      { status: 400, headers: corsHeaders() },
    );
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    // Fall back to haversine if the key isn't configured yet — keeps dev working.
    const result = geo.haversineDistance(body.origin, body.destination);
    return NextResponse.json(result, { headers: corsHeaders() });
  }

  const params = new URLSearchParams({
    origins: `${body.origin.latitude},${body.origin.longitude}`,
    destinations: `${body.destination.latitude},${body.destination.longitude}`,
    units: "imperial",
    key,
    ...(body.departAt && {
      departure_time: Math.floor(body.departAt.getTime() / 1000).toString(),
    }),
  });

  try {
    const res = await fetch(`${GOOGLE_URL}?${params.toString()}`, {
      // Google Maps responses aren't personal to a user, but don't cache
      // long — traffic conditions change. Edge runtimes will cache anyway.
      cache: "no-store",
    });
    const json = (await res.json()) as {
      rows?: Array<{
        elements?: Array<{
          status: string;
          distance?: { value: number };
          duration?: { value: number };
          duration_in_traffic?: { value: number };
        }>;
      }>;
      status?: string;
      error_message?: string;
    };

    const element = json.rows?.[0]?.elements?.[0];
    if (json.status !== "OK" || !element || element.status !== "OK") {
      const fallback = geo.haversineDistance(body.origin, body.destination);
      return NextResponse.json(
        { ...fallback, warning: json.error_message ?? element?.status ?? "no_route" },
        { headers: corsHeaders() },
      );
    }

    const distanceMeters = element.distance?.value ?? 0;
    const durationSeconds =
      element.duration_in_traffic?.value ?? element.duration?.value ?? 0;

    const result: geo.DistanceResult = {
      distanceMeters,
      distanceMiles: geo.metersToMiles(distanceMeters),
      durationSeconds,
      source: "google",
    };
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (err) {
    const fallback = geo.haversineDistance(body.origin, body.destination);
    return NextResponse.json(
      { ...fallback, warning: `google_failed: ${String(err)}` },
      { headers: corsHeaders() },
    );
  }
}
