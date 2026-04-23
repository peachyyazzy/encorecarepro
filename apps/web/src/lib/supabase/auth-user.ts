import { createClient } from "@supabase/supabase-js";
import type { Database } from "@encorecare/database";
import { createSupabaseServerClient } from "./server";

/**
 * Resolve the current user from either:
 *   (a) the SSR cookie (web, facility portal)
 *   (b) an `Authorization: Bearer <supabase_access_token>` header (mobile)
 *
 * Returns { userId } on success, or null when unauthenticated.
 */
export async function getAuthUser(request: Request): Promise<{ userId: string } | null> {
  // Prefer cookie session first (web)
  const ssr = await createSupabaseServerClient();
  const cookieUser = await ssr.auth.getUser();
  if (cookieUser.data.user) return { userId: cookieUser.data.user.id };

  // Fall back to Bearer (mobile)
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);

  const bearerClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await bearerClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}
