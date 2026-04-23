import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TRIP_STATUS_LABELS, type TripStatus } from "@encorecare/shared";
import { supabase } from "../../lib/supabase";

interface TripRow {
  id: string;
  status: TripStatus;
  scheduled_pickup_at: string;
  trip_type: string;
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("trips")
      .select("id, status, scheduled_pickup_at, trip_type")
      .order("scheduled_pickup_at", { ascending: false })
      .limit(50);
    setTrips((data as TripRow[] | null) ?? []);
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
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trips yet. Tap “Book” to get started.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.when}>
              {new Date(item.scheduled_pickup_at).toLocaleString()}
            </Text>
            <Text style={styles.status}>{TRIP_STATUS_LABELS[item.status]}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  list: { padding: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  when: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  status: { fontSize: 13, color: "#64748b", marginTop: 4 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#64748b" },
});
