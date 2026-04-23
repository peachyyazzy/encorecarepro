import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SchedulesScreen() {
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>Recurring schedules</Text>
        <Text style={styles.body}>
          Coming next: book a weekly schedule (dialysis, physical therapy,
          infusions) and we&apos;ll generate every trip automatically.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginTop: 12 },
  body: { fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 20 },
});
