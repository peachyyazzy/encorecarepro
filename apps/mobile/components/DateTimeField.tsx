import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

interface Props {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
}

export default function DateTimeField({ label, value, onChange, minimumDate }: Props) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const display = value
    ? value.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pick a date and time";

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.box} onPress={() => setShowDate(true)}>
        <Text style={[styles.boxText, !value && styles.placeholder]}>{display}</Text>
      </Pressable>

      {showDate && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          onChange={(_e, picked) => {
            setShowDate(false);
            if (!picked) return;
            const next = value ? new Date(value) : new Date();
            next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            onChange(next);
            // Chain into the time picker for a smooth flow on Android.
            if (Platform.OS !== "ios") setShowTime(true);
          }}
        />
      )}

      {showTime && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_e, picked) => {
            setShowTime(false);
            if (!picked) return;
            const next = value ? new Date(value) : new Date();
            next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            onChange(next);
          }}
        />
      )}

      {value && Platform.OS === "ios" && (
        <Pressable style={styles.timeButton} onPress={() => setShowTime(true)}>
          <Text style={styles.timeButtonText}>
            Change time: {value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  box: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 14, backgroundColor: "#fff",
  },
  boxText: { fontSize: 15, color: "#0f172a" },
  placeholder: { color: "#94a3b8" },
  timeButton: { marginTop: 8, paddingVertical: 8 },
  timeButtonText: { color: "#1158c7", fontSize: 13, fontWeight: "500" },
});
