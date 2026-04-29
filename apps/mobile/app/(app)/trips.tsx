import { useEffect, useState } from "react";
import {
  Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TRIP_STATUS_LABELS, type TripStatus } from "@encorecare/shared";
import { supabase } from "../../lib/supabase";
import { generateInvoiceUrl } from "../../lib/api";

interface TripRow {
  id: string;
  status: TripStatus;
  scheduled_pickup_at: string;
  trip_type: string;
  total_fare_cents: number | null;
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("trips")
      .select("id, status, scheduled_pickup_at, trip_type, total_fare_cents")
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

  async function openReceipt(trip: TripRow) {
    setBusyId(trip.id);
    try {
      const url = await generateInvoiceUrl(trip.id);
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert("Couldn't open receipt", String(err));
    } finally {
      setBusyId(null);
    }
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
        renderItem={({ item }) => {
          const completed = item.status === "completed";
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.when}>
                  {new Date(item.scheduled_pickup_at).toLocaleString()}
                </Text>
                <Text style={styles.status}>{TRIP_STATUS_LABELS[item.status]}</Text>
              </View>
              {completed && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.receiptBtn}
                    onPress={() => openReceipt(item)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.receiptBtnText}>
                      {busyId === item.id ? "Preparing…" : "Get receipt"}
                    </Text>
                  </TouchableOpacity>
                  {item.total_fare_cents != null && (
                    <Text style={styles.amount}>
                      ${(item.total_fare_cents / 100).toFixed(2)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        }}
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  when: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  status: { fontSize: 12, color: "#64748b" },
  cardActions: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  receiptBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6,
    borderWidth: 1, borderColor: "#1158c7",
  },
  receiptBtnText: { color: "#1158c7", fontSize: 13, fontWeight: "600" },
  amount: { fontSize: 13, color: "#475569", fontWeight: "500" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#64748b" },
});
