"use client";

import { CalendarDays, Mail, Phone, Plus, TriangleAlert, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { CrmCatalogs } from "@/lib/leads";

const options = (items: CrmCatalogs[keyof CrmCatalogs]) => items.map((item) => ({ value: item.code, label: item.label }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[13.5px] font-semibold text-fg border-b border-line-2 pb-1.5">{title}</h3>
      {children}
    </section>
  );
}

export function LeadCreateAction({ catalogs }: { catalogs: CrmCatalogs }) {
  const router = useRouter();

  return (
    <PanelAction<LeadActionState>
      label="Nuevo lead"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      title="Nuevo lead"
      description="Registra a la persona interesada. Revisamos si ya existe como lead o cliente antes de guardarla."
      submitLabel="Registrar lead"
      action={createLead}
      initial={{ message: null, done: false }}
      onDone={(state) => state.result?.code && router.push(`/crm/leads/${state.result.code}`)}
      footerExtra={(state, pending) =>
        state.matches && state.matches.length > 0 ? (
          <Button type="submit" form="panel-nuevo-lead" name="duplicate_resolution" value="mark_duplicate" variant="ghost" disabled={pending}>
            Marcar como duplicado
          </Button>
        ) : null
      }
    >
      {(state) => (
        <>
          {state.matches && state.matches.length > 0 && (
            <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 text-[13px]">
              <p className="mb-2 flex items-center gap-2 font-semibold text-warn">
                <TriangleAlert size={16} />
                Ya existe con ese correo o teléfono
              </p>
              <ul className="mb-2 flex flex-col gap-1 text-fg-2">
                {state.matches.map((match) => (
                  <li key={match.code}>
                    {match.type === "client" ? "Cliente" : "Lead"} <b className="text-fg">{match.name}</b> · {match.code}
                  </li>
                ))}
              </ul>
              <p className="text-fg-3">Si es otra persona, regístralo igual. Si es la misma, márcalo como duplicado.</p>
              <input type="hidden" name="duplicate_resolution" value="create_new" />
            </div>
          )}
          <Section title="Persona">
            <TextField label="Nombre" name="name" required autoFocus icon={<User size={17} />} />
            <TextField label="Empresa (opcional)" name="company" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Correo" name="email" type="email" icon={<Mail size={17} />} />
              <TextField label="Teléfono" name="phone" inputMode="tel" icon={<Phone size={17} />} />
            </div>
            <p className="-mt-1 text-[12.5px] text-fg-3">Basta con el correo o el teléfono.</p>
          </Section>
          <Section title="Cómo llegó">
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Fuente" name="source" options={options(catalogs.lead_source)} placeholder="Elegir" />
              <SelectField label="Canal" name="channel" options={options(catalogs.lead_channel)} placeholder="Elegir" />
            </div>
          </Section>
          <Section title="Qué busca">
            <SelectField label="Interés" name="interest" options={options(catalogs.lead_interest)} placeholder="Elegir" />
            <TextField label="Destino" name="destination" placeholder="Por ejemplo: Cusco" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Fecha de viaje" name="travel_date" type="date" icon={<CalendarDays size={17} />} />
              <TextField label="Pasajeros" name="pax" type="number" min={0} icon={<Users size={17} />} />
            </div>
            <TextArea label="Notas" name="notes" rows={3} placeholder="Lo que contó en el primer mensaje." />
          </Section>
        </>
      )}
    </PanelAction>
  );
}
