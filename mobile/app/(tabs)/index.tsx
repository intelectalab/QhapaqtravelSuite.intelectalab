import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getIncidents, getMe, listAssignments } from "../../src/data/repository";
import { todayIso } from "../../src/format";
import { useApp, useLocal } from "../../src/state/AppProvider";
import { colors, font, radius, space } from "../../src/theme";
import type { Assignment, Incident, OperatorMe } from "../../src/types";
import { AssignmentCard } from "../../src/ui/AssignmentCard";
import { Empty, Screen, SectionTitle, styles as ui } from "../../src/ui/components";
import { SyncBanner } from "../../src/ui/SyncBanner";

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function TodayScreen() {
  const { sync } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const me = useLocal(useCallback(() => getMe(), []), null as OperatorMe | null);
  const assignments = useLocal(useCallback(() => listAssignments(), []), [] as Assignment[]);
  const incidents = useLocal(useCallback(() => getIncidents(), []), [] as Incident[]);

  const today = todayIso();
  const active = assignments.filter((assignment) => assignment.status !== "cancelada");
  const todays = active.filter((assignment) => assignment.date === today);
  const upcoming = active.filter((assignment) => assignment.date > today);
  const recent = active.filter((assignment) => assignment.date < today).slice(-2).reverse();
  const toConfirm = active.filter((assignment) => assignment.can.confirm).length;
  const critical = incidents.find((incident) => incident.severity === "critica" && !["resuelta", "cerrada"].includes(incident.status));

  async function refresh() {
    setRefreshing(true);
    await sync().catch(() => undefined);
    setRefreshing(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.hero}>
        <Text style={styles.hello}>
          {greeting(new Date().getHours())}
          {me ? `, ${me.name.split(" ")[0]}` : ""}
        </Text>
        <Text style={styles.role}>{me ? `${me.role} · ${me.code}` : "Cargando tus servicios"}</Text>
        <View style={styles.counters}>
          <Counter value={todays.length} label="Hoy" />
          <Counter value={upcoming.length} label="Próximos" />
          <Counter value={toConfirm} label="Por confirmar" highlight={toConfirm > 0} />
        </View>
      </View>

      <SyncBanner />

      {critical ? (
        <View style={styles.alert}>
          <Ionicons name="alert-circle" size={20} color={colors.bad} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Incidencia crítica abierta</Text>
            <Text style={ui.subtitle}>
              {critical.code} · {critical.title}
            </Text>
          </View>
        </View>
      ) : null}

      <SectionTitle title="Hoy" aside={`${todays.length} servicio${todays.length === 1 ? "" : "s"}`} />
      {todays.length === 0 ? <Empty icon="sunny-outline" title="Sin servicios para hoy" text="Desliza hacia abajo para buscar cambios de tu agencia." /> : todays.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}

      {upcoming.length > 0 ? (
        <>
          <SectionTitle title="Próximos" aside={`${upcoming.length}`} />
          {upcoming.slice(0, 5).map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} showDay />
          ))}
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionTitle title="Recientes" />
          {recent.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} showDay />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Counter({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.counter, highlight && styles.counterHighlight]}>
      <Text style={[styles.counterValue, highlight && { color: colors.sunFg }]}>{value}</Text>
      <Text style={[styles.counterLabel, highlight && { color: colors.sunFg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.side, borderRadius: 20, padding: space.lg, gap: space.xs },
  hello: { fontSize: font.title, fontWeight: "800", color: colors.white },
  role: { fontSize: font.small, color: "rgba(255,255,255,0.7)" },
  counters: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  counter: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.control, paddingVertical: space.md, alignItems: "center" },
  counterHighlight: { backgroundColor: colors.sun },
  counterValue: { fontSize: 24, fontWeight: "800", color: colors.white },
  counterLabel: { fontSize: font.tiny, color: "rgba(255,255,255,0.75)", fontWeight: "600" },
  alert: { flexDirection: "row", gap: space.sm, alignItems: "center", backgroundColor: colors.badSoft, borderRadius: radius.control, padding: space.md },
  alertTitle: { fontSize: font.body, fontWeight: "700", color: colors.bad },
});
