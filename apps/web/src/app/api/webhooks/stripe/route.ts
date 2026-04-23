import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/service";

/**
 * Stripe webhook. Must verify the signature against the raw body — never
 * trust the payload without verification.
 *
 * Subscribe these events in the Stripe dashboard (or via Stripe CLI):
 *   payment_intent.succeeded
 *   payment_intent.payment_failed
 *   payment_intent.canceled
 *   charge.refunded
 *   checkout.session.completed   (useful when Checkout is the payment entrypoint)
 */

// Stripe requires the raw body; disable Next.js body parsing.
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

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const tripId = pi.metadata?.trip_id;
      if (!tripId) break;

      await admin
        .from("trips")
        .update({
          payment_status: "paid",
          status: "scheduled", // move trip out of requested now that it's paid
          stripe_payment_intent_id: pi.id,
        })
        .eq("id", tripId);

      // Record the payment row for ledger/reconciliation.
      await admin.from("payments").insert({
        amount_cents: pi.amount_received,
        currency: (pi.currency ?? "usd").toUpperCase(),
        method: "card",
        stripe_payment_intent_id: pi.id,
        stripe_charge_id:
          typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null,
        received_at: new Date().toISOString(),
      });

      await admin.from("phi_access_log").insert({
        actor_user_id: pi.metadata?.user_id ?? null,
        action: "payment_received",
        resource_type: "trip",
        resource_id: tripId,
        details: { amount_cents: pi.amount_received, payment_intent: pi.id },
      });
      break;
    }

    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const tripId = pi.metadata?.trip_id;
      if (!tripId) break;
      await admin
        .from("trips")
        .update({ payment_status: "failed" })
        .eq("id", tripId);
      break;
    }

    case "checkout.session.completed": {
      // Backup path — succeed may fire first from payment_intent, so this is
      // mostly redundant. Still handy if you enable Checkout-only flows.
      const session = event.data.object as Stripe.Checkout.Session;
      const tripId = session.metadata?.trip_id;
      if (!tripId) break;
      if (typeof session.payment_intent === "string") {
        await admin
          .from("trips")
          .update({ stripe_payment_intent_id: session.payment_intent })
          .eq("id", tripId);
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!piId) break;
      const refunded = charge.amount_refunded >= charge.amount;
      await admin
        .from("trips")
        .update({ payment_status: refunded ? "refunded" : "partially_refunded" })
        .eq("stripe_payment_intent_id", piId);
      break;
    }

    default:
      // Ignore everything we haven't subscribed to yet.
      break;
  }

  return NextResponse.json({ received: true });
}
