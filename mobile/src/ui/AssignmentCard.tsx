import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { dayLabel, STATUS } from "../format";
import { colors, font, space } from "../theme";
import type { Assignment } from "../types";
import { Card, Pill } from "./components";

export function AssignmentCard({ assignment, showDay = false }: { assignment: Assignment; showDay?: boolean }) {
  const router = useRouter();
  const status = STATUS[assignment.status];
  const pax = assignment.passengers.length;

  return (
    <Card onPress={() => router.push(`/servicio/${assignment.id}`)} accessibilityLabel={`${assignment.label}, ${status.label}`}>
      <View style={styles.top}>
        <View style={styles.time}>
          <Text style={styles.hour}>{assignment.time ?? "—"}</Text>
          {showDay ? <Text style={styles.day}>{dayLabel(assignment.date)}</Text> : null}
        </View>
        <View style={styles.main}>
          <Text style={styles.label} numberOfLines={2}>
            {assignment.label}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {assignment.order.code} · {pax} {pax === 1 ? "pasajero" : "pasajeros"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.fg3} />
      </View>
      {assignment.meeting_point ? (
        <View style={styles.line}>
          <Ionicons name="location-outline" size={15} color={colors.accent} />
          <Text style={styles.lineText} numberOfLines={2}>
            {assignment.pickup?.applies ? "Recojo: " : ""}
            {assignment.meeting_point.text}
            {assignment.pickup?.applies && assignment.pickup.flight ? ` · vuelo ${assignment.pickup.flight}` : ""}
          </Text>
        </View>
      ) : assignment.pickup?.flight ? (
        <View style={styles.line}>
          <Ionicons name="airplane-outline" size={15} color={colors.accent} />
          <Text style={styles.lineText}>Vuelo {assignment.pickup.flight}</Text>
        </View>
      ) : null}
      {assignment.pickup?.comments ? (
        <View style={styles.line}>
          <Ionicons name="chatbox-ellipses-outline" size={15} color={colors.warn} />
          <Text style={[styles.lineText, { color: colors.warn }]} numberOfLines={2}>
            {assignment.pickup.comments}
          </Text>
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Pill label={status.label} tone={status.tone} />
        {assignment.vehicle ? <Pill label={assignment.vehicle} icon="car-outline" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  time: { width: 64, alignItems: "flex-start" },
  hour: { fontSize: 20, fontWeight: "800", color: colors.accent },
  day: { fontSize: font.tiny, color: colors.fg3, textTransform: "capitalize" },
  main: { flex: 1, gap: 2 },
  label: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  meta: { fontSize: font.small, color: colors.fg2 },
  bottom: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  lineText: { flex: 1, fontSize: font.small, color: colors.fg2 },
});
