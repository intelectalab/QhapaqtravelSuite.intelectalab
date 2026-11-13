import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { failedPhotos, pendingCount, retryPhoto, type FailedPhoto } from "../../src/data/evidence";
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

const RESOURCE_TONE: Record<string, "ok" | "info" | "warn" | "mute"> = { disponible: "ok", asignado: "info", descanso: "warn", vacaciones: "mute" };

export default function ProfileScreen() {
  const { signOut, sync, touch } = useApp();
  const me = useLocal(useCallback(() => getMe(), []), null as OperatorMe | null);
  const outbox = useLocal(useCallback(() => list(), []), [] as OutboxAction[]);
  const recent = useLocal(useCallback(() => history(6), []), [] as SyncedAction[]);
  const photos = useLocal(useCallback(() => pendingCount(), []), 0);
  const failed = useLocal(useCallback(() => failedPhotos(), []), [] as FailedPhoto[]);

  async function retry(id: string) {
    await retryPhoto(id);
    touch();
    void sync();
  }

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
          <View style={styles.badges}>
            <Pill label={me.status_label ?? me.status} tone={RESOURCE_TONE[me.status] ?? "mute"} />
            {me.rating !== null && me.rating !== undefined ? <Pill label={`${me.rating.toFixed(1)} / 5`} icon="star" tone="sun" /> : null}
          </View>
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

      <SectionTitle title="Bandeja de salida" aside={`${outbox.length + photos + failed.length}`} />
      <Card>
        {outbox.length === 0 && photos === 0 && failed.length === 0 ? <Text style={ui.muted}>No hay acciones pendientes de enviar.</Text> : null}
        {photos > 0 ? (
          <View style={styles.item}>
            <Text style={[ui.body, { flex: 1 }]}>
              {photos} foto{photos === 1 ? "" : "s"} por subir
            </Text>
            <Pill label="Por enviar" tone="mute" />
          </View>
        ) : null}
        {failed.map((photo) => (
          <View key={photo.id} style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ui.body}>Foto de evidencia</Text>
              <Text style={ui.muted}>
                {photo.attempts} intento{photo.attempts === 1 ? "" : "s"} sin éxito
              </Text>
              {photo.last_error ? <Text style={styles.reason}>{photo.last_error}</Text> : null}
            </View>
            <View style={styles.side}>
              <Pill label="Con error" tone="bad" />
              <Pressable onPress={() => void retry(photo.id)} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.link}>Reintentar</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {outbox.map((action) => {
          const state = STATE_LABELS[action.state] ?? STATE_LABELS.pending!;
          const actionable = action.state === "failed" || action.state === "conflict";
          return (
            <View key={action.client_action_id} style={styles.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ui.body}>{ACTION_LABELS[action.type] ?? action.type}</Text>
                <Text style={ui.muted}>
                  {sinceLabel(action.occurred_at)}
                  {action.offline ? " · sin conexión" : ""}
                  {action.attempts > 0 ? ` · ${action.attempts} intento${action.attempts === 1 ? "" : "s"}` : ""}
                </Text>
                {action.conflict_message || action.last_error ? <Text style={styles.reason}>{action.conflict_message ?? action.last_error}</Text> : null}
              </View>
              <View style={styles.side}>
                <Pill label={state.label} tone={state.tone} />
                {actionable ? (
                  <Pressable onPress={() => void act(action)} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.link}>{action.state === "failed" ? "Reintentar" : "Entendido"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
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
  link: { fontSize: font.small, color: colors.link, fontWeight: "700" },
  side: { alignItems: "flex-end", gap: 6 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
