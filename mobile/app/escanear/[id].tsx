import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { notAPass, offlineOutcome, readPassToken, scanPass, type ScanOutcome } from "../../src/data/checkin";
import { getAssignment } from "../../src/data/repository";
import { useApp, useLocal } from "../../src/state/AppProvider";
import { colors, font, radius, space, tones } from "../../src/theme";
import type { Assignment } from "../../src/types";
import { Button, Empty, Screen } from "../../src/ui/components";

const ICONS: Record<ScanOutcome["tone"], "checkmark-circle" | "alert-circle" | "close-circle"> = { ok: "checkmark-circle", warn: "alert-circle", bad: "close-circle" };

export default function ScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { online, touch, sync } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [checking, setChecking] = useState(false);
  const locked = useRef(false);
  const assignment = useLocal(useCallback(() => getAssignment(String(id)), [id]), null as Assignment | null);

  const handleScan = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (locked.current || !assignment) return;
      locked.current = true;
      const token = readPassToken(data);
      if (!token) {
        setOutcome(notAPass());
        return;
      }
      if (!online) {
        setOutcome(offlineOutcome());
        return;
      }
      setChecking(true);
      const result = await scanPass(assignment, token);
      setChecking(false);
      setOutcome(result);
      if (result.tone === "ok") {
        touch();
        void sync();
      }
    },
    [assignment, online, touch, sync],
  );

  function next() {
    setOutcome(null);
    locked.current = false;
  }

  if (!assignment) {
    return (
      <Screen>
        <Empty icon="search-outline" title="Servicio no disponible" text="Vuelve a Hoy para ver tus servicios." />
      </Screen>
    );
  }

  if (!assignment.can.checkin) {
    return (
      <Screen>
        <Empty icon="qr-code-outline" title="Inicia el servicio para escanear" text="El check-in con QR se habilita cuando el servicio está en curso." />
        <Button label="Volver al servicio" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Empty icon="camera-outline" title="Permite el uso de la cámara" text="La cámara se usa para leer el QR del pase de cada pasajero." />
        {permission.canAskAgain ? (
          <Button testID="scan-permission" label="Permitir cámara" icon="camera-outline" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Abrir ajustes del teléfono" icon="settings-outline" onPress={() => void Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  const palette = outcome ? tones[outcome.tone] : null;

  return (
    <View style={styles.root}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={outcome || checking ? undefined : (result) => void handleScan(result)} />
      <SafeAreaView style={styles.overlay} edges={["left", "right", "bottom"]}>
        <View style={styles.top}>
          <Text style={styles.service} numberOfLines={1}>
            {assignment.label}
          </Text>
          <Text style={styles.count}>
            {assignment.checked_in} de {assignment.passengers.length} con check-in
          </Text>
        </View>

        <View style={styles.frame} accessibilityLabel="Encuadra el QR del pase dentro del recuadro">
          {checking ? <ActivityIndicator size="large" color={colors.white} /> : null}
        </View>

        {outcome && palette ? (
          <View testID="scan-result" style={[styles.result, { borderColor: palette.fg }]}>
            <View style={styles.resultHead}>
              <Ionicons name={ICONS[outcome.tone]} size={28} color={palette.fg} />
              <Text style={[styles.resultTitle, { color: palette.fg }]}>{outcome.title}</Text>
            </View>
            <Text style={styles.resultText}>{outcome.message}</Text>
            <Button testID="scan-next" label="Escanear otro pase" icon="scan-outline" onPress={next} />
            <Button label="Volver al servicio" variant="ghost" onPress={() => router.back()} />
          </View>
        ) : (
          <Text style={styles.hint}>{online ? "Encuadra el QR de «Mi pase» del pasajero." : "Sin conexión: el pase no se puede validar ahora."}</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  overlay: { flex: 1, justifyContent: "space-between", padding: space.lg },
  top: { backgroundColor: "rgba(10,58,115,0.85)", borderRadius: radius.card, padding: space.md, gap: 2 },
  service: { color: colors.white, fontSize: font.body, fontWeight: "700" },
  count: { color: "rgba(255,255,255,0.8)", fontSize: font.small },
  frame: { alignSelf: "center", width: 240, height: 240, borderRadius: radius.card, borderWidth: 3, borderColor: colors.sun, alignItems: "center", justifyContent: "center" },
  hint: { color: colors.white, fontSize: font.body, textAlign: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radius.control, padding: space.md },
  result: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 2, padding: space.lg, gap: space.sm },
  resultHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  resultTitle: { fontSize: font.h2, fontWeight: "800", flex: 1 },
  resultText: { fontSize: font.body, color: colors.fg },
});
