import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { contactName, usePassenger, type Support, type Trip } from "../../src/data/passenger";
import { countdownLabel, dayLabel, tripLabel } from "../../src/format";
import { colors, font, radius, space } from "../../src/theme";
import { Card, Screen, SectionTitle, styles as ui, type IconName } from "../../src/ui/components";
import { RemoteState, ServiceCard } from "../../src/ui/passenger";

export default function TripScreen() {
  const router = useRouter();
  const trip = usePassenger<Trip>("trip");
  const support = usePassenger<Support>("support");
  const data = trip.data;
  const next = data?.next_detail ?? null;
  const hotel = data?.hotel ?? null;
  const emergency = support.data?.emergency?.phone ?? null;
  const guide = next ? contactName(next.guide ?? null) : null;

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
              {dayLabel(data.from)} al {dayLabel(data.to)} · {data.passengers.length} {data.passengers.length === 1 ? "viajero" : "viajeros"}
            </Text>
          </View>

          {data.critical_alert ? (
            <Pressable onPress={() => router.push("/pasajero/alertas")} accessibilityRole="button" style={styles.alert}>
              <View style={styles.alertTop}>
                <Ionicons name="alert-circle" size={20} color={colors.bad} />
                <Text style={styles.alertTitle}>{data.critical_alert.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.bad} />
              </View>
              {data.critical_alert.message ? <Text style={styles.alertBody}>{data.critical_alert.message}</Text> : null}
              {data.alerts > 1 ? <Text style={styles.alertMore}>{data.alerts - 1 === 1 ? "Tienes otro aviso sin leer" : `Tienes ${data.alerts - 1} avisos más sin leer`}</Text> : null}
            </Pressable>
          ) : null}

          {next ? (
            <>
              <SectionTitle title="Próxima actividad" aside={countdownLabel(next.starts_at)} />
              <Card>
                <Text style={styles.strong}>{next.name}</Text>
                <Text style={styles.meta}>
                  {dayLabel(next.date)} · {next.time}
                </Text>
                {next.meeting_point ? <Line icon="location-outline" text={next.meeting_point} /> : null}
                {guide ? <Line icon="person-outline" text={`Guía: ${guide}${next.guide_languages?.length ? ` (${next.guide_languages.join(", ").toUpperCase()})` : ""}`} /> : null}
              </Card>
            </>
          ) : null}

          {hotel ? (
            <Card>
              <View style={styles.hotel}>
                <View style={styles.hotelIcon}>
                  <Ionicons name="bed-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.strong}>{hotel.hotel}</Text>
                  <Text style={styles.meta}>{[hotel.room ? `Habitación ${hotel.room}` : null, hotel.room_type, `salida ${dayLabel(hotel.check_out)}`].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            </Card>
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
            <Quick icon="call-outline" label="Emergencia" danger onPress={() => (emergency ? void Linking.openURL(`tel:${emergency.replace(/\s+/g, "")}`) : router.push("/pasajero/ayuda"))} />
          </View>
          <View style={styles.quick}>
            <Quick icon="star-outline" label="Califica tu viaje" onPress={() => router.push("/pasajero/calificar")} />
            <Quick icon="create-outline" label="Comentar" onPress={() => router.push("/pasajero/comentar")} />
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

function Line({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

function Quick({ icon, label, onPress, danger = false }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.quickItem, danger && styles.quickDanger, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color={danger ? colors.bad : colors.accent} />
      <Text style={[styles.quickLabel, danger && { color: colors.bad }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.side, borderRadius: 20, padding: space.lg, gap: 4 },
  code: { fontSize: font.tiny, color: "rgba(255,255,255,0.6)", fontWeight: "700", letterSpacing: 0.5 },
  title: { fontSize: font.title, fontWeight: "800", color: colors.white },
  phase: { fontSize: font.body, fontWeight: "700", color: colors.sun, marginTop: space.sm },
  dates: { fontSize: font.small, color: "rgba(255,255,255,0.75)" },
  alert: { gap: 4, backgroundColor: colors.badSoft, borderRadius: radius.control, padding: space.md, borderWidth: 1, borderColor: colors.bad },
  alertTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  alertTitle: { flex: 1, fontSize: font.body, fontWeight: "700", color: colors.bad },
  alertBody: { fontSize: font.small, color: colors.fg },
  alertMore: { fontSize: font.tiny, color: colors.bad, fontWeight: "600" },
  strong: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  meta: { fontSize: font.small, color: colors.fg2 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  lineText: { flex: 1, fontSize: font.small, color: colors.fg },
  hotel: { flexDirection: "row", alignItems: "center", gap: space.md },
  hotelIcon: { width: 44, height: 44, borderRadius: radius.control, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  quick: { flexDirection: "row", gap: space.sm },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: space.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  quickDanger: { backgroundColor: colors.badSoft, borderColor: colors.badSoft },
  quickLabel: { fontSize: font.tiny, fontWeight: "700", color: colors.fg2 },
  pax: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  missing: { fontSize: font.small, color: colors.warn, fontWeight: "600" },
});
