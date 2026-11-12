import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { INCIDENT_TYPES, SEVERITIES } from "../../src/config";
import { reportIncident } from "../../src/data/actions";
import { attachToIncident, capturePhoto, type Photo } from "../../src/data/evidence";
import { listAssignments } from "../../src/data/repository";
import { addDays, dayLabel, SEVERITY_TONE, todayIso } from "../../src/format";
import { useApp, useLocal } from "../../src/state/AppProvider";
import { colors, font, radius, space, tones } from "../../src/theme";
import type { Assignment } from "../../src/types";
import { Button, Screen, styles as ui } from "../../src/ui/components";

const MAX_PHOTOS = 10;

export default function NewIncidentScreen() {
  const params = useLocalSearchParams<{ assignment?: string }>();
  const router = useRouter();
  const { online, touch, sync, notify } = useApp();
  const assignments = useLocal(useCallback(() => listAssignments(), []), [] as Assignment[]);
  const eligible = assignments.filter((assignment) => assignment.status !== "completada" && assignment.status !== "cancelada" && assignment.date >= addDays(todayIso(), -1));

  const [assignmentId, setAssignmentId] = useState<string | undefined>(params.assignment);
  const [type, setType] = useState<string>(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState<string>("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const selected = assignmentId ?? eligible[0]?.id;

  async function addPhoto() {
    const photo = await capturePhoto();
    if (photo === "denied") notify("Permite el uso de la cámara para adjuntar fotos.");
    else if (photo !== "cancelled") setPhotos((current) => [...current, photo]);
  }

  async function submit() {
    if (!selected) return;
    setBusy(true);
    try {
      await reportIncident(selected, { type, severity, title: title.trim(), description: description.trim() }, online, (db, actionId) => attachToIncident(db, selected, actionId, photos));
      touch();
      void sync();
      notify(online ? "Incidencia enviada a tu coordinador." : "Incidencia guardada. Se enviará al recuperar la conexión.");
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Label text="Servicio" />
      {eligible.length === 0 ? <Text style={ui.muted}>No tienes servicios abiertos desde ayer.</Text> : null}
      <View style={styles.wrap}>
        {eligible.map((assignment) => (
          <Chip key={assignment.id} label={`${dayLabel(assignment.date)} · ${assignment.time ?? ""} ${assignment.label}`} selected={selected === assignment.id} onPress={() => setAssignmentId(assignment.id)} />
        ))}
      </View>

      <Label text="Tipo" />
      <View style={styles.wrap}>
        {INCIDENT_TYPES.map((item) => (
          <Chip key={item} label={item} selected={type === item} onPress={() => setType(item)} />
        ))}
      </View>

      <Label text="Severidad" />
      <View style={styles.row}>
        {SEVERITIES.map((item) => {
          const active = severity === item.value;
          const tone = tones[SEVERITY_TONE[item.value] ?? "mute"];
          return (
            <Pressable key={item.value} onPress={() => setSeverity(item.value)} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.severity, active && { backgroundColor: tone.bg, borderColor: tone.fg }]}>
              <Text style={[styles.severityText, active && { color: tone.fg }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label text="Título" />
      <TextInput value={title} onChangeText={setTitle} placeholder="Qué pasó, en pocas palabras" placeholderTextColor={colors.fg3} style={styles.input} maxLength={200} testID="incident-title" />

      <Label text="Descripción" />
      <TextInput value={description} onChangeText={setDescription} placeholder="Detalle, pasajeros afectados y qué hiciste" placeholderTextColor={colors.fg3} style={[styles.input, styles.area]} multiline maxLength={4000} />

      <Label text={`Fotos (${photos.length} de ${MAX_PHOTOS})`} />
      {photos.length > 0 ? (
        <View style={styles.wrap}>
          {photos.map((photo) => (
            <Pressable key={photo.id} onPress={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))} accessibilityRole="button" accessibilityLabel="Quitar foto" style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <View style={styles.thumbRemove}>
                <Ionicons name="close" size={14} color={colors.white} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {photos.length < MAX_PHOTOS ? <Button label="Agregar foto" icon="camera-outline" variant="ghost" onPress={() => void addPhoto()} /> : null}

      <Button testID="incident-submit" label={online ? "Enviar incidencia" : "Guardar y enviar luego"} icon="send-outline" variant="danger" onPress={() => void submit()} busy={busy} disabled={!selected || title.trim().length < 3} />
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.small, fontWeight: "700", color: colors.fg2, marginTop: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 10, maxWidth: "100%" },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { fontSize: font.small, color: colors.fg2, fontWeight: "600" },
  chipTextOn: { color: colors.accent },
  severity: { flex: 1, minHeight: 46, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  severityText: { fontSize: font.small, fontWeight: "700", color: colors.fg2 },
  input: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: space.md, fontSize: 16, color: colors.fg },
  area: { minHeight: 120, paddingTop: space.md, textAlignVertical: "top" },
  thumbWrap: { width: 76, height: 76, borderRadius: radius.control, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  thumbRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
});
