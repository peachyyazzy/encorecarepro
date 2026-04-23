import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./generated";

export type AppSupabaseClient = SupabaseClient<Database>;

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Browser/mobile client — uses anon key; RLS enforces access.
 * Do NOT pass the service role key to any client.
 */
export function createAnonClient(
  env: SupabaseEnv,
  options?: { persistSession?: boolean; storage?: unknown },
): AppSupabaseClient {
  return createClient<Database>(env.url, env.anonKey, {
    auth: {
      persistSession: options?.persistSession ?? true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(options?.storage ? { storage: options.storage as never } : {}),
    },
  });
}

/**
 * Server-side admin client — uses service role key. Bypasses RLS.
 * Use only in trusted backend routes (claims submission, invoice generation).
 */
export function createServiceClient(url: string, serviceKey: string): AppSupabaseClient {
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type { Database } from "./generated";
