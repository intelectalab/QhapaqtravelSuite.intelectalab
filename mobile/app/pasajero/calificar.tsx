import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, ApiRequestError } from "../../src/api/client";
import { usePassenger, type ReviewOverview } from "../../src/data/passenger";
import { uuidv7 } from "../../src/offline/outbox";
import { useApp } from "../../src/state/AppProvider";
import { colors, font, space } from "../../src/theme";
import { ChoiceChips, Field, FieldLabel, Stars } from "../../src/ui/choice";
import { Button, Card, Empty, Pill, Screen, SectionTitle } from "../../src/ui/components";
import { RemoteState } from "../../src/ui/passenger";

const STATUS: Record<string, { label: string; tone: "ok" | "info" | "bad" | "mute" }> = {
  pendiente: { label: "En revisión", tone: "info" },
  publicada: { label: "Publicada", tone: "ok" },
  rechazada: { label: "No publicada", tone: "bad" },
  oculta: { label: "Oculta", tone: "mute" },
};

export default function ReviewScreen() {
  const { notify } = useApp();
  const reviews = usePassenger<ReviewOverview>("reviews/eligibility", "/passenger");
  const [product, setProduct] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(true);
  const [sending, setSending] = useState(false);
  const data = reviews.data;
  const pending = data?.items.filter((item) => item.eligible) ?? [];
  const mine = data?.items.filter((item) => item.review) ?? [];
  const waiting = data?.items.filter((item) => !item.eligible && !item.review) ?? [];
  const ready = product !== null && stars > 0 && title.trim().length >= 3 && body.trim().length >= 20;

  async function send() {
    if (!ready) return;
    setSending(true);
    try {
      const subratings = Object.fromEntries(Object.entries(aspects).filter(([, value]) => value > 0));
      await api("/passenger/reviews", { method: "POST", idempotencyKey: uuidv7(), body: { trip: data?.trip.code, product, stars, subratings, title: title.trim(), body: body.trim(), consent_publish: consent } });
      setProduct(null);
      setStars(0);
      setAspects({});
      setTitle("");
      setBody("");
      notify("Gracias por tu reseña. La agencia la revisará antes de publicarla.");
      await reviews.reload();
    } catch (failure) {
      notify(failure instanceof ApiRequestError ? failure.message : "No pudimos enviar tu reseña. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen onRefresh={() => void reviews.reload()} refreshing={reviews.loading}>
      <RemoteState remote={reviews} empty="Las reseñas no están disponibles" />
      {data && pending.length === 0 && mine.length === 0 ? <Empty icon="star-outline" title="Aún no puedes calificar" text={waiting[0]?.reason ?? "La calificación estará disponible al completar tus servicios."} /> : null}
      {pending.length > 0 ? (
        <>
          <Text style={styles.intro}>Califica los servicios que ya realizaste. Tu reseña se publica con el sello de viaje verificado después de la revisión de la agencia.</Text>
          <Card>
            <FieldLabel text="Servicio" />
            <ChoiceChips options={pending.map((item) => ({ value: item.product.code, label: item.product.name }))} value={product} onChange={setProduct} />
            <FieldLabel text="Calificación" />
            <Stars value={stars} onChange={setStars} label="Calificación general" size={34} />
            {data?.subratings.map((aspect) => (
              <View key={aspect.key} style={styles.aspect}>
                <Text style={styles.aspectLabel}>{aspect.label}</Text>
                <Stars value={aspects[aspect.key] ?? 0} onChange={(value) => setAspects((current) => ({ ...current, [aspect.key]: value }))} label={aspect.label} size={22} />
              </View>
            ))}
            <FieldLabel text="Título" />
            <Field value={title} onChange={setTitle} placeholder="Resume tu experiencia" maxLength={120} />
            <FieldLabel text="Tu experiencia" hint={`${body.length}/2000`} />
            <Field value={body} onChange={setBody} placeholder="Cuéntanos cómo te fue (mínimo 20 caracteres)" multiline maxLength={2000} />
            <Pressable onPress={() => setConsent((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={styles.consent}>
              <Ionicons name={consent ? "checkbox" : "square-outline"} size={22} color={consent ? colors.accent : colors.fg3} />
              <Text style={styles.consentText}>Autorizo publicar mi reseña con mi nombre abreviado</Text>
            </Pressable>
            <Button label="Enviar reseña" icon="send-outline" onPress={() => void send()} busy={sending} disabled={!ready} />
          </Card>
        </>
      ) : null}

      {mine.length > 0 ? <SectionTitle title="Mis reseñas" aside={`${mine.length}`} /> : null}
      {mine.map((item) =>
        item.review ? (
          <Card key={item.review.code}>
            <View style={styles.top}>
              <Text style={styles.name}>{item.product.name}</Text>
              <Pill label={STATUS[item.review.status]?.label ?? item.review.status} tone={STATUS[item.review.status]?.tone ?? "mute"} />
            </View>
            <Stars value={item.review.stars} onChange={() => undefined} label={`${item.review.stars} de 5`} size={16} />
            <Text style={styles.body}>{item.review.title}</Text>
          </Card>
        ) : null,
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: font.small, color: colors.fg2 },
  aspect: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  aspectLabel: { fontSize: font.small, color: colors.fg2, flex: 1 },
  consent: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  consentText: { flex: 1, fontSize: font.small, color: colors.fg2 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  name: { flex: 1, fontSize: font.body, fontWeight: "700", color: colors.fg },
  body: { fontSize: font.small, color: colors.fg2 },
});
