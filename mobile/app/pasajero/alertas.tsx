import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { usePassenger, type Alerts } from "../../src/data/passenger";
import { SEVERITY_TONE, sinceLabel } from "../../src/format";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import { Button, Card, Empty, Pill, Screen, SectionTitle } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

export default function AlertsScreen() {
  const { notify } = useApp();
  const alerts = usePassenger<Alerts>("alerts");
  const [busy, setBusy] = useState<string | null>(null);

  async function acknowledge(id: string) {
    setBusy(id);
    try {
      await api(`/mobile/passenger/alerts/${id}/read`, { method: "POST", body: {} });
      await alerts.reload();
    } catch {
      notify("No pudimos marcar la alerta. Revisa tu conexión.");
    } finally {
      setBusy(null);
    }
  }

  const data = alerts.data;
  return (
    <Screen onRefresh={() => void alerts.reload()} refreshing={alerts.loading}>
      <RemoteState remote={alerts} empty="No pudimos cargar tus alertas" />
      {data && data.alerts.length === 0 && data.notices.length === 0 ? <Empty icon="notifications-outline" title="Sin alertas" text="Te avisaremos aquí si cambia algo de tu viaje." /> : null}
      {data && data.alerts.length > 0 ? <SectionTitle title="Cambios en tu viaje" /> : null}
      {data?.alerts.map((alert) => (
        <Card key={alert.id}>
          <View style={styles.top}>
            <Pill label={alert.type} tone={SEVERITY_TONE[alert.severity] ?? "info"} />
            <Text style={styles.time}>{sinceLabel(alert.at)}</Text>
          </View>
          <Text style={styles.title}>{alert.title}</Text>
          {alert.message ? <Text style={styles.body}>{alert.message}</Text> : null}
          {alert.acked ? <Pill label="Leída" tone="ok" icon="checkmark" /> : <Button label="Entendido" icon="checkmark-outline" variant="ghost" onPress={() => void acknowledge(alert.id)} busy={busy === alert.id} />}
        </Card>
      ))}
      {data && data.notices.length > 0 ? <SectionTitle title="Avisos de tu agencia" /> : null}
      {data?.notices.map((notice) => (
        <Card key={notice.code}>
          <Text style={styles.title}>{notice.subject}</Text>
          <Text style={styles.body}>{notice.body}</Text>
          <Text style={styles.time}>{sinceLabel(notice.at)}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { fontSize: font.tiny, color: colors.fg3 },
  title: { fontSize: font.body, fontWeight: "700", color: colors.fg },
  body: { fontSize: font.small, color: colors.fg2, marginBottom: space.xs },
});
