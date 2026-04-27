import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-user";

const patchSchema = z.object({
  active: z.boolean().optional(),
  endDate: z.string().nullable().optional(),
  skipDates: z.array(z.string()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getAuthUser(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (body.data.active !== undefined) update.active = body.data.active;
  if (body.data.endDate !== undefined) update.end_date = body.data.endDate;
  if (body.data.skipDates !== undefined) update.skip_dates = body.data.skipDates;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("recurring_schedules")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await getAuthUser(request);
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Soft delete via active=false. We don't hard-delete because there may be
  // already-materialized future trips referencing this row, and we keep an
  // audit trail of canceled schedules.
  const { error } = await supabase
    .from("recurring_schedules")
    .update({ active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
