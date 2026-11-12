import { useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getIncidents } from "../../src/data/repository";
import { INCIDENT_STATUS, SEVERITY_TONE, sinceLabel } from "../../src/format";
import { useLocal } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import type { Incident } from "../../src/types";
import { Button, Card, Empty, Pill, Screen, SectionTitle } from "../../src/ui/components";

const OPEN = ["abierta", "en_proceso"];

export default function IncidentsScreen() {
  const router = useRouter();
  const incidents = useLocal(useCallback(() => getIncidents(), []), [] as Incident[]);
  const open = incidents.filter((incident) => OPEN.includes(incident.status));
  const closed = incidents.filter((incident) => !OPEN.includes(incident.status));

  return (
    <Screen>
      <Button label="Reportar incidencia" icon="warning-outline" variant="danger" onPress={() => router.push("/incidencia/nueva")} />
      <SectionTitle title="Abiertas" aside={`${open.length}`} />
      {open.length === 0 ? <Empty icon="shield-checkmark-outline" title="Sin incidencias abiertas" text="Las de tus órdenes o las que reportes aparecerán aquí." /> : open.map((incident) => <IncidentCard key={incident.code} incident={incident} />)}
      {closed.length > 0 ? <SectionTitle title="Resueltas" aside={`${closed.length}`} /> : null}
      {closed.map((incident) => (
        <IncidentCard key={incident.code} incident={incident} />
      ))}
    </Screen>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.code}>{incident.code}</Text>
        <Pill label={incident.severity === "critica" ? "Crítica" : incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)} tone={SEVERITY_TONE[incident.severity] ?? "mute"} />
      </View>
      <Text style={styles.title}>{incident.title}</Text>
      <Text style={styles.meta}>
        {[incident.type, incident.order, INCIDENT_STATUS[incident.status] ?? incident.status, sinceLabel(incident.created_at)].filter(Boolean).join(" · ")}
        {incident.related ? " · vinculada a otra parecida" : ""}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  code: { fontSize: font.small, fontWeight: "700", color: colors.fg3 },
  title: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  meta: { fontSize: font.small, color: colors.fg2 },
});
