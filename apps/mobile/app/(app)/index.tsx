import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>Where are you going?</Text>
        <Text style={styles.h2}>Book a medical ride in just a few taps.</Text>

        <TouchableOpacity
          style={styles.primary}
          onPress={() => router.push("/book/new")}
        >
          <Text style={styles.primaryText}>Book a trip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => router.push("/schedules")}
        >
          <Text style={styles.secondaryText}>Set a weekly schedule</Text>
          <Text style={styles.secondarySub}>Dialysis, PT, infusions — book it once.</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How billing works</Text>
          <Text style={styles.infoBody}>
            Private pay? You&apos;ll get a claim-ready receipt you can submit
            to your plan or HSA. On a Medicaid or MCO care plan? We submit the
            claim for you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: "700", color: "#0f172a", marginTop: 12 },
  h2: { fontSize: 15, color: "#475569", marginTop: 4, marginBottom: 24 },
  primary: {
    backgroundColor: "#1158c7", borderRadius: 14, paddingVertical: 18,
    alignItems: "center", marginBottom: 12,
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  secondary: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20,
  },
  secondaryText: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  secondarySub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  infoCard: {
    backgroundColor: "#eef7ff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#d9ecff",
  },
  infoTitle: { fontSize: 14, fontWeight: "600", color: "#0d47a3" },
  infoBody: { fontSize: 13, color: "#1e3a8a", marginTop: 6, lineHeight: 18 },
});
