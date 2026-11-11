"use client";

import { Siren } from "lucide-react";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { SEVERITY_LABEL } from "@/lib/operations";
import { ConfirmNote, OpsStep } from "./OpsStep";

const TYPES = ["Transporte", "Proveedor", "Salud del pasajero", "Horario", "Clima", "Documentación", "Equipaje", "Seguridad", "Capacidad", "Pasajero", "Otro"];

const TYPE_LABEL: Record<string, string> = { comentario: "Comentario", sugerencia: "Sugerencia", felicitacion: "Felicitación", reclamo: "Reclamo", incidencia: "Incidencia" };

interface FeedbackItem {
  code: string;
  type: string;
  text: string;
  rating: number | null;
  status: string;
  passenger_name: string | null;
  service_name: string | null;
}

export function FeedbackIncidentAction({ feedback }: { feedback: FeedbackItem }) {
  if (feedback.status === "derivado") return null;
  const severity = feedback.type === "incidencia" ? "alta" : feedback.type === "reclamo" ? "media" : "baja";
  const excerpt = feedback.text.length > 60 ? `${feedback.text.slice(0, 60)}…` : feedback.text;
  return (
    <OpsStep
      step="feedback_incident"
      target={feedback.code}
      label="Derivar a incidencia"
      icon={<Siren size={15} />}
      size="sm"
      title="Derivar a incidencia"
      description={`${feedback.code}${feedback.passenger_name ? ` · ${feedback.passenger_name}` : ""}`}
      submitLabel="Crear incidencia"
    >
      <ConfirmNote>Se crea una incidencia en Operaciones con el texto del pasajero{feedback.service_name ? ` y el servicio ${feedback.service_name}` : ""}. La asume el coordinador de la orden y el comentario queda como derivado.</ConfirmNote>
      <TextField label="Título" name="title" required minLength={5} maxLength={200} defaultValue={`${TYPE_LABEL[feedback.type] ?? "Comentario"} del pasajero: ${excerpt}`} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo" name="type" options={TYPES.map((value) => ({ value, label: value }))} defaultValue="Pasajero" />
        <SelectField label="Severidad" name="severity" options={Object.entries(SEVERITY_LABEL).map(([value, label]) => ({ value, label }))} defaultValue={severity} />
      </div>
      <TextArea label="Descripción" name="description" rows={4} required minLength={5} maxLength={4000} defaultValue={`${feedback.text}${feedback.rating ? ` (calificación ${feedback.rating}/5)` : ""}`} />
    </OpsStep>
  );
}
