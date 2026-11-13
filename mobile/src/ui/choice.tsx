import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, font, radius, space } from "../theme";

export function ChoiceChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (value: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipOn]}>
            <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stars({ value, onChange, size = 30, label }: { value: number; onChange: (value: number) => void; size?: number; label: string }) {
  return (
    <View style={styles.stars} accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star === value ? 0 : star)} accessibilityRole="button" accessibilityLabel={`${star} de 5`} hitSlop={6}>
          <Ionicons name={star <= value ? "star" : "star-outline"} size={size} color={star <= value ? colors.sun : colors.fg3} />
        </Pressable>
      ))}
    </View>
  );
}

export function FieldLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Field({ value, onChange, placeholder, multiline = false, maxLength }: { value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; maxLength: number }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.fg3} multiline={multiline} maxLength={maxLength} style={[styles.input, multiline && styles.area]} />;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontSize: font.small, fontWeight: "600", color: colors.fg2 },
  chipLabelOn: { color: colors.white },
  stars: { flexDirection: "row", gap: space.sm },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: font.small, fontWeight: "700", color: colors.fg },
  hint: { fontSize: font.tiny, color: colors.fg3 },
  input: { borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: space.md, fontSize: 16, color: colors.fg },
  area: { minHeight: 110, textAlignVertical: "top" },
});
