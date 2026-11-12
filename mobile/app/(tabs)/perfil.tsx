import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { pendingCount } from "../../src/data/evidence";
import { getMe } from "../../src/data/repository";
import { sinceLabel } from "../../src/format";
import { acknowledgeConflict, history, list, retryFailed, type OutboxAction, type SyncedAction } from "../../src/offline/outbox";
import { useApp, useLocal } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import type { OperatorMe } from "../../src/types";
import { Button, Card, Pill, Row, Screen, SectionTitle, styles as ui } from "../../src/ui/components";
import { SyncBanner } from "../../src/ui/SyncBanner";

const ACTION_LABELS: Record<string, string> = {
  confirm: "Confirmar asignación",
  start: "Iniciar servicio",
  checkin: "Check-in",
  checkin_undo: "Deshacer check-in",
  checkin_all: "Check-in del grupo",
  evidence: "Foto de evidencia",
  incident: "Incidencia",
  finish: "Finalizar servicio",
};

const STATE_LABELS: Record<string, { label: string; tone: "info" | "warn" | "bad" | "mute" }> = {
  pending: { label: "Por enviar", tone: "mute" },
  syncing: { label: "Enviando", tone: "info" },
  conflict: { label: "Resuelta por el servidor", tone: "warn" },
  failed: { label: "Con error", tone: "bad" },
};

export default function ProfileScreen() {
  const { signOut, sync, touch } = useApp();
  const me = useLocal(useCallback(() => getMe(), []), null as OperatorMe | null);
  const outbox = useLocal(useCallback(() => list(), []), [] as OutboxAction[]);
  const recent = useLocal(useCallback(() => history(6), []), [] as SyncedAction[]);
  const photos = useLocal(useCallback(() => pendingCount(), []), 0);

  async function act(action: OutboxAction) {
    if (action.state === "failed") await retryFailed(action.client_action_id);
    if (action.state === "conflict") await acknowledgeConflict(action.client_action_id);
    touch();
    void sync();
  }

  function confirmSignOut() {
    const blocked = outbox.length + photos;
    Alert.alert("Cerrar sesión", blocked > 0 ? `Tienes ${blocked} acción${blocked === 1 ? "" : "es"} sin enviar. Si cierras sesión ahora se perderán.` : "Se borrarán los datos guardados en este teléfono.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      {me ? (
        <Card>
          <Text style={ui.title}>{me.name}</Text>
          <Text style={ui.subtitle}>
            {me.role} · {me.code}
          </Text>
          {me.phone ? <Row icon="call-outline" label="Teléfono" value={me.phone} /> : null}
          {me.license ? (
            <Row
              icon="card-outline"
              label={me.type === "driver" ? "Licencia" : "Carné"}
              value={
                <View style={styles.inline}>
                  <Text style={ui.body}>
                    {me.license}
                    {me.license_expires_on ? ` · vence ${me.license_expires_on}` : ""}
                  </Text>
                  {me.license_state && me.license_state !== "vigente" ? <Pill label={me.license_state} tone={me.license_state === "vencido" ? "bad" : "warn"} /> : null}
                </View>
              }
            />
          ) : null}
          {me.languages.length > 0 ? <Row icon="language-outline" label="Idiomas" value={me.languages.join(", ")} /> : null}
        </Card>
      ) : null}

      <SyncBanner />

      <SectionTitle title="Bandeja de salida" aside={`${outbox.length + photos}`} />
      <Card>
        {outbox.length === 0 && photos === 0 ? <Text style={ui.muted}>No hay acciones pendientes de enviar.</Text> : null}
        {photos > 0 ? (
          <View style={styles.item}>
            <Text style={[ui.body, { flex: 1 }]}>
              {photos} foto{photos === 1 ? "" : "s"} por subir
            </Text>
            <Pill label="Por enviar" tone="mute" />
          </View>
        ) : null}
        {outbox.map((action) => {
          const state = STATE_LABELS[action.state] ?? STATE_LABELS.pending!;
          const actionable = action.state === "failed" || action.state === "conflict";
          return (
            <Pressable key={action.client_action_id} onPress={actionable ? () => void act(action) : undefined} disabled={!actionable} style={styles.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.body}>{ACTION_LABELS[action.type] ?? action.type}</Text>
                <Text style={ui.muted}>
                  {sinceLabel(action.occurred_at)}
                  {action.offline ? " · sin conexión" : ""}
                </Text>
                {action.conflict_message || action.last_error ? <Text style={styles.reason}>{action.conflict_message ?? action.last_error}</Text> : null}
                {actionable ? <Text style={styles.link}>{action.state === "failed" ? "Tocar para reintentar" : "Tocar para marcar como visto"}</Text> : null}
              </View>
              <Pill label={state.label} tone={state.tone} />
            </Pressable>
          );
        })}
      </Card>

      {recent.length > 0 ? (
        <>
          <SectionTitle title="Sincronizadas recientemente" />
          <Card>
            {recent.map((item) => (
              <View key={item.client_action_id} style={styles.item}>
                <Text style={[ui.body, { flex: 1 }]}>{ACTION_LABELS[item.type] ?? item.type}</Text>
                <Text style={ui.muted}>
                  {sinceLabel(item.synced_at)}
                  {item.resolved ? " · resuelta" : ""}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Button label="Sincronizar ahora" icon="sync-outline" variant="ghost" onPress={() => void sync()} />
      <Button label="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  reason: { fontSize: font.small, color: colors.warn },
  link: { fontSize: font.small, color: colors.link, fontWeight: "600" },
});
