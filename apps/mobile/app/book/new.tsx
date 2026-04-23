import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { billing, MOBILITY_LABELS, type PayerType } from "@encorecare/shared";

type Mobility = keyof typeof MOBILITY_LABELS;

export default function NewBookingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // For v1 we capture plain address strings. v2 will use Places autocomplete
  // and Distance Matrix to compute loaded_miles and a real quote.
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [mobility, setMobility] = useState<Mobility>("ambulatory");
  const [roundTrip, setRoundTrip] = useState(false);
  const [needsAttendant, setNeedsAttendant] = useState(false);
  const [payerType, setPayerType] = useState<PayerType>("private_pay");

  // Rough placeholder quote — replace with Distance Matrix call + pricing engine.
  const estimate = billing.quotePrivatePay({
    mobility,
    loadedMiles: 8,
    needsAttendant,
    scheduledPickupAt: dateTime ? new Date(dateTime) : new Date(),
    roundTrip,
  });

  async function book() {
    if (!pickupAddress || !dropoffAddress || !dateTime) {
      Alert.alert("Missing info", "Fill in pickup, drop-off, and date/time.");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert("Not signed in");
      return;
    }

    // Look up or create the patient record tied to this user
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

    const { data: pickup } = await supabase
      .from("addresses")
      .insert({ owner_id: user.id, line1: pickupAddress, city: "", state: "NY", postal_code: "" })
      .select("id").single();
    const { data: dropoff } = await supabase
      .from("addresses")
      .insert({ owner_id: user.id, line1: dropoffAddress, city: "", state: "NY", postal_code: "" })
      .select("id").single();

    const { error } = await supabase.from("trips").insert({
      patient_id: patient.id,
      booked_by_user_id: user.id,
      trip_type: roundTrip ? "round_trip" : "one_way",
      status: "requested",
      scheduled_pickup_at: new Date(dateTime).toISOString(),
      pickup_address_id: pickup?.id,
      dropoff_address_id: dropoff?.id,
      mobility,
      needs_attendant: needsAttendant,
      payer_type: payerType,
      hcpcs_code: billing.defaultHcpcsForMobility(mobility),
    });

    setLoading(false);
    if (error) {
      Alert.alert("Booking failed", error.message);
      return;
    }
    Alert.alert("Trip booked", "We'll assign a driver and text you an update.", [
      { text: "OK", onPress: () => router.replace("/(app)/trips") },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>New trip</Text>

        <Label>Pickup address</Label>
        <TextInput
          style={styles.input}
          placeholder="123 Main St, City, NY"
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />

        <Label>Drop-off address</Label>
        <TextInput
          style={styles.input}
          placeholder="Clinic / hospital address"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
        />

        <Label>Pickup date & time</Label>
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

        <View style={styles.quoteCard}>
          <Text style={styles.quoteTitle}>Estimate</Text>
          <Text style={styles.quotePrice}>{billing.formatCents(estimate.totalCents)}</Text>
          {estimate.breakdown.map((line, i) => (
            <Text key={i} style={styles.quoteLine}>{line}</Text>
          ))}
          {payerType !== "private_pay" && (
            <Text style={styles.quoteNote}>
              For care-plan trips, we bill your payer directly. You&apos;ll see $0 if covered.
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.primary} onPress={book} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? "Booking…" : "Book trip"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  quoteTitle: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  quotePrice: { fontSize: 28, fontWeight: "700", color: "#0f172a", marginVertical: 4 },
  quoteLine: { fontSize: 12, color: "#64748b", marginTop: 2 },
  quoteNote: { fontSize: 12, color: "#1158c7", marginTop: 8, fontStyle: "italic" },
  primary: {
    marginTop: 24, backgroundColor: "#1158c7", borderRadius: 14, paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
