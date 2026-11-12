import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { ApiRequestError } from "../../src/api/client";
import { openDocument, usePassenger } from "../../src/data/passenger";
import { dayLabel } from "../../src/format";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, radius, space } from "../../src/theme";
import { Button, Card, Pill, Row, Screen } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

interface VoucherDetail {
  code: string;
  label: string;
  date: string;
  status: string;
  version: number;
  pax: number;
  reservation: string;
  service: { name: string; time: string | null; confirmation: string | null; kind: string };
  provider: { name: string; phone: string | null; type: string | null } | null;
  meeting_point: string | null;
  passengers: { name: string; type: string; lead: boolean }[];
  qr_image: string | null;
}

export default function VoucherScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { notify } = useApp();
  const voucher = usePassenger<VoucherDetail>(`vouchers/${encodeURIComponent(String(code))}`);
  const [opening, setOpening] = useState(false);
  const data = voucher.data;

  async function open() {
    setOpening(true);
    try {
      await openDocument(String(code));
    } catch (failure) {
      notify(failure instanceof ApiRequestError ? failure.message : "No pudimos abrir el voucher.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: String(code) }} />
      <Screen onRefresh={() => void voucher.reload()} refreshing={voucher.loading}>
        <RemoteState remote={voucher} empty="No pudimos cargar el voucher" />
        {data ? (
          <>
            <View style={styles.ticket}>
              <Text style={styles.code}>{data.code}</Text>
              <Text style={styles.label}>{data.label}</Text>
              <View style={styles.badges}>
                <Pill label={data.status === "emitido" ? "Vigente" : data.status === "utilizado" ? "Utilizado" : "Anulado"} tone={data.status === "emitido" ? "ok" : "mute"} />
                <Pill label={`Versión ${data.version}`} />
              </View>
              {data.qr_image ? (
                <View style={styles.qrFrame}>
                  <Image source={{ uri: data.qr_image }} style={styles.qr} accessibilityLabel={`Código QR del voucher ${data.code}`} />
                </View>
              ) : null}
              <Text style={styles.hint}>Muestra este código al proveedor. Funciona sin conexión.</Text>
            </View>
            <Card>
              <Row icon="calendar-outline" label="Fecha" value={`${dayLabel(data.date)}${data.service.time ? ` · ${data.service.time}` : ""}`} />
              <Row icon="document-text-outline" label="Servicio" value={data.service.name} />
              {data.meeting_point ? <Row icon="location-outline" label="Punto de encuentro" value={data.meeting_point} /> : null}
              {data.provider ? <Row icon="business-outline" label="Proveedor" value={data.provider.name} onPress={data.provider.phone ? () => void Linking.openURL(`tel:${data.provider!.phone}`) : undefined} /> : null}
              {data.service.confirmation ? <Row icon="key-outline" label="Código de confirmación" value={data.service.confirmation} /> : null}
              <Row icon="bookmark-outline" label="Reserva" value={data.reservation} />
            </Card>
            <Card>
              <Row icon="people-outline" label="Viajeros" value={`${data.pax}`} />
              {(data.passengers ?? []).map((pax) => (
                <Row key={pax.name} icon={pax.lead ? "star-outline" : "person-outline"} label={pax.lead ? "Titular" : pax.type} value={pax.name} />
              ))}
            </Card>
            <Button label="Ver voucher en PDF" icon="qr-code-outline" onPress={() => void open()} busy={opening} />
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  ticket: { backgroundColor: colors.side, borderRadius: radius.card, padding: space.xl, gap: space.sm, alignItems: "center" },
  code: { fontSize: 26, fontWeight: "800", color: colors.white, letterSpacing: 1 },
  label: { fontSize: font.body, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  badges: { flexDirection: "row", gap: space.sm },
  hint: { fontSize: font.tiny, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  qrFrame: { backgroundColor: colors.white, borderRadius: radius.card, padding: space.md, marginTop: space.sm },
  qr: { width: 196, height: 196 },
});
