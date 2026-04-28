import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ScheduleRow {
  id: string;
  label: string;
  pickup_time_local: string;
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  active: boolean;
}

export default function SchedulesScreen() {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("recurring_schedules")
      .select("id, label, pickup_time_local, days_of_week, start_date, end_date, active")
      .order("created_at", { ascending: false });
    setSchedules((data as ScheduleRow[] | null) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <FlatList
        data={schedules}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.h1}>Recurring schedules</Text>
            <Text style={styles.body}>
              Standing trips materialize 30 days ahead automatically. Manage
              them on the web for now — mobile creation is coming soon.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recurring schedules yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={[styles.badge, !item.active && styles.badgePaused]}>
                {item.active ? "Active" : "Paused"}
              </Text>
            </View>
            <Text style={styles.meta}>{item.pickup_time_local}</Text>
            <View style={styles.days}>
              {DAY_LABELS.map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.day,
                    (item.days_of_week ?? []).includes(i) && styles.dayActive,
                  ]}
                >
                  {d}
                </Text>
              ))}
            </View>
            <Text style={styles.range}>
              {item.start_date}
              {item.end_date ? ` → ${item.end_date}` : " → indefinite"}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  list: { padding: 16 },
  header: { marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  body: { fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 18 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#64748b" },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  label: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  badge: {
    fontSize: 11, fontWeight: "600", color: "#065f46",
    backgroundColor: "#d1fae5", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
    overflow: "hidden",
  },
  badgePaused: { color: "#475569", backgroundColor: "#e2e8f0" },
  days: { flexDirection: "row", gap: 4, marginTop: 10 },
  day: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontSize: 11,
    color: "#94a3b8", backgroundColor: "#f1f5f9", overflow: "hidden",
  },
  dayActive: { color: "#1158c7", backgroundColor: "#eef7ff" },
  range: { fontSize: 11, color: "#94a3b8", marginTop: 8 },
});
