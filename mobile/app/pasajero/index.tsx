import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePassenger, type Trip } from "../../src/data/passenger";
import { dayLabel, tripLabel } from "../../src/format";
import { colors, font, radius, space } from "../../src/theme";
import { Card, Screen, SectionTitle, styles as ui } from "../../src/ui/components";
import { RemoteState, ServiceCard } from "../../src/ui/passenger";

export default function TripScreen() {
  const router = useRouter();
  const trip = usePassenger<Trip>("trip");
  const data = trip.data;

  return (
    <Screen onRefresh={() => void trip.reload()} refreshing={trip.loading}>
      <RemoteState remote={trip} empty="No pudimos cargar tu viaje" />
      {data ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.code}>{data.code}</Text>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.phase}>{tripLabel(data)}</Text>
            <Text style={styles.dates}>
              {dayLabel(data.from)} al {dayLabel(data.to)}
            </Text>
          </View>

          {data.alerts > 0 ? (
            <Pressable onPress={() => router.push("/pasajero/alertas")} accessibilityRole="button" style={styles.alert}>
              <Ionicons name="alert-circle" size={20} color={colors.bad} />
              <Text style={styles.alertText}>
                {data.alerts} alerta{data.alerts === 1 ? "" : "s"} de tu viaje
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.bad} />
            </Pressable>
          ) : null}

          {data.next ? (
            <>
              <SectionTitle title="Próxima actividad" aside={dayLabel(data.next.date)} />
              <ServiceCard service={data.next} />
            </>
          ) : null}

          {data.today_services.length > 0 ? (
            <>
              <SectionTitle title="Hoy" />
              {data.today_services.map((service) => (
                <ServiceCard key={service.code} service={service} />
              ))}
            </>
          ) : null}

          <View style={styles.quick}>
            <Quick icon="map-outline" label="Itinerario" onPress={() => router.push("/pasajero/itinerario")} />
            <Quick icon="ticket-outline" label="Vouchers" onPress={() => router.push("/pasajero/documentos")} />
            <Quick icon="chatbubbles-outline" label="Chat" onPress={() => router.push("/pasajero/ayuda")} />
            <Quick icon="call-outline" label="Emergencia" onPress={() => router.push("/pasajero/ayuda")} />
          </View>

          <SectionTitle title="Viajeros" aside={`${data.passengers.length}`} />
          <Card>
            {data.passengers.map((passenger) => (
              <View key={passenger.seq} style={styles.pax}>
                <Text style={[ui.body, { flex: 1 }]}>
                  {passenger.name}
                  {passenger.lead ? "  · titular" : ""}
                </Text>
                {passenger.missing ? <Text style={styles.missing}>Faltan datos</Text> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Quick({ icon, label, onPress }: { icon: "map-outline" | "ticket-outline" | "chatbubbles-outline" | "call-outline"; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.side, borderRadius: 20, padding: space.lg, gap: 4 },
  code: { fontSize: font.tiny, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 0.5 },
  title: { fontSize: font.title, fontWeight: "800", color: colors.white },
  phase: { fontSize: font.body, fontWeight: "700", color: colors.sun, marginTop: space.sm },
  dates: { fontSize: font.small, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" },
  alert: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.badSoft, borderRadius: radius.control, padding: space.md },
  alertText: { flex: 1, fontSize: font.body, fontWeight: "700", color: colors.bad },
  quick: { flexDirection: "row", gap: space.sm },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: space.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  quickLabel: { fontSize: font.tiny, fontWeight: "700", color: colors.fg2 },
  pax: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  missing: { fontSize: font.small, color: colors.warn, fontWeight: "600" },
});
