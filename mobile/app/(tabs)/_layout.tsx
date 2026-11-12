import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { IconName } from "../../src/ui/components";
import { colors } from "../../src/theme";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Hoy", icon: "today-outline" },
  { name: "calendario", title: "Calendario", icon: "calendar-outline" },
  { name: "incidencias", title: "Incidencias", icon: "warning-outline" },
  { name: "perfil", title: "Perfil", icon: "person-circle-outline" },
];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.fg3, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarStyle: { borderTopColor: colors.line } }}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={typeof color === "string" ? color : colors.fg3} /> }} />
      ))}
    </Tabs>
  );
}
