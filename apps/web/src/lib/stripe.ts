import Stripe from "stripe";
import { createAdminClient } from "./supabase/service";

/**
 * Server-only Stripe client. Uses the secret key; never import from a client
 * component. Pinned API version — update deliberately.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
  appInfo: {
    name: "Encore Care NEMT",
    version: "0.1.0",
  },
});

/**
 * Look up or create a Stripe customer for the given profile. Caches the
 * customer id on profiles.stripe_customer_id so we don't duplicate.
 */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("email, first_name, last_name, phone, stripe_customer_id")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new Error(`profile lookup failed: ${error?.message ?? "not found"}`);
  }
  if (profile.stripe_customer_id) return profile.stripe_customer_id as string;

  const customer = await stripe.customers.create(
    {
      email: profile.email as string,
      name: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
      phone: (profile.phone as string | null) ?? undefined,
      metadata: { user_id: userId },
    },
    { idempotencyKey: `customer:${userId}` },
  );

  await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}
