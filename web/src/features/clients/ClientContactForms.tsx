"use client";

import { Mail, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeClientContactPrimary, removeClientContact, saveClientContact, sendClientCommunication, type ClientActionState } from "@/app/(backoffice)/crm/clientes/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ClientContact } from "@/lib/clients";

const initial: ClientActionState = { message: null, done: false };

export function ClientContactFormAction({ code, contact, first = false }: { code: string; contact?: ClientContact; first?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label={contact ? "Editar contacto" : "Agregar contacto"}
      icon={<Plus size={16} />}
      size="sm"
      formId={`client-contact-${code}-${contact?.id ?? "new"}`}
      title={contact ? `Editar a ${contact.name}` : "Nuevo contacto"}
      description="Las personas con las que la agencia coordina por este cliente: compras, recursos humanos, el asistente del viajero."
      submitLabel={contact ? "Guardar cambios" : "Agregar contacto"}
      action={saveClientContact}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={contact ? (open) => <RowIcon tone="edit" label="Editar contacto" onClick={open} /> : undefined}
      testId={contact ? undefined : "client-contact-add"}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          {contact && <input type="hidden" name="contact_id" value={contact.id} />}
          <TextField label="Nombre" name="name" required minLength={2} maxLength={150} defaultValue={contact?.name} />
          <TextField label="Cargo (opcional)" name="role" maxLength={100} defaultValue={contact?.role ?? ""} placeholder="Ejemplo: jefa de compras" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Correo (opcional)" name="email" type="email" maxLength={200} defaultValue={contact?.email ?? ""} />
            <TextField label="Teléfono (opcional)" name="phone" maxLength={40} defaultValue={contact?.phone ?? ""} />
          </div>
          {!contact && !first && <PrimarySwitch />}
        </>
      )}
    </PanelAction>
  );
}

function ContactStep({ code, contact, kind }: { code: string; contact: ClientContact; kind: "primary" | "remove" }) {
  const router = useRouter();
  const primary = kind === "primary";
  return (
    <PanelAction<ClientActionState>
      label={primary ? "Hacer principal" : "Quitar"}
      formId={`client-contact-${kind}-${contact.id}`}
      title={primary ? `¿Hacer principal a ${contact.name}?` : `¿Quitar a ${contact.name}?`}
      description={primary ? "Será el contacto que reciba las propuestas y los avisos de la agencia." : contact.is_primary ? "Es el contacto principal: otro contacto pasará a serlo." : "Deja de aparecer en la ficha del cliente. Queda registrado en la auditoría."}
      submitLabel={primary ? "Hacer principal" : "Quitar contacto"}
      action={primary ? makeClientContactPrimary : removeClientContact}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={(open) => (primary ? <RowIcon tone="view" label="Hacer principal" icon={<Star size={15} />} onClick={open} /> : <RowIcon tone="delete" label="Quitar contacto" icon={<Trash2 size={15} />} onClick={open} />)}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="contact_id" value={contact.id} />
        </>
      )}
    </PanelAction>
  );
}

export function ClientContactRowActions({ code, contact }: { code: string; contact: ClientContact }) {
  return (
    <RowActions>
      {!contact.is_primary && <ContactStep code={code} contact={contact} kind="primary" />}
      <ClientContactFormAction code={code} contact={contact} />
      <ContactStep code={code} contact={contact} kind="remove" />
    </RowActions>
  );
}

export function ClientCommunicationAction({ code, email, name }: { code: string; email: string | null; name: string }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Escribirle"
      icon={<Mail size={16} />}
      formId={`client-communication-${code}`}
      title={`Escribir a ${name}`}
      description="Se envía por correo desde la cuenta de la agencia y queda en «Comunicaciones» y en la auditoría."
      submitLabel="Enviar correo"
      action={sendClientCommunication}
      initial={initial}
      onDone={() => router.refresh()}
      testId="client-communication"
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <TextField label="Para" name="recipient" type="email" required maxLength={200} defaultValue={email ?? ""} hint="Puedes cambiarlo por el de un contacto del cliente." />
          <TextField label="Asunto" name="subject" required minLength={3} maxLength={200} placeholder="Ejemplo: Tu propuesta de viaje a Cusco" />
          <TextArea label="Mensaje" name="body" rows={8} required minLength={5} maxLength={5000} />
        </>
      )}
    </PanelAction>
  );
}

function PrimarySwitch() {
  const [checked, setChecked] = useState(false);
  return <SwitchField label="Contacto principal" name="is_primary" checked={checked} onCheckedChange={setChecked} hint="Recibe las propuestas y los avisos de la agencia." />;
}
