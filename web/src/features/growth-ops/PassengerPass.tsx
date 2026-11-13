"use client";

import { CalendarDays, Eraser, FileSignature, QrCode, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type PointerEvent } from "react";
import { signWaiver } from "@/app/(portal)/portal/crecimiento-actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import type { PassengerPasses } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

function SignaturePad({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width, y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#1a1d2e";
    context.beginPath();
    context.moveTo(x, y);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const { x, y } = point(event);
    context?.lineTo(x, y);
    context?.stroke();
  };
  const end = () => {
    drawing.current = false;
    if (canvas.current) setValue(canvas.current.toDataURL("image/png"));
  };
  const clear = () => {
    const context = canvas.current?.getContext("2d");
    if (canvas.current && context) context.clearRect(0, 0, canvas.current.width, canvas.current.height);
    setValue("");
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Firma</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-fg-3 transition hover:text-fg">
          <Eraser size={13} />
          Borrar
        </button>
      </div>
      <canvas ref={canvas} width={600} height={220} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="h-[160px] w-full touch-none rounded-xl border border-dashed border-line bg-white" aria-label="Dibuja tu firma con el dedo o el mouse" />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function SignAction({ passenger, waiver }: { passenger: PassengerPasses["passengers"][number]; waiver: NonNullable<PassengerPasses["waiver"]> }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label="Firmar" icon={<FileSignature size={15} />} size="sm" variant="primary" formId={`waiver-${passenger.id}`} title={`Deslinde de ${passenger.name}`} description={`${waiver.name} · versión ${waiver.version}`} submitLabel="Firmar deslinde" action={signWaiver} initial={initial} onDone={() => router.refresh()}>
      {() => (
        <>
          <input type="hidden" name="passenger_id" value={passenger.id} />
          <input type="hidden" name="template_code" value={waiver.code} />
          <div className="scroll-thin max-h-[260px] overflow-y-auto whitespace-pre-line rounded-xl bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-fg-2">{waiver.body}</div>
          <TextField label="Nombre completo de quien firma" name="signed_name" required minLength={3} maxLength={160} defaultValue={passenger.minor ? "" : passenger.name} />
          {passenger.minor && waiver.requires_guardian_for_minors && <TextField label="Madre, padre o tutor" name="guardian_name" required minLength={3} maxLength={160} hint={`${passenger.name} es menor de edad: firma su tutor.`} />}
          <SignaturePad name="signature" />
        </>
      )}
    </PanelAction>
  );
}

export function PassengerPassView({ data }: { data: PassengerPasses }) {
  if (!data.trip) return <Card><p className="py-10 text-center text-[13px] text-fg-3">No tienes un viaje con pases todavía.</p></Card>;
  const pending = data.passengers.filter((passenger) => passenger.waiver === "pendiente" || passenger.waiver === "falta_tutor");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Mi pase</h1>
        <p className="text-[13px] text-fg-3">{data.trip.title} · {formatDate(data.trip.travel_from)} – {formatDate(data.trip.travel_to)}</p>
      </div>
      {data.waiver && (
        <Card>
          <TintCardTitle icon={FileSignature} title="Deslinde de responsabilidad" aside={pending.length ? `${pending.length} por firmar` : "Todos firmaron"} tone={pending.length ? "warn" : "ok"} />
          <p className="mb-3 text-[13px] text-fg-2">Cada pasajero firma una vez antes de su primera actividad. Sin la firma, el guía no puede registrar el ingreso.</p>
          <ul className="grid gap-2">
            {data.passengers.map((passenger) => (
              <li key={passenger.id} className="lift flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 text-[13px]">
                  <b className="font-semibold">{passenger.name}</b>
                  {passenger.minor && <span className="text-fg-3"> · menor de edad</span>}
                  {passenger.signed_at && <span className="block text-[12px] text-fg-3">Firmado el {formatDateTime(passenger.signed_at)}</span>}
                </span>
                <Badge tone={passenger.waiver === "firmado" ? "ok" : "warn"}>{passenger.waiver_label}</Badge>
                {passenger.waiver !== "firmado" && data.waiver && <SignAction passenger={passenger} waiver={data.waiver} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {data.passes.length === 0 ? (
        <Card><p className="py-8 text-center text-[13px] text-fg-3">No hay actividades próximas con pase.</p></Card>
      ) : (
        data.passes.map((group) => (
          <Card key={group.service.code}>
            <TintCardTitle icon={group.service.is_today ? QrCode : CalendarDays} title={group.service.name} aside={`${formatDate(group.service.date)}${group.service.time ? ` · ${group.service.time}` : ""}`} tone={group.service.is_today ? "ok" : undefined} />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.passengers.map((pass) => (
                <li key={pass.passenger_id} className={cn("lift grid justify-items-center gap-2 rounded-xl border px-4 py-4 text-center", pass.status === "usado" ? "border-transparent bg-[color-mix(in_srgb,var(--ok)_9%,var(--surface))]" : "border-line bg-surface")}>
                  <b className="text-[13.5px] font-semibold">{pass.name}</b>
                  {pass.qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pass.qr} alt={`Pase QR de ${pass.name} para ${group.service.name}`} className="h-40 w-40 rounded-lg bg-white p-1" />
                  ) : (
                    <span className="grid h-40 w-40 place-items-center rounded-lg bg-surface-2 text-ok"><UserCheck size={36} /></span>
                  )}
                  <Badge tone={pass.status === "usado" ? "ok" : "info"}>{pass.status_label}</Badge>
                  {pass.scanned_at && <span className="text-[12px] text-fg-3">{formatDateTime(pass.scanned_at)}</span>}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
