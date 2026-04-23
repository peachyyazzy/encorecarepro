import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, ensureStripeCustomer } from "@/lib/stripe";
import { loadPayableTrip } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/service";

const inputSchema = z.object({
  tripId: z.string().uuid(),
});

/**
 * Creates a Stripe Checkout Session for a private-pay trip. Web redirects
 * the browser to `url`. Idempotent via `trip:<id>` key so re-posting won't
 * double-create.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof inputSchema>;
  try {
    body = inputSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid input", details: String(err) }, { status: 400 });
  }

  const loaded = await loadPayableTrip(request, body.tripId);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const { userId, trip } = loaded;

  // If we already have a session, return the same one (idempotency guard
  // that also works across restarts).
  if (trip.stripe_checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(trip.stripe_checkout_session_id);
    if (existing.status === "open" && existing.url) {
      return NextResponse.json({ url: existing.url });
    }
  }

  const customerId = await ensureStripeCustomer(userId);
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: trip.total_fare_cents,
            product_data: {
              name: "Encore Care — medical transport",
              description: `Pickup ${new Date(trip.scheduled_pickup_at).toLocaleString()}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/pay/success?trip_id=${trip.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pay/canceled?trip_id=${trip.id}`,
      metadata: { trip_id: trip.id, user_id: userId },
      payment_intent_data: {
        metadata: { trip_id: trip.id, user_id: userId },
      },
    },
    { idempotencyKey: `checkout:${trip.id}` },
  );

  const admin = createAdminClient();
  await admin
    .from("trips")
    .update({
      stripe_checkout_session_id: session.id,
      payment_status: "pending",
    })
    .eq("id", trip.id);

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
