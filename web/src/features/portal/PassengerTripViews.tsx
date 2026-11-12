"use client";

import { BellRing, CheckCheck, Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { ackAlert, readNotice, saveCompanions } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PaxAlerts, PaxCompanions } from "@/lib/portal";

const SEVERITY: Record<string, "mute" | "warn" | "bad"> = { baja: "mute", media: "warn", alta: "bad", critica: "bad" };

const PAX: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };

const DOCS = [{ value: "DNI", label: "DNI" }, { value: "CE", label: "Carné ext." }, { value: "Pasaporte", label: "Pasaporte" }];

function AckButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => setMessage((await ackAlert(code)).message))} className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
        Entendido
      </button>
      {message && <span className="text-[12.5px] text-bad">{message}</span>}
    </div>
  );
}

export function PassengerAlertsView({ data }: { data: PaxAlerts }) {
  const open = data.alerts.filter((alert) => !alert.acked);
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">Avisos de tu viaje</h1>
        <p className="text-[13px] text-fg-3">Cambios de horario o de transporte que debes conocer. Confirma que los leíste para que tu coordinador lo sepa.</p>
      </div>
      {data.alerts.length === 0 ? (
        <Card>
          <EmptyState icon={<BellRing size={22} />} title="Sin avisos por ahora" description="Si algo cambia en tu viaje te lo contaremos aquí y por correo." />
        </Card>
      ) : (
        <ul className="grid gap-3">
          {data.alerts.map((alert, index) => (
            <li key={alert.code} className={cn("rounded-card border bg-surface p-5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", alert.acked ? "border-line" : "border-[color-mix(in_srgb,var(--warn)_40%,transparent)]")} style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEVERITY[alert.severity] ?? "mute"}>{alert.type}</Badge>
                    <span className="text-[12px] text-fg-3">{formatDateTime(alert.at)}</span>
                  </div>
                  <h2 className="mt-1.5 text-[16px] font-bold tracking-tight text-fg">{alert.title}</h2>
                  {alert.message && <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{alert.message}</p>}
                </div>
                {alert.acked ? <Badge tone="ok">Leído</Badge> : <AckButton code={alert.code} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open.length === 0 && data.alerts.length > 0 && <p className="text-[13px] text-fg-3">Confirmaste todos los avisos.</p>}
      {data.notices.length > 0 && <ReceivedMessages notices={data.notices} />}
    </div>
  );
}

const CHANNEL_LABEL: Record<string, string> = { email: "Correo", whatsapp: "WhatsApp", sms: "SMS", push: "App", portal: "Portal" };

function ReceivedMessages({ notices }: { notices: PaxAlerts["notices"] }) {
  const [channel, setChannel] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const channels = [...new Set(notices.map((notice) => notice.channel))];
  const isRead = (notice: PaxAlerts["notices"][number]) => notice.read || read.includes(notice.code);
  const unread = notices.filter((notice) => !isRead(notice)).length;
  const visible = channel ? notices.filter((notice) => notice.channel === channel) : notices;
  const open = (code: string, wasRead: boolean) => {
    setOpenCode(openCode === code ? null : code);
    if (!wasRead) {
      setRead((current) => [...current, code]);
      start(async () => void (await readNotice(code)));
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          Mensajes que te enviamos
          {unread > 0 && <Badge tone="info">{unread === 1 ? "1 sin leer" : `${unread} sin leer`}</Badge>}
        </h2>
        {unread > 0 && (
          <button type="button" disabled={pending} onClick={() => { setRead(notices.map((notice) => notice.code)); start(async () => void (await readNotice(null))); }} className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[12.5px] font-semibold text-t1 transition hover:bg-surface-2 disabled:opacity-60">
            <CheckCheck size={14} /> Marcar todos como leídos
          </button>
        )}
      </div>
      {channels.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[null, ...channels].map((value) => (
            <button key={value ?? "todos"} type="button" onClick={() => setChannel(value)} className={cn("h-7 rounded-full px-3 text-[12px] font-semibold transition", channel === value ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-2 hover:text-fg")}>
              {value ? (CHANNEL_LABEL[value] ?? value) : "Todos"}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-3 grid gap-2">
        {visible.map((notice) => {
          const wasRead = isRead(notice);
          const expanded = openCode === notice.code;
          return (
            <li key={notice.code}>
              <button type="button" onClick={() => open(notice.code, wasRead)} aria-expanded={expanded} className={cn("lift w-full rounded-xl border px-4 py-3 text-left transition hover:bg-surface-2", wasRead ? "border-line" : "border-[color-mix(in_srgb,var(--t1)_35%,transparent)]")}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {!wasRead && <span aria-label="Sin leer" className="h-2 w-2 flex-none rounded-full bg-t1" />}
                    <b className={cn("truncate text-[14px] text-fg", wasRead ? "font-medium" : "font-semibold")}>{notice.subject}</b>
                  </span>
                  <span className="flex items-center gap-2 text-[12px] text-fg-3">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5">{CHANNEL_LABEL[notice.channel] ?? notice.channel}</span>
                    {notice.at ? formatDateTime(notice.at) : ""}
                  </span>
                </span>
                <span className={cn("mt-1 block whitespace-pre-line text-[13px] leading-relaxed text-fg-2", !expanded && "line-clamp-1")}>{notice.body}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

type Draft = Record<"first_name" | "last_name" | "birth_date" | "doc_type" | "doc_number" | "nationality" | "diet", string>;

export function CompanionsForm({ data }: { data: PaxCompanions }) {
  const pendingSeqs = data.passengers.filter((passenger) => passenger.pending).map((passenger) => passenger.seq);
  const [editing, setEditing] = useState<number[]>(pendingSeqs);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [pickup, setPickup] = useState({ address: data.pickup?.address ?? "", flight: data.pickup?.flight ?? "", arrival: data.pickup?.arrival?.slice(0, 16) ?? "" });
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const draft = (seq: number): Draft => drafts[seq] ?? { first_name: "", last_name: "", birth_date: "", doc_type: "Pasaporte", doc_number: "", nationality: "Perú", diet: "" };
  const set = (seq: number, key: keyof Draft, value: string) => setDrafts({ ...drafts, [seq]: { ...draft(seq), [key]: value } });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">Viajeros y recojo</h1>
        <p className="text-[13px] text-fg-3">
          Reserva {data.code}. {data.editable ? "Completa los datos que faltan antes del viaje; los usamos para entradas, trenes y seguros." : "Los datos ya no se pueden cambiar desde el portal; escríbenos si necesitas corregir algo."}
        </p>
      </div>
      <Card>
        <ul className="grid gap-3">
          {data.passengers.map((passenger) => {
            const open = data.editable && editing.includes(passenger.seq);
            const value = draft(passenger.seq);
            return (
              <li key={passenger.seq} className={cn("rounded-xl border px-4 py-3", passenger.pending ? "border-[color-mix(in_srgb,var(--warn)_40%,transparent)]" : "border-line")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <b className="text-[14px] font-semibold text-fg">{passenger.name}</b>
                    <span className="ml-2 text-[12px] text-fg-3">
                      {PAX[passenger.type] ?? passenger.type}
                      {passenger.lead ? " · titular" : ""}
                      {passenger.document ? ` · ${passenger.doc_type ?? ""} ${passenger.document}` : ""}
                      {passenger.birth_date ? ` · ${formatDate(passenger.birth_date)}` : ""}
                    </span>
                  </span>
                  {passenger.pending ? <Badge tone="warn">Por completar</Badge> : data.editable && !open ? (
                    <button type="button" onClick={() => setEditing([...editing, passenger.seq])} className="text-[12.5px] font-semibold text-accent hover:underline">
                      Corregir
                    </button>
                  ) : null}
                </div>
                {open && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <TextField label="Nombres" value={value.first_name} onChange={(event) => set(passenger.seq, "first_name", event.target.value)} />
                    <TextField label="Apellidos" value={value.last_name} onChange={(event) => set(passenger.seq, "last_name", event.target.value)} />
                    <TextField label="Fecha de nacimiento" type="date" value={value.birth_date} onChange={(event) => set(passenger.seq, "birth_date", event.target.value)} />
                    <SelectField label="Documento" name={`doc_type_${passenger.seq}`} options={DOCS} value={value.doc_type} onChange={(next) => set(passenger.seq, "doc_type", next)} />
                    <TextField label="Número" value={value.doc_number} onChange={(event) => set(passenger.seq, "doc_number", event.target.value)} />
                    <TextField label="Nacionalidad" value={value.nationality} onChange={(event) => set(passenger.seq, "nationality", event.target.value)} />
                    <TextField label="Restricciones alimentarias" className="sm:col-span-2 lg:col-span-3" value={value.diet} onChange={(event) => set(passenger.seq, "diet", event.target.value)} hint="Opcional" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {data.pickup && (
        <Card>
          <h2 className="text-[15px] font-semibold text-fg">Recojo</h2>
          <p className="text-[12.5px] text-fg-3">{data.pickup.point ? `Punto elegido: ${data.pickup.point}.` : "Indícanos dónde te recogemos."}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <TextField label="Hotel o dirección" value={pickup.address} disabled={!data.editable} onChange={(event) => setPickup({ ...pickup, address: event.target.value })} />
            <TextField label="Vuelo (si llegas en avión)" value={pickup.flight} disabled={!data.editable} onChange={(event) => setPickup({ ...pickup, flight: event.target.value })} />
            <TextField label="Llegada" type="datetime-local" value={pickup.arrival} disabled={!data.editable} onChange={(event) => setPickup({ ...pickup, arrival: event.target.value })} />
          </div>
        </Card>
      )}
      {data.editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const passengers = editing.map((seq) => ({ seq, ...draft(seq) }));
                const response = await saveCompanions(data.code, data.lock_version, { passengers, ...(data.pickup ? { pickup: { address: pickup.address || null, flight: pickup.flight || null, arrival: pickup.arrival || null } } : {}) });
                setResult({ ok: response.done, message: response.done ? "Guardamos los datos de los viajeros." : (response.message ?? "No pudimos guardar.") });
                if (response.done) setEditing([]);
              })
            }
            className="inline-flex h-11 items-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
          {result && <span className={cn("text-[13px]", result.ok ? "text-ok" : "text-bad")}>{result.message}</span>}
        </div>
      )}
    </div>
  );
}
