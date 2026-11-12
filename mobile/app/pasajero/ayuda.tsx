import { useState } from "react";
import { Alert, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { usePassenger, type Messages, type Support } from "../../src/data/passenger";
import { sinceLabel } from "../../src/format";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, radius, space } from "../../src/theme";
import { Button, Card, Row, Screen, SectionTitle } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

const QUICK = ["¿A qué hora pasan a recogerme?", "Necesito cambiar mi punto de recojo", "Tengo una consulta sobre mi voucher"];

function call(phone: string | null | undefined) {
  if (phone) void Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`);
}

export default function HelpScreen() {
  const { notify, signOut } = useApp();
  const support = usePassenger<Support>("support");
  const messages = usePassenger<Messages>("messages");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send(text: string) {
    if (text.trim().length < 2) return;
    setSending(true);
    try {
      await api("/mobile/passenger/messages", { method: "POST", body: { body: text.trim() } });
      setBody("");
      await messages.reload();
    } catch {
      notify("No pudimos enviar el mensaje. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  function confirmSignOut() {
    Alert.alert("Cerrar sesión", "Para volver a entrar necesitarás un nuevo enlace por correo.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  const help = support.data;
  return (
    <Screen
      onRefresh={() => {
        void support.reload();
        void messages.reload();
      }}
      refreshing={support.loading || messages.loading}
    >
      <RemoteState remote={support} empty="No pudimos cargar los contactos" />
      {help?.emergency ? (
        <Card style={styles.emergency}>
          <Text style={styles.emergencyLabel}>{help.emergency.label}</Text>
          <Text style={styles.emergencyPhone}>{help.emergency.phone}</Text>
          <Button label="Llamar ahora" icon="call" variant="danger" onPress={() => call(help.emergency?.phone)} />
        </Card>
      ) : null}
      {help ? (
        <Card>
          {help.guide ? <Row icon="person-outline" label="Tu guía" value={help.guide.name} onPress={help.guide.phone ? () => call(help.guide?.phone) : undefined} /> : null}
          {help.coordinator ? <Row icon="headset-outline" label="Coordinador" value={help.coordinator.name} onPress={help.coordinator.phone ? () => call(help.coordinator?.phone) : undefined} /> : null}
          {help.advisor ? <Row icon="briefcase-outline" label="Tu asesor" value={help.advisor.name} onPress={help.advisor.phone ? () => call(help.advisor?.phone) : undefined} /> : null}
        </Card>
      ) : null}

      <SectionTitle title="Chat con tu agencia" aside={messages.data?.unread ? `${messages.data.unread} sin leer` : undefined} />
      <Card>
        {messages.data?.items.length === 0 ? <Text style={styles.meta}>Escríbenos cualquier duda sobre tu viaje.</Text> : null}
        {messages.data?.items.map((message) => {
          const mine = message.from === "pasajero" || message.from === "passenger";
          return (
            <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {!mine ? <Text style={styles.sender}>{message.sender}</Text> : null}
              <Text style={[styles.text, mine && { color: colors.white }]}>{message.body}</Text>
              <Text style={[styles.meta, mine && { color: "rgba(255,255,255,0.7)" }]}>{sinceLabel(message.at)}</Text>
            </View>
          );
        })}
      </Card>
      <View style={styles.quick}>
        {QUICK.map((text) => (
          <Button key={text} label={text} variant="ghost" onPress={() => void send(text)} disabled={sending} />
        ))}
      </View>
      <TextInput value={body} onChangeText={setBody} placeholder="Escribe tu mensaje" placeholderTextColor={colors.fg3} style={styles.input} multiline maxLength={2000} />
      <Button label="Enviar" icon="send-outline" onPress={() => void send(body)} busy={sending} disabled={body.trim().length < 2} />

      <Button label="Cerrar sesión" icon="log-out-outline" variant="ghost" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emergency: { backgroundColor: colors.badSoft, borderColor: colors.badSoft },
  emergencyLabel: { fontSize: font.small, fontWeight: "700", color: colors.bad },
  emergencyPhone: { fontSize: 24, fontWeight: "800", color: colors.fg, marginBottom: space.sm },
  meta: { fontSize: font.tiny, color: colors.fg3 },
  bubble: { maxWidth: "85%", borderRadius: radius.card, padding: space.md, gap: 2, marginVertical: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.accent },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface3 },
  sender: { fontSize: font.tiny, fontWeight: "700", color: colors.fg2 },
  text: { fontSize: font.body, color: colors.fg },
  quick: { gap: space.sm },
  input: { minHeight: 80, borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: space.md, fontSize: 16, color: colors.fg, textAlignVertical: "top" },
});
