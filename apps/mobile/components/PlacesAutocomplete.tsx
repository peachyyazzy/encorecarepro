import { View, Text, StyleSheet } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { geo } from "@encorecare/shared";

type ResolvedAddress = geo.ResolvedAddress;

interface Props {
  label: string;
  placeholder?: string;
  value: ResolvedAddress | null;
  onChange: (address: ResolvedAddress | null) => void;
}

/**
 * Mobile Places autocomplete. Uses the public EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 * — restrict that key to your iOS bundle ID + Android package name in the
 * Google Cloud Console so it can't be reused off-device.
 *
 * HIPAA: nothing patient-identifying is sent to Google. Only the typed query.
 */
export default function PlacesAutocomplete({ label, placeholder, value, onChange }: Props) {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return (
      <View style={styles.missing}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.warn}>
          Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to enable address autocomplete.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ zIndex: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <GooglePlacesAutocomplete
        placeholder={placeholder ?? value?.formattedAddress ?? "Search address…"}
        minLength={3}
        fetchDetails
        enablePoweredByContainer={false}
        onPress={(_data, details) => {
          if (!details) return;
          const components = (details.address_components ?? []).map((c) => ({
            types: c.types,
            short_name: c.short_name,
            long_name: c.long_name,
          }));
          const parts = geo.parseAddressComponents(components);
          const resolved: ResolvedAddress = {
            placeId: details.place_id,
            formattedAddress: details.formatted_address ?? "",
            ...parts,
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
          };
          onChange(resolved);
        }}
        query={{
          key,
          language: "en",
          components: "country:us",
          types: "address",
        }}
        textInputProps={{
          onChangeText: (t) => {
            if (value && t !== value.formattedAddress) onChange(null);
          },
        }}
        styles={{
          textInput: styles.input,
          listView: styles.list,
          row: styles.row,
          description: styles.desc,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, backgroundColor: "#fff",
  },
  list: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 },
  row: { padding: 12 },
  desc: { color: "#0f172a", fontSize: 14 },
  missing: { padding: 12, backgroundColor: "#fef3c7", borderRadius: 8 },
  warn: { color: "#92400e", fontSize: 12 },
});
