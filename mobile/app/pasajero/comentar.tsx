import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api, ApiRequestError } from "../../src/api/client";
import { usePassenger, type FeedbackOverview } from "../../src/data/passenger";
import { sinceLabel } from "../../src/format";
import { uuidv7 } from "../../src/offline/outbox";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import { ChoiceChips, Field, FieldLabel, Stars } from "../../src/ui/choice";
import { Button, Card, Pill, Screen, SectionTitle } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

const STATUS: Record<string, { label: string; tone: "ok" | "info" | "warn" | "mute" }> = {
  nuevo: { label: "Enviado", tone: "info" },
  leido: { label: "Leído", tone: "mute" },
  respondido: { label: "Respondido", tone: "ok" },
  derivado: { label: "En atención", tone: "warn" },
};

export default function FeedbackScreen() {
  const { notify } = useApp();
  const feedback = usePassenger<FeedbackOverview>("feedback");
  const [type, setType] = useState<string | null>(null);
  const [service, setService] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const data = feedback.data;

  async function send() {
    if (!type || text.trim().length < 5) return;
    setSending(true);
    try {
      await api("/mobile/passenger/feedback", { method: "POST", idempotencyKey: uuidv7(), body: { type, service: service || undefined, rating: rating || undefined, text: text.trim() } });
      setType(null);
      setService("");
      setRating(0);
      setText("");
      notify("Recibimos tu comentario. Te responderemos aquí mismo.");
      await feedback.reload();
    } catch (failure) {
      notify(failure instanceof ApiRequestError ? failure.message : "No pudimos enviar tu comentario. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen onRefresh={() => void feedback.reload()} refreshing={feedback.loading}>
      <RemoteState remote={feedback} empty="Los comentarios no están disponibles" />
      {data ? (
        <>
          <Text style={styles.intro}>Cuéntanos qué te pareció, sugiere algo o avísanos de un problema. Operaciones te responde en la app.</Text>
          <Card>
            <FieldLabel text="Tipo" />
            <ChoiceChips options={data.types} value={type} onChange={setType} />
            <FieldLabel text="Servicio" hint="Opcional" />
            <ChoiceChips options={[{ value: "", label: "Viaje en general" }, ...data.services.map((item) => ({ value: item.code, label: item.name }))]} value={service} onChange={setService} />
            <FieldLabel text="Calificación" hint="Opcional" />
            <Stars value={rating} onChange={setRating} label="Calificación del servicio" />
            <FieldLabel text="Comentario" hint={`${text.length}/1000`} />
            <Field value={text} onChange={setText} placeholder="Escribe tu comentario" multiline maxLength={1000} />
            <Button label="Enviar" icon="send-outline" onPress={() => void send()} busy={sending} disabled={!type || text.trim().length < 5} />
          </Card>

          {data.history.length > 0 ? <SectionTitle title="Mis comentarios" aside={`${data.history.length}`} /> : null}
          {data.history.slice(0, 5).map((item) => (
            <Card key={item.code}>
              <View style={styles.top}>
                <Pill label={item.type_label} tone="info" />
                <Pill label={STATUS[item.status]?.label ?? item.status} tone={STATUS[item.status]?.tone ?? "mute"} />
              </View>
              {item.service ? <Text style={styles.meta}>{item.service}</Text> : null}
              <Text style={styles.body}>{item.text}</Text>
              {item.reply ? <Text style={styles.reply}>Agencia: {item.reply}</Text> : null}
              <Text style={styles.meta}>{sinceLabel(item.created_at)}</Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: font.small, color: colors.fg2 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  body: { fontSize: font.body, color: colors.fg },
  reply: { fontSize: font.small, color: colors.accent, fontWeight: "600" },
  meta: { fontSize: font.tiny, color: colors.fg3 },
});
