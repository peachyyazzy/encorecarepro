import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [session]);

  function confirmSignOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.name}>
          {profile ? `${profile.first_name} ${profile.last_name}` : "…"}
        </Text>
        <Text style={styles.meta}>{profile?.email}</Text>
        {profile?.role && profile.role !== "rider" && (
          <Text style={styles.roleTag}>{profile.role.replace("_", " ")}</Text>
        )}

        <View style={styles.section}>
          <SectionTitle>Account</SectionTitle>
          <Row label="Email" value={profile?.email ?? "—"} />
          {profile?.phone && <Row label="Phone" value={profile.phone} />}
        </View>

        <View style={styles.section}>
          <SectionTitle>Coming soon on mobile</SectionTitle>
          <Row label="Manage patients" muted />
          <Row label="Insurance & payer info" muted />
          <Row label="Saved addresses" muted />
          <Row label="Payment methods" muted />
          <Text style={styles.helper}>
            For now, ride history and trip booking work end-to-end. Patient
            and insurance management is on the facility web portal.
          </Text>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({ label, value, muted }: { label: string; value?: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && styles.rowMuted]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20 },
  name: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginTop: 12 },
  meta: { fontSize: 14, color: "#64748b", marginTop: 4 },
  roleTag: {
    alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 8, paddingVertical: 2,
    fontSize: 11, fontWeight: "600", color: "#1158c7", backgroundColor: "#eef7ff",
    borderRadius: 4, textTransform: "capitalize", overflow: "hidden",
  },
  section: { marginTop: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase",
    marginBottom: 8, letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 0,
    borderBottomWidth: 0,
  },
  rowLabel: { fontSize: 14, color: "#0f172a" },
  rowMuted: { color: "#94a3b8" },
  rowValue: { fontSize: 13, color: "#475569" },
  helper: { marginTop: 12, fontSize: 12, color: "#64748b", lineHeight: 18 },
  signOut: { marginTop: 32, padding: 16, alignItems: "center" },
  signOutText: { color: "#dc2626", fontWeight: "600" },
});
