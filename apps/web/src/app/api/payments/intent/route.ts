import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { loadPayableTrip } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/service";

const inputSchema = z.object({
  tripId: z.string().uuid(),
});

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

/**
 * Mobile PaymentSheet flow. Creates (or re-uses) a PaymentIntent and an
 * ephemeral key for the customer. The mobile client passes these into
 * `initPaymentSheet`.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid input", details: String(err) },
      { status: 400, headers: corsHeaders() },
    );
  }

  const loaded = await loadPayableTrip(request, body.tripId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status, headers: corsHeaders() });
  }
  const { userId, trip } = loaded;

  const customerId = await ensureStripeCustomer(userId);

  let intent;
  if (trip.stripe_payment_intent_id) {
    intent = await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id);
  }

  if (!intent || intent.status === "canceled") {
    intent = await stripe.paymentIntents.create(
      {
        amount: trip.total_fare_cents,
        currency: "usd",
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: { trip_id: trip.id, user_id: userId },
        description: `Encore Care trip ${trip.id.slice(0, 8)}`,
      },
      { idempotencyKey: `pi:${trip.id}` },
    );
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2024-12-18.acacia" },
  );

  const admin = createAdminClient();
  await admin
    .from("trips")
    .update({
      stripe_payment_intent_id: intent.id,
      payment_status: "pending",
    })
    .eq("id", trip.id);

  return NextResponse.json(
    {
      paymentIntent: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    },
    { headers: corsHeaders() },
  );
}
