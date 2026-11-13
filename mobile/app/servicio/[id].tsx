import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as actions from "../../src/data/actions";
import { takePhoto } from "../../src/data/evidence";
import { getAssignment } from "../../src/data/repository";
import { dayLabel, INCIDENT_STATUS, SEVERITY_TONE, STATUS, STEPS, stepIndex, timeOf } from "../../src/format";
import { useApp, useLocal } from "../../src/state/AppProvider";
import { colors, font, radius, space } from "../../src/theme";
import type { Assignment, Passenger } from "../../src/types";
import { Button, Card, Empty, Pill, Row, Screen, SectionTitle, styles as ui } from "../../src/ui/components";
import { SyncBanner } from "../../src/ui/SyncBanner";

const MEETING_LABELS = { salida: "Punto de encuentro", cliente: "Recojo elegido por el cliente", producto: "Punto de recojo" } as const;

export default function AssignmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { online, touch, sync, notify } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const assignment = useLocal(useCallback(() => getAssignment(String(id)), [id]), null as Assignment | null);

  if (!assignment) {
    return (
      <Screen>
        <Empty icon="search-outline" title="Servicio no disponible" text="Puede que tu agencia lo haya reasignado. Vuelve a Hoy para ver tus servicios." />
      </Screen>
    );
  }

  const status = STATUS[assignment.status];
  const current = stepIndex(assignment.status, assignment.checked_in, assignment.evidences.length);

  async function run(key: string, task: () => Promise<unknown>) {
    setBusy(key);
    try {
      await task();
      touch();
      void sync();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar la acción.");
    } finally {
      setBusy(null);
    }
  }

  function confirmFinish() {
    const missing = assignment!.passengers.length - assignment!.checked_in;
    Alert.alert("Finalizar servicio", missing > 0 ? `${missing} pasajero${missing === 1 ? "" : "s"} sin check-in quedará${missing === 1 ? "" : "n"} como no-show.` : "Se registrará la hora de fin del servicio.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Finalizar", style: "destructive", onPress: () => void run("finish", () => actions.finish(assignment!.id, online)) },
    ]);
  }

  async function photo() {
    await run("evidence", async () => {
      const result = await takePhoto(assignment!.id);
      if (result === "denied") notify("Permite el uso de la cámara para tomar la foto de evidencia.");
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: assignment.order.code }} />
      <Screen>
        <SyncBanner />

        <Card>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.title}>{assignment.label}</Text>
              <Text style={ui.subtitle}>
                {dayLabel(assignment.date)} · {assignment.time ?? "Sin hora"}
                {assignment.reservation ? ` · ${assignment.reservation}` : ""}
              </Text>
            </View>
            <Pill label={status.label} tone={status.tone} />
          </View>
          <Steps current={current} cancelled={assignment.status === "cancelada"} />
        </Card>

        <View style={{ gap: space.sm }}>
          {assignment.can.confirm ? <Button testID="action-confirm" label="Confirmar asignación" icon="checkmark-circle-outline" onPress={() => void run("confirm", () => actions.confirm(assignment.id, online))} busy={busy === "confirm"} /> : null}
          {assignment.can.start ? <Button testID="action-start" label="Iniciar servicio" icon="play-circle-outline" variant="sun" onPress={() => void run("start", () => actions.start(assignment.id, online))} busy={busy === "start"} /> : null}
          {assignment.can.evidence ? <Button testID="action-evidence" label="Tomar foto de evidencia" icon="camera-outline" variant="ghost" onPress={() => void photo()} busy={busy === "evidence"} /> : null}
          {assignment.can.finish ? <Button testID="action-finish" label="Finalizar servicio" icon="flag-outline" onPress={confirmFinish} busy={busy === "finish"} /> : null}
          {assignment.status === "en_curso" && !assignment.can.finish ? <Text style={ui.muted}>Para finalizar necesitas al menos un check-in y una foto de evidencia.</Text> : null}
          {assignment.status !== "completada" && assignment.status !== "cancelada" ? (
            <Button label="Reportar incidencia" icon="warning-outline" variant="danger" onPress={() => router.push({ pathname: "/incidencia/nueva", params: { assignment: assignment.id } })} />
          ) : null}
        </View>

        <Card>
          {assignment.meeting_point ? <Row icon="location-outline" label={MEETING_LABELS[assignment.meeting_point.source]} value={assignment.meeting_point.text} /> : null}
          {assignment.vehicle ? <Row icon="car-outline" label="Vehículo" value={assignment.vehicle} /> : null}
          {assignment.partner ? <Row icon="people-outline" label={assignment.partner.role ?? "Compañero"} value={assignment.partner.name} onPress={assignment.partner.phone ? () => void Linking.openURL(`tel:${assignment.partner!.phone}`) : undefined} /> : null}
          {assignment.coordinator ? <Row icon="headset-outline" label="Coordinador" value={assignment.coordinator.name} onPress={assignment.coordinator.phone ? () => void Linking.openURL(`tel:${assignment.coordinator!.phone}`) : undefined} /> : null}
          <Row icon="document-text-outline" label="Servicio" value={`${assignment.service.name} · ${assignment.service.code}`} />
          {assignment.notes ? <Row icon="chatbox-ellipses-outline" label="Notas de la reserva" value={assignment.notes} /> : null}
          {assignment.started_at ? <Row icon="time-outline" label="Inicio real" value={timeOf(assignment.started_at)} /> : null}
        </Card>

        {assignment.pickup && (assignment.pickup.flight || assignment.pickup.arrival || assignment.pickup.sign || assignment.pickup.comments || assignment.pickup.tags.length > 0 || assignment.pickup.diets.length > 0) ? (
          <>
            <SectionTitle title={assignment.pickup.applies ? "Recojo y cliente" : "Datos del cliente"} />
            <Card>
              {assignment.pickup.sign ? <Row icon="easel-outline" label="Cartel" value={assignment.pickup.sign} /> : null}
              {assignment.pickup.flight ? <Row icon="airplane-outline" label="Vuelo" value={assignment.pickup.flight} /> : null}
              {assignment.pickup.arrival ? <Row icon="time-outline" label="Llegada" value={timeOf(assignment.pickup.arrival)} /> : null}
              {assignment.pickup.comments ? <Row icon="chatbox-outline" label="Comentarios del cliente" value={assignment.pickup.comments} /> : null}
              {assignment.pickup.diets.map((item) => <Row key={item.name} icon="restaurant-outline" label={`Dieta · ${item.name}`} value={item.diet} />)}
              {assignment.pickup.tags.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 6 }}>
                  {assignment.pickup.tags.map((tag) => <Pill key={tag} label={tag} />)}
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        {assignment.incidents && assignment.incidents.length > 0 ? (
          <>
            <SectionTitle title="Incidencias abiertas de la orden" aside={`${assignment.incidents.length}`} />
            <Card style={{ borderColor: colors.bad }}>
              {assignment.incidents.map((incident) => (
                <View key={incident.code} style={styles.incident}>
                  <Ionicons name="alert-circle-outline" size={18} color={SEVERITY_TONE[incident.severity] === "bad" ? colors.bad : colors.warn} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.paxName}>{incident.title}</Text>
                    <Text style={ui.muted}>
                      {incident.code} · {incident.type} · {INCIDENT_STATUS[incident.status] ?? incident.status}
                    </Text>
                  </View>
                  <Pill label={incident.severity === "critica" ? "Crítica" : incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)} tone={SEVERITY_TONE[incident.severity] ?? "info"} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionTitle title="Pasajeros" aside={`${assignment.checked_in} de ${assignment.passengers.length} con check-in`} />
        {assignment.can.checkin && assignment.checked_in < assignment.passengers.length ? (
          <Button testID="action-checkin-all" label="Check-in de todo el grupo" icon="checkmark-done-outline" variant="ghost" onPress={() => void run("checkin_all", () => actions.checkinAll(assignment.id, online))} busy={busy === "checkin_all"} />
        ) : null}
        <Card style={{ paddingVertical: space.sm }}>
          {assignment.passengers.length === 0 ? <Text style={ui.muted}>Esta asignación no tiene pasajeros.</Text> : null}
          {assignment.passengers.map((passenger, index) => (
            <PassengerRow
              key={passenger.id}
              passenger={passenger}
              last={index === assignment.passengers.length - 1}
              enabled={assignment.can.checkin}
              onToggle={() => void run(`checkin:${passenger.id}`, () => actions.checkin(assignment.id, passenger.id, passenger.checked_at !== null, online))}
            />
          ))}
        </Card>

        <SectionTitle title="Evidencias" aside={`${assignment.evidences.length}`} />
        <Card>
          {assignment.evidences.length === 0 ? <Text style={ui.muted}>Aún no hay fotos de este servicio.</Text> : null}
          {assignment.evidences.map((evidence) => (
            <View key={evidence.id} style={styles.evidence}>
              <Ionicons name="image-outline" size={18} color={colors.accent} />
              <Text style={[ui.body, { flex: 1 }]} numberOfLines={1}>
                {evidence.name}
              </Text>
              {evidence.pending ? <Pill label="Por subir" tone="warn" /> : <Pill label="Subida" tone="ok" />}
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

function Steps({ current, cancelled }: { current: number; cancelled: boolean }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Paso ${Math.min(current, STEPS.length)} de ${STEPS.length}`}>
      {STEPS.map((step, index) => {
        const done = !cancelled && index < current;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.stepBar, done && { backgroundColor: colors.accent }]} />
            <Text style={[styles.stepLabel, done && { color: colors.accent }]} numberOfLines={1}>
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PassengerRow({ passenger, last, enabled, onToggle }: { passenger: Passenger; last: boolean; enabled: boolean; onToggle: () => void }) {
  const checked = passenger.checked_at !== null;
  return (
    <Pressable
      testID={`checkin-${passenger.id}`}
      onPress={enabled ? onToggle : undefined}
      disabled={!enabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !enabled }}
      style={({ pressed }) => [styles.pax, !last && styles.paxLine, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.check, checked && styles.checkOn]}>{checked ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.paxName}>
          {passenger.name}
          {passenger.lead ? "  · titular" : ""}
        </Text>
        <Text style={ui.muted}>
          {[passenger.type, passenger.doc, passenger.diet ? `Dieta: ${passenger.diet}` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {checked ? <Text style={styles.paxTime}>{timeOf(passenger.checked_at)}</Text> : passenger.no_show ? <Pill label="No-show" tone="bad" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  steps: { flexDirection: "row", gap: 4, marginTop: space.sm },
  step: { flex: 1, gap: 4 },
  stepBar: { height: 5, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  stepLabel: { fontSize: 10, color: colors.fg3, fontWeight: "600" },
  pax: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, minHeight: 56 },
  paxLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.ok, borderColor: colors.ok },
  paxName: { fontSize: font.body, fontWeight: "600", color: colors.fg },
  paxTime: { fontSize: font.small, color: colors.ok, fontWeight: "700" },
  evidence: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 4 },
  incident: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 4 },
});
