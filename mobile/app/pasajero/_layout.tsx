import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { unreadAlerts, usePassenger, type Alerts } from "../../src/data/passenger";
import { colors } from "../../src/theme";
import type { IconName } from "../../src/ui/components";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Mi viaje", icon: "airplane-outline" },
  { name: "itinerario", title: "Itinerario", icon: "map-outline" },
  { name: "documentos", title: "Documentos", icon: "ticket-outline" },
  { name: "alertas", title: "Alertas", icon: "notifications-outline" },
  { name: "ayuda", title: "Ayuda", icon: "chatbubbles-outline" },
];

const HIDDEN: { name: string; title: string }[] = [
  { name: "comentar", title: "Comentar" },
  { name: "calificar", title: "Califica tu viaje" },
];

export default function PassengerTabs() {
  const alerts = usePassenger<Alerts>("alerts");
  const unread = unreadAlerts(alerts.data);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.fg3, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarStyle: { borderTopColor: colors.line } }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === "alertas" && unread > 0 ? unread : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.bad, color: colors.white, fontSize: 11 },
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={typeof color === "string" ? color : colors.fg3} />,
          }}
        />
      ))}
      {HIDDEN.map((screen) => (
        <Tabs.Screen key={screen.name} name={screen.name} options={{ href: null, title: screen.title, headerShown: true, headerTintColor: colors.accent, headerTitleStyle: { fontWeight: "700" } }} />
      ))}
    </Tabs>
  );
}
