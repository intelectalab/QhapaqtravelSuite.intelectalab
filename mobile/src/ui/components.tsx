import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, font, radius, space, tones, type Tone } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Screen({ children, scroll = true, onRefresh, refreshing }: { children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const content = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  );
}

type ButtonVariant = "primary" | "sun" | "ghost" | "danger";

export function Button({ label, onPress, icon, variant = "primary", disabled, busy, testID }: { label: string; onPress: () => void; icon?: IconName; variant?: ButtonVariant; disabled?: boolean; busy?: boolean; testID?: string }) {
  const palette = BUTTONS[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      style={({ pressed }) => [styles.button, { backgroundColor: palette.bg, borderColor: palette.border }, (disabled || busy) && styles.disabled, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={20} color={palette.fg} /> : null}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const BUTTONS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.white, border: colors.accent },
  sun: { bg: colors.sun, fg: colors.sunFg, border: colors.sun },
  ghost: { bg: colors.surface, fg: colors.accent, border: colors.line },
  danger: { bg: colors.badSoft, fg: colors.bad, border: colors.badSoft },
};

export function Pill({ label, tone = "mute", icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const palette = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      {icon && <Ionicons name={icon} size={13} color={palette.fg} />}
      <Text style={[styles.pillLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function Row({ icon, label, value, onPress }: { icon: IconName; label: string; value: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {typeof value === "string" ? <Text style={styles.rowValue}>{value}</Text> : value}
      </View>
      {onPress ? <Ionicons name="call-outline" size={20} color={colors.link} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  screenInner: { flex: 1, padding: space.lg, gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  button: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg },
  buttonLabel: { fontSize: font.body, fontWeight: "700" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillLabel: { fontSize: font.tiny, fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.sm },
  sectionTitle: { fontSize: font.h2, fontWeight: "700", color: colors.fg },
  sectionAside: { fontSize: font.small, color: colors.fg3 },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  emptyText: { fontSize: font.small, color: colors.fg2, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.xs },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: font.tiny, color: colors.fg3, fontWeight: "600" },
  rowValue: { fontSize: font.body, color: colors.fg },
  title: { fontSize: font.title, fontWeight: "800", color: colors.fg },
  subtitle: { fontSize: font.small, color: colors.fg2 },
  body: { fontSize: font.body, color: colors.fg },
  muted: { fontSize: font.small, color: colors.fg3 },
});
