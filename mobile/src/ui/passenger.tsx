import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { PaxService, Remote, Stay } from "../data/passenger";
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

export function ServiceCard({ service, showDay = false, expandable = false }: { service: PaxService; showDay?: boolean; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const guide = contactName(service.guide ?? null);
  const driver = contactName(service.driver ?? null);
  const languages = service.guide_languages && service.guide_languages.length > 0 ? ` (${service.guide_languages.join(", ").toUpperCase()})` : "";
  const body = (
    <>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={KIND_ICON[service.kind] ?? "ticket-outline"} size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{service.name}</Text>
          <Text style={styles.meta}>{[showDay ? dayLabel(service.date) : null, service.time, service.nights ? `${service.nights} noches` : null].filter(Boolean).join(" · ")}</Text>
          {!open && (guide || driver || service.vehicle) ? <Text style={styles.meta}>{[guide ? `Guía: ${guide}` : null, driver ? `Conductor: ${driver}` : null, service.vehicle].filter(Boolean).join(" · ")}</Text> : null}
          {!expandable && service.meeting_point ? <Text style={styles.meta}>Encuentro: {service.meeting_point}</Text> : null}
          {!expandable && service.confirmation ? <Text style={styles.meta}>Código de confirmación: {service.confirmation}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Pill label={service.state.replace("_", " ")} tone={STATE_TONE[service.state] ?? "mute"} />
          {expandable ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.fg3} /> : null}
        </View>
      </View>
      {open ? (
        <View style={styles.detail}>
          {service.meeting_point ? <Detail icon="location-outline" label="Punto de encuentro" value={service.meeting_point} /> : null}
          {service.provider ? <Detail icon="business-outline" label="Proveedor" value={[service.provider.name, service.confirmation ? `código ${service.confirmation}` : null].filter(Boolean).join(" · ")} phone={service.provider.phone} /> : null}
          {!service.provider && service.confirmation ? <Detail icon="key-outline" label="Código de confirmación" value={service.confirmation} /> : null}
          {guide ? <Detail icon="person-outline" label="Guía" value={`${guide}${languages}`} /> : null}
          {driver || service.vehicle ? <Detail icon="bus-outline" label="Transporte" value={[driver, service.vehicle].filter(Boolean).join(" · ")} /> : null}
          {service.includes && service.includes.length > 0 ? <Detail icon="checkmark-circle-outline" label="Incluye" value={service.includes.join(" · ")} /> : null}
          {!service.meeting_point && !service.provider && !guide && !driver ? <Text style={styles.meta}>Tu agencia completará estos datos al confirmar el servicio.</Text> : null}
        </View>
      ) : null}
    </>
  );
  if (!expandable) return <Card>{body}</Card>;
  return (
    <Card onPress={() => setOpen((value) => !value)} accessibilityLabel={`${service.name}, ver detalle`}>
      {body}
    </Card>
  );
}

function Detail({ icon, label, value, phone }: { icon: "location-outline" | "business-outline" | "key-outline" | "person-outline" | "bus-outline" | "checkmark-circle-outline"; label: string; value: string; phone?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
      {phone ? (
        <Pressable onPress={() => void Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`)} accessibilityRole="button" accessibilityLabel={`Llamar a ${label}`} hitSlop={8}>
          <Ionicons name="call-outline" size={18} color={colors.link} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StayLine({ stay }: { stay: Stay }) {
  return (
    <View style={styles.stay}>
      <Ionicons name="bed-outline" size={16} color={colors.fg2} />
      <Text style={styles.stayText}>
        Noche en {stay.hotel}
        {stay.room ? ` · habitación ${stay.room}` : ""}
      </Text>
    </View>
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
  detail: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm, gap: space.sm },
  detailRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  detailLabel: { fontSize: font.tiny, color: colors.fg3, fontWeight: "600" },
  detailValue: { fontSize: font.small, color: colors.fg },
  stay: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm },
  stayText: { fontSize: font.small, color: colors.fg2 },
});
