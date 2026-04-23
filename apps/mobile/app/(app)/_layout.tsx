import { Tabs, Redirect } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1158c7",
        headerStyle: { backgroundColor: "#fff" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Book" }} />
      <Tabs.Screen name="trips" options={{ title: "Trips" }} />
      <Tabs.Screen name="schedules" options={{ title: "Schedules" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
