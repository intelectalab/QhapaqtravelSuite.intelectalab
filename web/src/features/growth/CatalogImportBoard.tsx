"use client";

import { Check, CircleCheck, FileSearch, Globe, Layers, PackagePlus, Plus, Sparkles, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { confirmImport, startImport } from "@/app/(backoffice)/catalogo/importar/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FilePicker } from "@/components/ui/FilePicker";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import { labelOptions, type CatalogImportDetail, type ImportedProduct, type ImportsOverview } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

function NewImport({ overview }: { overview: ImportsOverview }) {
  const [source, setSource] = useState("url");
  return (
    <PanelAction<StepResult>
      label="Nueva importación"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="importacion-nueva"
      title="Importar productos"
      description="La IA lee la fuente y propone productos. Nada se publica: tú eliges cuáles crear y quedan en borrador."
      submitLabel="Analizar"
      action={startImport}
      initial={initial}
      testId="import-create"
    >
      {() => (
        <>
          <ChoiceGroup label="Fuente" name="source_type" options={labelOptions(overview.catalogs.sources)} defaultValue={source} onChange={setSource} />
          {source === "url" && <TextField label="Dirección de la página" name="source_url" type="url" required placeholder="https://" icon={<Globe size={17} />} hint="La página de tours de tu operador o proveedor." />}
          {source === "csv" && <TextArea label="Pegar la planilla" name="content" rows={6} placeholder={"nombre,destino,dias,precio,moneda\nCity tour Cusco,Cusco,1,120,PEN"} hint="Columnas: nombre, destino, días, precio y moneda. También puedes adjuntar el archivo." />}
          {source !== "url" && <FilePicker label="Archivo" accept={source === "pdf" ? ".pdf" : source === "csv" ? ".csv,.txt" : ".xlsx,.xls"} formats={source === "pdf" ? "PDF" : source === "csv" ? "CSV" : "Excel"} maxKb={10240} />}
        </>
      )}
    </PanelAction>
  );
}

function ProductPick({ product, selected, onToggle }: { product: ImportedProduct; selected: boolean; onToggle: () => void }) {
  const done = product.created_code !== null;
  const confidence = Math.round(product.confidence * 100);
  return (
    <li>
      <button type="button" disabled={done} aria-pressed={selected} onClick={onToggle} className={cn("lift flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition", selected ? "border-accent bg-accent/5" : "border-line bg-surface", done && "opacity-70")}>
        <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border", selected || done ? "border-accent bg-accent text-white" : "border-line")}>{(selected || done) && <Check size={13} />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{product.name}</span>
          <span className="mt-0.5 block text-[12.5px] text-fg-3">
            {product.destination ?? "Sin destino"}
            {!product.destination_known && product.destination ? " · destino nuevo, se usará el principal" : ""} · {product.duration_days} {product.duration_days === 1 ? "día" : "días"}
            {product.price ? ` · ${formatMoney(product.price, product.currency)}` : ""}
          </span>
          {done && <span className="mt-1 block font-mono text-[12px] text-ok">Creado como {product.created_code}</span>}
        </span>
        <span className="flex-none text-right">
          <span className={cn("block text-[15px] font-bold", confidence >= 90 ? "text-ok" : confidence >= 75 ? "text-[var(--t2)]" : "text-bad")}>{confidence} %</span>
          <span className="block text-[11px] text-fg-3">confianza</span>
        </span>
      </button>
      {selected && <input type="hidden" name="products" value={product.key} />}
    </li>
  );
}

function ReviewAction({ detail }: { detail: CatalogImportDetail }) {
  const pending = detail.products.filter((product) => product.created_code === null);
  const [selected, setSelected] = useState<string[]>(pending.filter((product) => product.confidence >= 0.75).map((product) => product.key));
  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  return (
    <PanelAction<StepResult>
      label="Revisar"
      formId={`importacion-${detail.code}`}
      title={`Revisar ${detail.code}`}
      description={`${detail.source_label}${detail.source ? ` · ${detail.source}` : ""}. Los productos se crean en borrador, marcados como detectados por IA.`}
      submitLabel={`Crear ${selected.length} en borrador`}
      action={confirmImport}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Revisar productos detectados" icon={<FileSearch size={15} />} onClick={open} />}
      footerExtra={(_, busy) => (
        <Button type="submit" form={`importacion-${detail.code}`} name="step" value="cancel" variant="ghost" disabled={busy} formNoValidate>
          Descartar importación
        </Button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={detail.code} />
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-fg-2">{detail.products.length} productos detectados</span>
            <button type="button" className="font-semibold text-accent" onClick={() => setSelected(selected.length === pending.length ? [] : pending.map((product) => product.key))}>
              {selected.length === pending.length ? "Quitar todos" : "Elegir todos"}
            </button>
          </div>
          <ul className="grid gap-2">
            {detail.products.map((product) => (
              <ProductPick key={product.key} product={product} selected={selected.includes(product.key)} onToggle={() => toggle(product.key)} />
            ))}
          </ul>
        </>
      )}
    </PanelAction>
  );
}

export function CatalogImportBoard({ overview, details }: { overview: ImportsOverview; details: CatalogImportDetail[] }) {
  const { kpis } = overview;
  const detailOf = (code: string) => details.find((detail) => detail.code === code);
  return (
    <>
      <PlanNotice enabled={overview.enabled} feature="El importador de productos con IA" />
      <KpiRow>
        <TintTile icon={Layers} tone="t1" label="Importaciones" value={kpis.total} info={<p>Importaciones iniciadas desde una página web, un PDF o una planilla.</p>} />
        <TintTile icon={FileSearch} tone="sun" label="Por revisar" value={kpis.review} info={<p>Importaciones con productos detectados que esperan tu revisión antes de crearse.</p>} />
        <TintTile icon={Sparkles} tone="violet" label="Productos detectados" value={kpis.detected} info={<p>Suma de los productos que la IA encontró en todas las importaciones, con su nivel de confianza.</p>} />
        <TintTile icon={PackagePlus} tone="ok" label="Creados en borrador" value={kpis.created} info={<p>Productos que elegiste crear. Quedan en borrador en el catálogo hasta que completes tarifas y los actives.</p>} />
      </KpiRow>
      <DataTable
        screen="catalogo-importar"
        rows={overview.imports}
        getKey={(row) => row.code}
        entityLabel="importaciones"
        searchText={(row) => `${row.code} ${row.source ?? ""}`}
        searchPlaceholder="Buscar por código o fuente"
        metrics={[
          { id: "revision", label: "Por revisar", tone: "sun", icon: <FileSearch size={18} />, matches: (row) => row.status === "revision" },
          { id: "importado", label: "Importadas", tone: "ok", icon: <CircleCheck size={18} />, matches: (row) => row.status === "importado" },
          { id: "fallido", label: "Con error", tone: "bad", icon: <XCircle size={18} />, matches: (row) => row.status === "fallido" },
        ]}
        filters={[
          { id: "status", label: "Estado", options: labelOptions(overview.catalogs.statuses), value: (row) => row.status },
          { id: "source", label: "Fuente", options: labelOptions(overview.catalogs.sources), value: (row) => row.source_type },
        ]}
        sorts={[{ id: "created", label: "Fecha", type: "date", value: (row) => row.created_at }]}
        toolbarEnd={<NewImport overview={overview} />}
        emptyTitle="Aún no hay importaciones"
        columns={[
          { id: "code", header: "Importación", mobile: "title", cell: (row) => <div><p className="font-mono font-semibold">{row.code}</p><p className="max-w-[320px] truncate text-[12px] text-fg-3" title={row.source ?? undefined}>{row.source_label}{row.source ? ` · ${row.source}` : ""}</p></div> },
          { id: "products", header: "Productos", cell: (row) => <span className="text-[13px]"><b>{row.products_detected}</b> detectados · <b>{row.products_created}</b> creados</span> },
          { id: "status", header: "Estado", cell: (row) => <StatusPill status={row.status} label={row.status_label} /> },
          { id: "created", header: "Fecha", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-3">{formatDateTime(row.created_at)}{row.created_by ? ` · ${row.created_by}` : ""}</span> },
          {
            id: "actions",
            header: "",
            align: "right",
            cell: (row) => {
              const detail = detailOf(row.code);
              return (
                <RowActions>
                  {detail ? <ReviewAction detail={detail} /> : row.products_created > 0 ? <Link href="/catalogo/productos" className="text-[12.5px] font-semibold text-accent">Ver en el catálogo</Link> : <RowIcon tone="neutral" label="Sin productos por revisar" icon={<Upload size={15} />} disabledHint="Sin productos por revisar" />}
                </RowActions>
              );
            },
          },
        ]}
      />
    </>
  );
}
