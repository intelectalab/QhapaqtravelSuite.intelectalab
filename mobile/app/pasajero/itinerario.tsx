import { StyleSheet, Text, View } from "react-native";
import { usePassenger, type Itinerary } from "../../src/data/passenger";
import { dayLabel } from "../../src/format";
import { colors, font, space } from "../../src/theme";
import { Screen } from "../../src/ui/components";
import { RemoteState, ServiceCard } from "../../src/ui/passenger";

export default function ItineraryScreen() {
  const itinerary = usePassenger<Itinerary>("itinerary");

  return (
    <Screen onRefresh={() => void itinerary.reload()} refreshing={itinerary.loading}>
      <RemoteState remote={itinerary} empty="No pudimos cargar tu itinerario" />
      {itinerary.data?.days.map((day) => (
        <View key={day.date} style={{ gap: space.sm }}>
          <View style={styles.day}>
            <Text style={styles.number}>Día {day.number}</Text>
            <Text style={styles.date}>{dayLabel(day.date)}</Text>
          </View>
          {day.services.length === 0 ? <Text style={styles.free}>Día libre</Text> : day.services.map((service) => <ServiceCard key={service.code} service={service} />)}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: space.sm },
  number: { fontSize: font.h2, fontWeight: "800", color: colors.accent },
  date: { fontSize: font.small, color: colors.fg2, textTransform: "capitalize" },
  free: { fontSize: font.small, color: colors.fg3 },
});
