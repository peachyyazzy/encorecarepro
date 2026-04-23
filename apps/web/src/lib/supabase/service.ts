import { createServiceClient } from "@encorecare/database";

/**
 * Server-only admin client. Bypasses RLS. Use ONLY inside API routes that
 * have already authenticated the caller and verified their authority to run
 * a specific backend job (claim submission, invoice generation, etc.).
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Admin client is server-only");
  }
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
