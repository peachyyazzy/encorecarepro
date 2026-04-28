import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/service";
import { logPhiAccess } from "@/lib/audit";

/**
 * Stripe webhook. Must verify the signature against the raw body — never
 * trust the payload without verification.
 *
 * Subscribe in the Stripe dashboard:
 *   payment_intent.succeeded
 *   payment_intent.payment_failed
 *   payment_intent.canceled
 *   checkout.session.completed
 *   charge.refunded
 *
 * Idempotency: every successfully-processed event id is recorded in
 * `webhook_events`. Duplicates short-circuit before doing any DB writes.
 *
 * Failure semantics: signature errors → 400 (Stripe stops retrying).
 * Internal errors → 500 so Stripe will retry. Successful and intentionally-
 * skipped events → 200.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${String(err)}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Idempotency: if we've already recorded this event id, skip processing.
  const dedup = await admin.from("webhook_events").insert({
    provider: "stripe",
    external_event_id: event.id,
    event_type: event.type,
    payload_summary: { type: event.type, livemode: event.livemode },
  });
  if (dedup.error) {
    if ((dedup.error as { code?: string }).code === "23505") {
      // Duplicate event — already handled.
      return NextResponse.json({ received: true, deduped: true });
    }
    // Couldn't even record the dedup row; return 500 so Stripe retries.
    console.error("[stripe webhook] dedup insert failed", dedup.error);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  try {
    await handleEvent(event, admin);
    return NextResponse.json({ received: true });
  } catch (err) {
    // Roll back the dedup row so the next retry can re-process this event.
    await admin
      .from("webhook_events")
      .delete()
      .eq("provider", "stripe")
      .eq("external_event_id", event.id);
    console.error("[stripe webhook] handler failed", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEvent(event: Stripe.Event, admin: AdminClient) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const tripId = pi.metadata?.trip_id;
      if (!tripId) return;

      // Don't resurrect a canceled trip — payment was for something else.
      const { data: tripRow } = await admin
        .from("trips")
        .select("status")
        .eq("id", tripId)
        .maybeSingle();
      const currentStatus = tripRow?.status as string | undefined;
      const advanceStatus =
        currentStatus === "requested" || currentStatus === "scheduled"
          ? "scheduled"
          : currentStatus;

      const { error: updErr } = await admin
        .from("trips")
        .update({
          payment_status: "paid",
          status: advanceStatus,
          stripe_payment_intent_id: pi.id,
        })
        .eq("id", tripId);
      if (updErr) throw updErr;

      const { error: payErr } = await admin.from("payments").insert({
        amount_cents: pi.amount_received,
        currency: (pi.currency ?? "usd").toUpperCase(),
        method: "card",
        stripe_payment_intent_id: pi.id,
        stripe_charge_id:
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : pi.latest_charge?.id ?? null,
        received_at: new Date().toISOString(),
      });
      if (payErr) throw payErr;

      await logPhiAccess({
        actorUserId: (pi.metadata?.user_id as string | undefined) ?? null,
        action: "payment_received",
        resourceType: "trip",
        resourceId: tripId,
        details: { amount_cents: pi.amount_received, payment_intent: pi.id },
      });
      return;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const tripId = pi.metadata?.trip_id;
      if (!tripId) return;
      const { error } = await admin
        .from("trips")
        .update({ payment_status: "failed" })
        .eq("id", tripId);
      if (error) throw error;
      return;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tripId = session.metadata?.trip_id;
      if (!tripId) return;
      if (typeof session.payment_intent === "string") {
        const { error } = await admin
          .from("trips")
          .update({ stripe_payment_intent_id: session.payment_intent })
          .eq("id", tripId);
        if (error) throw error;
      }
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!piId) return;
      const refunded = charge.amount_refunded >= charge.amount;
      const { error } = await admin
        .from("trips")
        .update({ payment_status: refunded ? "refunded" : "partially_refunded" })
        .eq("stripe_payment_intent_id", piId);
      if (error) throw error;
      return;
    }

    default:
      return;
  }
}
