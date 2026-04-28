import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function AppLayout() {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  const isDriver = role === "driver";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1158c7",
        headerStyle: { backgroundColor: "#fff" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Book", href: isDriver ? null : "/(app)" }}
      />
      <Tabs.Screen
        name="manifest"
        options={{ title: "Today", href: isDriver ? "/(app)/manifest" : null }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: isDriver ? "History" : "Trips" }}
      />
      <Tabs.Screen
        name="schedules"
        options={{ title: "Schedules", href: isDriver ? null : "/(app)/schedules" }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
