import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "../../src/theme";
import type { IconName } from "../../src/ui/components";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Mi viaje", icon: "airplane-outline" },
  { name: "itinerario", title: "Itinerario", icon: "map-outline" },
  { name: "documentos", title: "Documentos", icon: "ticket-outline" },
  { name: "alertas", title: "Alertas", icon: "notifications-outline" },
  { name: "ayuda", title: "Ayuda", icon: "chatbubbles-outline" },
];

export default function PassengerTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.fg3, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarStyle: { borderTopColor: colors.line } }}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={typeof color === "string" ? color : colors.fg3} /> }} />
      ))}
    </Tabs>
  );
}
