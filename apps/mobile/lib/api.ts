import { supabase } from "./supabase";
import type { geo } from "@encorecare/shared";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function authedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchDistance(
  origin: geo.Coordinates,
  destination: geo.Coordinates,
  departAt?: Date,
): Promise<geo.DistanceResult> {
  const res = await authedFetch("/api/geo/distance", {
    method: "POST",
    body: JSON.stringify({ origin, destination, departAt }),
  });
  if (!res.ok) throw new Error(`distance ${res.status}`);
  return res.json();
}
