import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { PaxService, Remote } from "../data/passenger";
import { contactName } from "../data/passenger";
import { dayLabel } from "../format";
import { colors, font, radius, space, type Tone } from "../theme";
import { Card, Empty, Pill } from "./components";

const KIND_ICON: Record<string, "bed-outline" | "bus-outline" | "walk-outline" | "restaurant-outline" | "airplane-outline" | "ticket-outline"> = {
  alojamiento: "bed-outline",
  traslado: "bus-outline",
  transporte: "bus-outline",
  tour: "walk-outline",
  alimentacion: "restaurant-outline",
  vuelo: "airplane-outline",
};

const STATE_TONE: Record<string, Tone> = { confirmado: "ok", completado: "ok", en_curso: "sun", pendiente: "warn", solicitado: "warn", cancelado: "bad" };

export function ServiceCard({ service, showDay = false }: { service: PaxService; showDay?: boolean }) {
  const guide = contactName(service.guide ?? null);
  const driver = contactName(service.driver ?? null);
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={KIND_ICON[service.kind] ?? "ticket-outline"} size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.meta}>
            {[showDay ? dayLabel(service.date) : null, service.time, service.nights ? `${service.nights} noches` : null].filter(Boolean).join(" · ")}
          </Text>
          {guide || driver || service.vehicle ? <Text style={styles.meta}>{[guide ? `Guía: ${guide}` : null, driver ? `Conductor: ${driver}` : null, service.vehicle].filter(Boolean).join(" · ")}</Text> : null}
          {service.confirmation ? <Text style={styles.meta}>Código de confirmación: {service.confirmation}</Text> : null}
        </View>
        <Pill label={service.state.replace("_", " ")} tone={STATE_TONE[service.state] ?? "mute"} />
      </View>
    </Card>
  );
}

export function RemoteState<T>({ remote, empty }: { remote: Remote<T>; empty: string }) {
  if (remote.data) {
    return remote.stale ? <Text style={styles.stale}>Sin conexión: estás viendo la última información guardada.</Text> : null;
  }
  if (remote.loading) return <Text style={styles.meta}>Cargando…</Text>;
  return <Empty icon="cloud-offline-outline" title={remote.error ?? empty} text="Desliza hacia abajo para intentar de nuevo." />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.control, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  name: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  meta: { fontSize: font.small, color: colors.fg2 },
  stale: { fontSize: font.small, color: colors.warn, fontWeight: "600" },
});
