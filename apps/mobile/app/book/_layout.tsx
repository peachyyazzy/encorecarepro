import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function BookLayout() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="new" options={{ title: "New trip" }} />
    </Stack>
  );
}
