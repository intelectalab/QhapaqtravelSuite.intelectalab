import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiRequestError } from "../src/api/client";
import { login, requestPassengerLink, verifyMfa, verifyPassenger } from "../src/api/session";
import { useApp } from "../src/state/AppProvider";
import { colors, font, radius, space } from "../src/theme";
import { Button } from "../src/ui/components";

type Mode = "operator" | "passenger";
type Step = "credentials" | "mfa" | "link" | "verify";

const COPY: Record<Step, { title: string; hint: string; action: string }> = {
  credentials: { title: "Ingresa a tus servicios", hint: "Usa el correo y la contraseña que te dio tu agencia.", action: "Ingresar" },
  mfa: { title: "Verificación en dos pasos", hint: "Escribe el código de 6 dígitos de tu aplicación de autenticación.", action: "Verificar" },
  link: { title: "Ingresa a tu viaje", hint: "Escribe el correo con el que reservaste y tu código de reserva. Te enviaremos un enlace.", action: "Enviarme el enlace" },
  verify: { title: "Revisa tu correo", hint: "Copia el enlace que te enviamos y pégalo aquí.", action: "Entrar a mi viaje" },
};

export default function LoginScreen() {
  const { activate } = useApp();
  const [mode, setMode] = useState<Mode>("operator");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reservation, setReservation] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStep(next === "operator" ? "credentials" : "link");
    setError(null);
    setInfo(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (step === "credentials") {
        const result = await login(email, password);
        if (result.next === "mfa") setStep("mfa");
        else await activate();
      } else if (step === "mfa") {
        await verifyMfa(code);
        await activate();
      } else if (step === "link") {
        setInfo(await requestPassengerLink(email, reservation));
        setStep("verify");
      } else {
        await verifyPassenger(link);
        await activate();
      }
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : "No pudimos iniciar sesión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = {
    credentials: !email || !password,
    mfa: code.replace(/\s+/g, "").length < 6,
    link: !email || !/^RES-/i.test(reservation.trim()),
    verify: link.trim().length < 20,
  }[step];

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markText}>KC</Text>
            </View>
            <Text style={styles.brandName}>KipuControl</Text>
            <Text style={styles.brandRole}>Tu viaje y tus servicios en el teléfono</Text>
          </View>

          <View style={styles.card}>
            {step === "credentials" || step === "link" ? (
              <View style={styles.segment} accessibilityRole="tablist">
                {(["operator", "passenger"] as const).map((item) => (
                  <Pressable key={item} onPress={() => switchMode(item)} accessibilityRole="tab" accessibilityState={{ selected: mode === item }} style={[styles.segmentItem, mode === item && styles.segmentOn]}>
                    <Text style={[styles.segmentText, mode === item && styles.segmentTextOn]}>{item === "operator" ? "Guía o conductor" : "Pasajero"}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.title}>{COPY[step].title}</Text>
            <Text style={styles.hint}>{COPY[step].hint}</Text>
            {info ? <Text style={styles.info}>{info}</Text> : null}

            {step === "credentials" ? (
              <>
                <Field label="Correo" value={email} onChange={setEmail} keyboardType="email-address" testID="login-email" />
                <Field label="Contraseña" value={password} onChange={setPassword} secure testID="login-password" />
              </>
            ) : null}
            {step === "mfa" ? <Field label="Código" value={code} onChange={setCode} keyboardType="number-pad" testID="login-code" /> : null}
            {step === "link" ? (
              <>
                <Field label="Correo" value={email} onChange={setEmail} keyboardType="email-address" testID="pax-email" />
                <Field label="Código de reserva" value={reservation} onChange={setReservation} placeholder="RES-2026-000347" testID="pax-reservation" />
              </>
            ) : null}
            {step === "verify" ? <Field label="Enlace del correo" value={link} onChange={setLink} placeholder="Pega aquí el enlace" multiline testID="pax-link" /> : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button testID="login-submit" label={COPY[step].action} icon={step === "link" ? "mail-outline" : "log-in-outline"} onPress={submit} busy={busy} disabled={disabled} />
            {step === "verify" ? <Button label="Volver a pedir el enlace" variant="ghost" onPress={() => setStep("link")} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  secure,
  keyboardType,
  placeholder,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
  keyboardType?: "email-address" | "number-pad";
  placeholder?: string;
  multiline?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        placeholder={placeholder}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, multiline && { minHeight: 90, paddingTop: space.md, textAlignVertical: "top" }]}
        placeholderTextColor={colors.fg3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.side },
  wrap: { flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.xl },
  brand: { alignItems: "center", gap: space.xs },
  mark: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  markText: { fontSize: 22, fontWeight: "800", color: colors.accent },
  brandName: { fontSize: 24, fontWeight: "800", color: colors.white },
  brandRole: { fontSize: font.small, color: "rgba(255,255,255,0.7)" },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: space.xl, gap: space.md },
  segment: { flexDirection: "row", backgroundColor: colors.surface3, borderRadius: radius.control, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontSize: font.small, fontWeight: "700", color: colors.fg3 },
  segmentTextOn: { color: colors.accent },
  title: { fontSize: 19, fontWeight: "800", color: colors.fg },
  hint: { fontSize: font.small, color: colors.fg2 },
  info: { fontSize: font.small, color: colors.ok, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: font.small, fontWeight: "700", color: colors.fg2 },
  input: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, fontSize: 16, color: colors.fg, backgroundColor: colors.surface2 },
  error: { fontSize: font.small, color: colors.bad, fontWeight: "600" },
});
