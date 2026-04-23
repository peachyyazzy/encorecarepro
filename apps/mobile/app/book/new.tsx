import { useEffect, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "../../lib/supabase";
import { fetchDistance, createTripPaymentIntent } from "../../lib/api";
import PlacesAutocomplete from "../../components/PlacesAutocomplete";
import { billing, MOBILITY_LABELS, type PayerType, geo } from "@encorecare/shared";

type Mobility = keyof typeof MOBILITY_LABELS;

export default function NewBookingScreen() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const [pickup, setPickup] = useState<geo.ResolvedAddress | null>(null);
  const [dropoff, setDropoff] = useState<geo.ResolvedAddress | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [mobility, setMobility] = useState<Mobility>("ambulatory");
  const [roundTrip, setRoundTrip] = useState(false);
  const [needsAttendant, setNeedsAttendant] = useState(false);
  const [payerType, setPayerType] = useState<PayerType>("private_pay");
  const [distance, setDistance] = useState<geo.DistanceResult | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setDistance(null);
      return;
    }
    let cancelled = false;
    setDistanceLoading(true);
    fetchDistance(
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: dropoff.latitude, longitude: dropoff.longitude },
      dateTime ? new Date(dateTime) : undefined,
    )
      .then((d) => {
        if (!cancelled) setDistance(d);
      })
      .catch(() => {
        if (!cancelled) setDistance(null);
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, dateTime]);

  const estimate =
    distance && payerType === "private_pay"
      ? billing.quotePrivatePay({
          mobility,
          loadedMiles: distance.distanceMiles,
          needsAttendant,
          scheduledPickupAt: dateTime ? new Date(dateTime) : new Date(),
          roundTrip,
        })
      : null;

  async function book() {
    if (!pickup || !dropoff || !dateTime) {
      Alert.alert("Missing info", "Pick both addresses from the suggestions and set a pickup time.");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert("Not signed in");
      return;
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!patient) {
      setLoading(false);
      Alert.alert(
        "Add patient info first",
        "We need a few details about the rider before booking (name, DOB, mobility).",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add details", onPress: () => router.push("/profile/patients") },
        ],
      );
      return;
    }

    const insertAddress = async (a: geo.ResolvedAddress) => {
      const { data } = await supabase
        .from("addresses")
        .insert({
          owner_id: user.id,
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          state: a.state.toUpperCase(),
          postal_code: a.postalCode,
          country: a.country.toUpperCase(),
          latitude: a.latitude,
          longitude: a.longitude,
          place_id: a.placeId,
        })
        .select("id")
        .single();
      return data?.id;
    };

    const pickupId = await insertAddress(pickup);
    const dropoffId = await insertAddress(dropoff);

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        patient_id: patient.id,
        booked_by_user_id: user.id,
        trip_type: roundTrip ? "round_trip" : "one_way",
        status: "requested",
        scheduled_pickup_at: new Date(dateTime).toISOString(),
        pickup_address_id: pickupId,
        dropoff_address_id: dropoffId,
        mobility,
        needs_attendant: needsAttendant,
        payer_type: payerType,
        hcpcs_code: billing.defaultHcpcsForMobility(mobility),
        loaded_miles: distance?.distanceMiles ?? null,
        base_fare_cents: estimate?.baseFareCents ?? null,
        mileage_fare_cents: estimate?.mileageFareCents ?? null,
        total_fare_cents: estimate?.totalCents ?? null,
      })
      .select("id")
      .single();

    if (error || !trip) {
      setLoading(false);
      Alert.alert("Booking failed", error?.message ?? "unknown error");
      return;
    }

    // Private-pay trips pay now via Stripe PaymentSheet. Other payer types
    // skip straight to the trips list — we bill the payer later.
    if (payerType === "private_pay" && estimate && estimate.totalCents > 0) {
      const ok = await runPaymentSheet(trip.id as string);
      setLoading(false);
      if (ok) {
        Alert.alert("Payment received", "Your trip is scheduled.", [
          { text: "OK", onPress: () => router.replace("/(app)/trips") },
        ]);
      } else {
        Alert.alert(
          "Payment incomplete",
          "Your trip is saved. Tap it from Trips to finish paying.",
          [{ text: "OK", onPress: () => router.replace("/(app)/trips") }],
        );
      }
      return;
    }

    setLoading(false);
    Alert.alert("Trip booked", "We'll assign a driver and text you an update.", [
      { text: "OK", onPress: () => router.replace("/(app)/trips") },
    ]);
  }

  async function runPaymentSheet(tripId: string): Promise<boolean> {
    try {
      const params = await createTripPaymentIntent(tripId);
      const init = await initPaymentSheet({
        merchantDisplayName: "Encore Care NEMT",
        customerId: params.customer,
        customerEphemeralKeySecret: params.ephemeralKey,
        paymentIntentClientSecret: params.paymentIntent,
        allowsDelayedPaymentMethods: false,
        returnURL: "encorecare://pay/return",
        applePay: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID
          ? { merchantCountryCode: "US" }
          : undefined,
        googlePay: {
          merchantCountryCode: "US",
          currencyCode: "USD",
          testEnv: __DEV__,
        },
      });
      if (init.error) {
        Alert.alert("Couldn't start checkout", init.error.message);
        return false;
      }
      const result = await presentPaymentSheet();
      if (result.error) {
        if (result.error.code !== "Canceled") {
          Alert.alert("Payment failed", result.error.message);
        }
        return false;
      }
      return true;
    } catch (err) {
      Alert.alert("Payment error", String(err));
      return false;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>New trip</Text>

        <View style={{ zIndex: 30 }}>
          <PlacesAutocomplete
            label="Pickup address"
            placeholder="123 Main St"
            value={pickup}
            onChange={setPickup}
          />
        </View>
        <View style={{ zIndex: 20, marginTop: 16 }}>
          <PlacesAutocomplete
            label="Drop-off address"
            placeholder="Clinic or hospital"
            value={dropoff}
            onChange={setDropoff}
          />
        </View>

        <Label>Pickup date &amp; time</Label>
        <TextInput
          style={styles.input}
          placeholder="2026-05-01T09:00"
          value={dateTime}
          onChangeText={setDateTime}
        />

        <Label>Mobility</Label>
        <View style={styles.chips}>
          {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
            <TouchableOpacity
              key={k}
              style={[styles.chip, mobility === k && styles.chipActive]}
              onPress={() => setMobility(k as Mobility)}
            >
              <Text style={[styles.chipText, mobility === k && styles.chipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Toggle label="Round trip" value={roundTrip} onChange={setRoundTrip} />
        <Toggle label="Attendant needed" value={needsAttendant} onChange={setNeedsAttendant} />

        <Label>How will this trip be paid?</Label>
        <View style={styles.chips}>
          {[
            { k: "private_pay", v: "Private pay" },
            { k: "medicaid", v: "Medicaid" },
            { k: "mco", v: "MCO" },
            { k: "waiver_program", v: "Waiver" },
            { k: "va", v: "VA" },
          ].map(({ k, v }) => (
            <TouchableOpacity
              key={k}
              style={[styles.chip, payerType === k && styles.chipActive]}
              onPress={() => setPayerType(k as PayerType)}
            >
              <Text style={[styles.chipText, payerType === k && styles.chipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <QuoteCard
          distance={distance}
          loading={distanceLoading}
          estimate={estimate}
          payerType={payerType}
        />

        <TouchableOpacity style={styles.primary} onPress={book} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? "Booking…" : "Book trip"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuoteCard({
  distance,
  loading,
  estimate,
  payerType,
}: {
  distance: geo.DistanceResult | null;
  loading: boolean;
  estimate: ReturnType<typeof billing.quotePrivatePay> | null;
  payerType: PayerType;
}) {
  if (loading) {
    return (
      <View style={styles.quoteCard}>
        <ActivityIndicator />
        <Text style={styles.quoteLine}>Calculating route…</Text>
      </View>
    );
  }
  if (!distance) {
    return (
      <View style={[styles.quoteCard, { borderStyle: "dashed" }]}>
        <Text style={styles.quoteLine}>Pick both addresses to see distance and a fare estimate.</Text>
      </View>
    );
  }
  return (
    <View style={styles.quoteCard}>
      <Text style={styles.quoteLabel}>Route</Text>
      <Text style={styles.quoteRoute}>
        {distance.distanceMiles.toFixed(1)} mi · {Math.round(distance.durationSeconds / 60)} min
      </Text>
      {distance.source === "haversine" && (
        <Text style={styles.quoteWarn}>
          Estimated straight-line distance. Sign in with Google Maps enabled for road data.
        </Text>
      )}
      {estimate && (
        <>
          <Text style={[styles.quoteLabel, { marginTop: 8 }]}>Private-pay fare</Text>
          <Text style={styles.quotePrice}>{billing.formatCents(estimate.totalCents)}</Text>
          {estimate.breakdown.map((line, i) => (
            <Text key={i} style={styles.quoteLine}>{line}</Text>
          ))}
        </>
      )}
      {!estimate && payerType !== "private_pay" && (
        <Text style={styles.quoteNote}>
          Care-plan trip — billed to your payer, $0 to you if covered.
        </Text>
      )}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Toggle({
  label, value, onChange,
}: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, backgroundColor: "#fff",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1",
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: "#1158c7", borderColor: "#1158c7" },
  chipText: { color: "#475569", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12,
  },
  toggleLabel: { fontSize: 15, color: "#0f172a" },
  quoteCard: {
    marginTop: 20, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  quoteLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", textTransform: "uppercase" },
  quoteRoute: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  quotePrice: { fontSize: 26, fontWeight: "700", color: "#0f172a", marginVertical: 4 },
  quoteLine: { fontSize: 12, color: "#64748b", marginTop: 2 },
  quoteWarn: { fontSize: 11, color: "#b45309", marginTop: 4 },
  quoteNote: { fontSize: 12, color: "#1158c7", marginTop: 8, fontStyle: "italic" },
  primary: {
    marginTop: 24, backgroundColor: "#1158c7", borderRadius: 14, paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
