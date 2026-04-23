import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [session]);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.name}>
          {profile ? `${profile.first_name} ${profile.last_name}` : "…"}
        </Text>
        <Text style={styles.meta}>{profile?.email}</Text>

        <View style={styles.section}>
          <Row label="Patients" onPress={() => router.push("/profile/patients")} />
          <Row label="Insurance & payer info" onPress={() => router.push("/profile/insurance")} />
          <Row label="Saved addresses" onPress={() => router.push("/profile/addresses")} />
          <Row label="Payment methods" onPress={() => router.push("/profile/payment")} />
        </View>

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20 },
  name: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginTop: 12 },
  meta: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 24 },
  section: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 15, color: "#0f172a" },
  chev: { fontSize: 20, color: "#94a3b8" },
  signOut: { marginTop: 24, padding: 16, alignItems: "center" },
  signOutText: { color: "#dc2626", fontWeight: "600" },
});
