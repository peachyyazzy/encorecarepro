/**
 * PLACEHOLDER — regenerate with `pnpm db:types` once Supabase CLI is linked
 * to the project. For now we expose loose types so apps can compile.
 *
 * Run:
 *   supabase login
 *   supabase link --project-ref <ref>
 *   pnpm db:types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
}
