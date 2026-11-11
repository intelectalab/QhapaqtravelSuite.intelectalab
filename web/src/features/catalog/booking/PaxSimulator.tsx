"use client";

import { CircleAlert, CircleCheck, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { simulatePax } from "@/app/(backoffice)/catalogo/productos/booking-actions";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PAX_TYPE_LABEL, type PaxSimulation } from "@/lib/catalog-booking";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

export function PaxSimulator({ code }: { code: string }) {
  const [pax, setPax] = useState({ adt: "2", chd: "1", inf: "0", ages: "" });
  const [result, setResult] = useState<PaxSimulation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const ages = pax.ages.split(/[,\s]+/).filter(Boolean).map(Number).filter((age) => Number.isFinite(age));
      const response = await simulatePax(code, { adt: Number(pax.adt) || 0, chd: Number(pax.chd) || 0, inf: Number(pax.inf) || 0, ages });
      if (response.ok) {
        setResult(response.data);
        setError(null);
      } else {
        setError(response.message);
      }
    });

  return (
    <div className="rounded-[14px] border border-line p-4">
      <p className="mb-3 text-[13.5px] font-semibold">Simulador de pasajeros</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(3,minmax(0,90px))_minmax(0,1fr)_auto] sm:items-end">
        <TextField label="Adultos" name="sim_adt" type="number" min={0} max={50} value={pax.adt} onChange={(event) => setPax({ ...pax, adt: event.target.value })} />
        <TextField label="Niños" name="sim_chd" type="number" min={0} max={50} value={pax.chd} onChange={(event) => setPax({ ...pax, chd: event.target.value })} />
        <TextField label="Infantes" name="sim_inf" type="number" min={0} max={50} value={pax.inf} onChange={(event) => setPax({ ...pax, inf: event.target.value })} />
        <TextField label="Edades a clasificar" name="sim_ages" value={pax.ages} placeholder="35, 7, 2" onChange={(event) => setPax({ ...pax, ages: event.target.value })} />
        <Button type="button" variant="secondary" icon={<Play size={15} />} disabled={pending} onClick={run}>
          {pending ? "Calculando…" : "Simular"}
        </Button>
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      {result && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 motion-safe:animate-[rise-in_260ms_ease-out_backwards]">
          <div>
            <p className={cn("mb-2 flex items-center gap-1.5 text-[13px] font-semibold", result.ok ? "text-ok" : "text-bad")}>
              {result.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
              {result.ok ? `Válido · ocupa ${result.seats} asiento(s)` : "No se puede reservar así"}
            </p>
            <ul className="flex flex-col gap-1 text-[13px] text-fg-2">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {result.warnings.map((item) => (
                <li key={item} className="text-fg-3">{item}</li>
              ))}
            </ul>
            {result.ages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.ages.map((item, index) => (
                  <span key={`${item.age}-${index}`} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold", item.type === "NA" ? "border-bad/40 text-bad" : "border-line text-fg-2")}>
                    {item.age} años · {PAX_TYPE_LABEL[item.type]}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <ul className="flex flex-col divide-y divide-line-2 text-[13px]">
              {result.lines.map((line) => (
                <li key={line.key} className="flex items-center justify-between gap-3 py-1.5">
                  <span>
                    {line.label}
                    <span className="ml-1 text-fg-3">× {line.qty}</span>
                  </span>
                  <span className="font-mono">{formatMoney(line.amount, result.currency)}</span>
                </li>
              ))}
              <li className="flex justify-between py-1.5 font-semibold">
                <span>Base</span>
                <span className="font-mono">{formatMoney(result.subtotal, result.currency)}</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
