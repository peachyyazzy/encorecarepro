import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider } from "../lib/auth";

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const MERCHANT_ID = process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID;

export default function RootLayout() {
  const content = (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </AuthProvider>
  );

  if (!STRIPE_KEY) return content;

  return (
    <StripeProvider
      publishableKey={STRIPE_KEY}
      merchantIdentifier={MERCHANT_ID}
      urlScheme="encorecare"
    >
      {content}
    </StripeProvider>
  );
}
