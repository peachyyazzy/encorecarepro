import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { trips as tripFsm, TRIP_STATUS_LABELS, type TripStatus, MOBILITY_LABELS } from "@encorecare/shared";
import { supabase } from "../../lib/supabase";
import { authedFetch } from "../../lib/api";

interface DriverTrip {
  id: string;
  status: TripStatus;
  scheduled_pickup_at: string;
  mobility: keyof typeof MOBILITY_LABELS;
  needs_attendant: boolean;
  needs_oxygen: boolean;
  special_instructions: string | null;
  patient: { first_name: string; last_name: string } | null;
  pickup: { line1: string; city: string; state: string } | null;
  dropoff: { line1: string; city: string; state: string } | null;
}

export default function ManifestScreen() {
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: driverRow } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!driverRow) {
      setTrips([]);
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(startOfToday);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);

    const { data } = await supabase
      .from("trips")
      .select(`
        id, status, scheduled_pickup_at, mobility, needs_attendant,
        needs_oxygen, special_instructions,
        patient:patients(first_name, last_name),
        pickup:addresses!trips_pickup_address_id_fkey(line1, city, state),
        dropoff:addresses!trips_dropoff_address_id_fkey(line1, city, state)
      `)
      .eq("assigned_driver_id", driverRow.id as string)
      .gte("scheduled_pickup_at", startOfToday.toISOString())
      .lt("scheduled_pickup_at", endOfTomorrow.toISOString())
      .order("scheduled_pickup_at");

    setTrips(((data ?? []) as unknown) as DriverTrip[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Refresh whenever the tab comes back into focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function transition(trip: DriverTrip, to: TripStatus) {
    setActingId(trip.id);
    try {
      const res = await authedFetch(`/api/trips/${trip.id}/status`, {
        method: "POST",
        body: JSON.stringify({ to }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert("Couldn't update", body.error ?? "Try again.");
        return;
      }
      await load();
    } catch (err) {
      Alert.alert("Network error", String(err));
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={["bottom"]} style={[styles.safe, { justifyContent: "center" }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.h1}>Today&apos;s manifest</Text>
            <Text style={styles.sub}>
              {trips.length} {trips.length === 1 ? "trip" : "trips"} assigned to you.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trips assigned yet. Pull down to refresh.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const next = tripFsm.nextStatusesFor(item.status, {
            role: "driver",
            isAssignedDriver: true,
          });
          const primary = next[0];
          return (
            <View style={styles.card}>
              <Text style={styles.time}>
                {new Date(item.scheduled_pickup_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={styles.patient}>
                {item.patient?.last_name}, {item.patient?.first_name}
              </Text>
              <Text style={styles.address}>
                {item.pickup?.line1}, {item.pickup?.city}
              </Text>
              <Text style={styles.address}>
                → {item.dropoff?.line1}, {item.dropoff?.city}
              </Text>
              <View style={styles.tags}>
                <Tag>{MOBILITY_LABELS[item.mobility]}</Tag>
                {item.needs_attendant && <Tag>Attendant</Tag>}
                {item.needs_oxygen && <Tag>Oxygen</Tag>}
              </View>
              {item.special_instructions && (
                <Text style={styles.notes}>{item.special_instructions}</Text>
              )}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>{TRIP_STATUS_LABELS[item.status]}</Text>
                {primary && (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => transition(item, primary)}
                    disabled={actingId === item.id}
                  >
                    <Text style={styles.actionText}>
                      {actingId === item.id ? "…" : tripFsm.driverActionLabel(primary)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {next.length > 1 && (
                <View style={styles.secondaryActions}>
                  {next.slice(1).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.secondaryAction}
                      onPress={() => transition(item, s)}
                      disabled={actingId === item.id}
                    >
                      <Text style={styles.secondaryActionText}>
                        {tripFsm.driverActionLabel(s)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  list: { padding: 16 },
  header: { marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 13, color: "#475569", marginTop: 4 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#64748b" },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  time: { fontSize: 18, fontWeight: "700", color: "#1158c7" },
  patient: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginTop: 4 },
  address: { fontSize: 13, color: "#475569", marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { backgroundColor: "#eef2ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: "#3730a3", fontSize: 11, fontWeight: "600" },
  notes: { fontSize: 12, color: "#92400e", marginTop: 8, fontStyle: "italic" },
  statusRow: {
    marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  statusLabel: { fontSize: 13, color: "#64748b" },
  action: { backgroundColor: "#1158c7", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondaryActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  secondaryAction: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  secondaryActionText: { color: "#475569", fontSize: 12, fontWeight: "500" },
});
