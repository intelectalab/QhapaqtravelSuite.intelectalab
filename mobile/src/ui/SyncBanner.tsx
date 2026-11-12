import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { lastSyncAt } from "../data/repository";
import { sinceLabel } from "../format";
import { counts } from "../offline/outbox";
import { describeStatus } from "../offline/status";
import { useApp, useLocal } from "../state/AppProvider";
import { colors, font, radius, space, tones } from "../theme";

const EMPTY = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };

export function SyncBanner() {
  const { online, notice, notify } = useApp();
  const router = useRouter();
  const outbox = useLocal(useCallback(() => counts(), []), EMPTY);
  const last = useLocal(useCallback(() => lastSyncAt(), []), null as string | null);
  const status = describeStatus(online, outbox);
  const palette = tones[status.tone];

  return (
    <View style={{ gap: space.sm }}>
      <Pressable testID="sync-banner" onPress={() => router.push("/perfil")} accessibilityRole="button" style={[styles.banner, { backgroundColor: palette.bg }]}>
        <Ionicons name={online ? "cloud-done-outline" : "cloud-offline-outline"} size={18} color={palette.fg} />
        <Text style={[styles.label, { color: palette.fg }]}>{status.label}</Text>
        <Text style={styles.time}>{sinceLabel(last)}</Text>
      </Pressable>
      {notice ? (
        <Pressable onPress={() => notify(null)} accessibilityRole="button" style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.warn} />
          <Text style={styles.noticeText}>{notice}</Text>
          <Ionicons name="close" size={18} color={colors.fg3} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: 10 },
  label: { flex: 1, fontSize: font.small, fontWeight: "700" },
  time: { fontSize: font.tiny, color: colors.fg3 },
  notice: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.control, padding: space.md, backgroundColor: colors.warnSoft },
  noticeText: { flex: 1, fontSize: font.small, color: colors.fg },
});
