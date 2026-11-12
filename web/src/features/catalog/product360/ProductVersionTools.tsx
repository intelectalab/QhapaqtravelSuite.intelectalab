"use client";

import { Calculator, Copy, GitCompare, GitBranchPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { compareProductVersions, createProductVersion, duplicateProduct, resolveProductRate, type ProductActionState, type ResolvedRate, type VersionChange } from "@/app/(backoffice)/catalogo/productos/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";

const initial: ProductActionState = { message: null, done: false };

const SEGMENTS = ["Adulto", "Niño", "Infante", "Pasajero", "Grupo"].map((value) => ({ value, label: value }));

const CHANNELS = ["Directo", "B2B", "Corporativo", "E-commerce", "Mayorista", "Todos"].map((value) => ({ value, label: value }));

export function NewVersionAction({ code }: { code: string }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState> label="Nueva versión" icon={<GitBranchPlus size={15} />} variant="secondary" size="sm" formId={`version-${code}`} title="Crear una versión" description="Guarda una copia completa del producto (componentes, itinerario, tarifas y políticas). Las versiones anteriores quedan como históricas." submitLabel="Crear versión" action={createProductVersion} initial={initial} onDone={() => router.refresh()}>
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <ChoiceGroup label="Tipo de cambio" name="kind" options={[{ value: "minor", label: "Menor (1.1 → 1.2)" }, { value: "major", label: "Mayor (1.2 → 2.0)" }]} defaultValue="minor" />
          <TextField label="Vigente desde" name="valid_from" type="date" required />
          <TextArea label="Motivo" name="reason" rows={2} required minLength={5} maxLength={500} placeholder="Por ejemplo: cambio de hotel en Aguas Calientes." />
        </>
      )}
    </PanelAction>
  );
}

export function DuplicateProductAction({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState> label="Duplicar" icon={<Copy size={15} />} variant="ghost" formId={`duplicate-${code}`} title="Duplicar como borrador" description={`Se crea «${name} (copia)» con código ${code}-Cnn, en borrador, sin salidas ni promociones y con tarifas de referencia nueva.`} submitLabel="Duplicar" action={duplicateProduct} initial={initial} onDone={(state) => router.push(state.code ? `/catalogo/productos/${state.code}` : "/catalogo/productos")}>
      {() => <input type="hidden" name="code" value={code} />}
    </PanelAction>
  );
}

export function CompareVersions({ code, versions }: { code: string; versions: string[] }) {
  const [from, setFrom] = useState(versions[1] ?? versions[0] ?? "");
  const [to, setTo] = useState(versions[0] ?? "");
  const [changes, setChanges] = useState<VersionChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (versions.length < 2) return null;

  const run = () =>
    start(async () => {
      const result = await compareProductVersions(code, from, to);
      if ("error" in result) {
        setError(result.error);
        setChanges(null);
      } else {
        setError(null);
        setChanges(result.changes);
      }
    });

  const options = versions.map((value) => ({ value, label: `v${value}` }));

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Versión A" name="from" options={options} value={from} onChange={setFrom} className="w-36" />
        <SelectField label="Versión B" name="to" options={options} value={to} onChange={setTo} className="w-36" />
        <Button size="sm" variant="secondary" icon={<GitCompare size={15} />} onClick={run} disabled={pending || from === to}>
          {pending ? "Comparando…" : "Comparar"}
        </Button>
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      {changes && (
        <div className="mt-3">
          {changes.length === 0 ? (
            <p className="text-[13px] text-fg-3">Las dos versiones son iguales.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto text-[12.5px]">
              {changes.map((change) => (
                <li key={change.field} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <span className="truncate font-mono text-fg-3" title={change.field}>{change.field}</span>
                  <span className="truncate text-bad line-through" title={String(change.before ?? "")}>{String(change.before ?? "—")}</span>
                  <span className="truncate text-ok" title={String(change.after ?? "")}>{String(change.after ?? "—")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ResolveRate({ code }: { code: string }) {
  const [date, setDate] = useState("");
  const [segment, setSegment] = useState("Adulto");
  const [channel, setChannel] = useState("Directo");
  const [result, setResult] = useState<{ chosen: string | null; rates: ResolvedRate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const response = await resolveProductRate(code, date, segment, channel);
      if ("error" in response) {
        setError(response.error);
        setResult(null);
      } else {
        setError(null);
        setResult(response);
      }
    });

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3.5">
      <p className="mb-2 text-[12.5px] font-semibold text-fg-2">¿Qué tarifa aplica?</p>
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Fecha" name="resolve_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-40" />
        <SelectField label="Segmento" name="resolve_segment" options={SEGMENTS} value={segment} onChange={setSegment} className="w-36" />
        <SelectField label="Canal" name="resolve_channel" options={CHANNELS} value={channel} onChange={setChannel} className="w-40" />
        <Button size="sm" variant="secondary" icon={<Calculator size={15} />} onClick={run} disabled={pending || date === ""}>
          {pending ? "Resolviendo…" : "Resolver"}
        </Button>
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      {result && (
        <ul className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
          {result.rates.map((rate) => (
            <li key={rate.ref} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
              <b className="font-mono">{rate.ref}</b>
              <span className="text-fg-2">{rate.type} · {rate.segment} · {rate.channel} · {rate.currency} {rate.price}</span>
              <span className="ml-auto">{rate.ref === result.chosen ? <Badge tone="ok">Aplica</Badge> : rate.selectable ? <Badge tone="info">Seleccionable</Badge> : <Badge tone="mute">{rate.reason ?? "No seleccionable"}</Badge>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
