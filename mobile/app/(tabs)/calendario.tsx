import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listAssignments } from "../../src/data/repository";
import { addDays, dayLabel, shortDay, todayIso } from "../../src/format";
import { useLocal } from "../../src/state/AppProvider";
import { colors, font, radius, space } from "../../src/theme";
import type { Assignment } from "../../src/types";
import { AssignmentCard } from "../../src/ui/AssignmentCard";
import { Empty, Screen, SectionTitle } from "../../src/ui/components";

export default function CalendarScreen() {
  const today = todayIso();
  const [selected, setSelected] = useState(today);
  const assignments = useLocal(useCallback(() => listAssignments(), []), [] as Assignment[]);
  const active = assignments.filter((assignment) => assignment.status !== "cancelada");
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const agenda = Array.from({ length: 14 }, (_, index) => addDays(today, index)).filter((day) => day !== selected && active.some((assignment) => assignment.date === day));
  const ofDay = (day: string) => active.filter((assignment) => assignment.date === day);

  return (
    <Screen>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {week.map((day) => {
          const { weekday, day: number } = shortDay(day);
          const isSelected = day === selected;
          const count = ofDay(day).length;
          return (
            <Pressable key={day} onPress={() => setSelected(day)} accessibilityRole="button" accessibilityState={{ selected: isSelected }} style={[styles.day, isSelected && styles.daySelected]}>
              <Text style={[styles.weekday, isSelected && styles.textOn]}>{weekday}</Text>
              <Text style={[styles.number, isSelected && styles.textOn]}>{number}</Text>
              <View style={[styles.dot, count > 0 && { backgroundColor: isSelected ? colors.sun : colors.accent }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionTitle title={dayLabel(selected)} aside={`${ofDay(selected).length} servicio${ofDay(selected).length === 1 ? "" : "s"}`} />
      {ofDay(selected).length === 0 ? <Empty icon="calendar-clear-outline" title="Día libre" text="No tienes servicios asignados este día." /> : ofDay(selected).map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}

      {agenda.length > 0 ? <SectionTitle title="Próximos 14 días" /> : null}
      {agenda.map((day) => (
        <View key={day} style={{ gap: space.sm }}>
          <Text style={styles.agendaDay}>{dayLabel(day)}</Text>
          {ofDay(day).map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.sm, paddingVertical: space.xs },
  day: { width: 54, paddingVertical: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", gap: 2 },
  daySelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekday: { fontSize: font.tiny, color: colors.fg3, fontWeight: "600", textTransform: "capitalize" },
  number: { fontSize: 19, fontWeight: "800", color: colors.fg },
  textOn: { color: colors.white },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent", marginTop: 2 },
  agendaDay: { fontSize: font.small, fontWeight: "700", color: colors.fg2, textTransform: "capitalize", marginTop: space.xs },
});
