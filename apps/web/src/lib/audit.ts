import { createAdminClient } from "./supabase/service";

export type PhiAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "payment_received"
  | "payment_attempt"
  | "claim_submit";

interface AuditEntry {
  actorUserId: string | null;
  actorRole?: string | null;
  action: PhiAction;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append a row to phi_access_log. The service role inserts so writes always
 * succeed regardless of caller. Failures are swallowed but logged — a missing
 * audit row should never block the user's actual request, but we want to know.
 */
export async function logPhiAccess(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("phi_access_log").insert({
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    details: entry.details ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });
  if (error) {
    // Don't throw; audit failures shouldn't break the request flow. Surface
    // them in server logs so an operator can investigate.
    console.error("[audit] failed to log", error.message, entry);
  }
}

/** Pull caller IP + user agent off a Request for audit context. */
export function requestContext(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
