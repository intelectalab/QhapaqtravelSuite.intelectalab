import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiRequestError } from "../../src/api/client";
import { openDocument, usePassenger, type Documents, type Vouchers } from "../../src/data/passenger";
import { dayLabel } from "../../src/format";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import { Card, Empty, Pill, Screen, SectionTitle } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

export default function DocumentsScreen() {
  const router = useRouter();
  const { notify } = useApp();
  const vouchers = usePassenger<Vouchers>("vouchers");
  const documents = usePassenger<Documents>("documents");
  const [opening, setOpening] = useState<string | null>(null);

  async function open(id: string) {
    setOpening(id);
    try {
      await openDocument(id);
    } catch (failure) {
      notify(failure instanceof ApiRequestError ? failure.message : "No pudimos abrir el documento.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <Screen
      onRefresh={() => {
        void vouchers.reload();
        void documents.reload();
      }}
      refreshing={vouchers.loading || documents.loading}
    >
      <SectionTitle title="Vouchers" aside={`${vouchers.data?.items.length ?? 0}`} />
      <RemoteState remote={vouchers} empty="No pudimos cargar tus vouchers" />
      {vouchers.data && vouchers.data.items.length === 0 ? <Empty icon="ticket-outline" title="Aún no hay vouchers" text="Aparecerán cuando tu agencia confirme los servicios." /> : null}
      {vouchers.data?.items.map((voucher) => (
        <Card key={voucher.code} onPress={() => router.push(`/voucher/${voucher.code}`)} accessibilityLabel={voucher.label}>
          <View style={styles.row}>
            <Ionicons name="ticket-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{voucher.label}</Text>
              <Text style={styles.meta}>
                {voucher.code} · {dayLabel(voucher.date)} · {voucher.pax} {voucher.pax === 1 ? "viajero" : "viajeros"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.fg3} />
          </View>
        </Card>
      ))}

      <SectionTitle title="Documentos" />
      <RemoteState remote={documents} empty="No pudimos cargar tus documentos" />
      {documents.data ? (
        <Card>
          {documents.data.items
            .filter((item) => item.kind !== "voucher")
            .map((item) => (
              <Pressable key={item.kind} onPress={item.available ? () => void open(item.kind) : undefined} disabled={!item.available || opening !== null} accessibilityRole="button" style={styles.doc}>
                <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                <Text style={[styles.name, { flex: 1 }]}>{item.label}</Text>
                {item.available ? <Pill label={opening === item.kind ? "Abriendo…" : "Abrir PDF"} tone="info" /> : <Pill label="Pronto" />}
              </Pressable>
            ))}
          {documents.data.policy.cancellation ? <Text style={styles.policy}>Política de cancelación: {documents.data.policy.cancellation}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  meta: { fontSize: font.small, color: colors.fg2 },
  doc: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  policy: { fontSize: font.small, color: colors.fg2, marginTop: space.sm },
});
