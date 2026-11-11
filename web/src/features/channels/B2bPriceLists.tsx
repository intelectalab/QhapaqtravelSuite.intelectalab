"use client";

import { Handshake, PackageCheck, PackageX, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { b2bRateStep } from "@/app/(backoffice)/canales/b2b/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields } from "@/features/catalog-shared/CatalogPanels";
import type { B2bProductRates, B2bRate } from "@/lib/channels";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ChannelBadge, PanelSection } from "./ChannelUi";

type Product = B2bProductRates["products"][number];
type Agency = B2bProductRates["agencies"][number];

const initial: StepResult = { message: null, done: false };

function RateFields({ product, agencies, rate }: { product: Product; agencies: Agency[]; rate?: B2bRate }) {
  const usable = agencies.filter((agency) => agency.status === "activa" || agency.code === rate?.agency.code);
  const [agencyCode, setAgencyCode] = useState(rate?.agency.code ?? usable[0]?.code ?? "");
  const agency = agencies.find((item) => item.code === agencyCode);
  const current = rate ?? product.assignments.find((item) => item.agency.code === agencyCode);
  const [credit, setCredit] = useState(current?.credit_allowed ?? Boolean(agency?.credit));
  const currency = current?.currency ?? product.public?.currency ?? "PEN";
  return (
    <div key={agencyCode} className="flex flex-col gap-4">
      <HiddenFields values={{ step: "save", product: product.code, agency: agencyCode }} />
      {rate ? (
        <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]"><b className="font-semibold">{rate.agency.name}</b> · {rate.price_list ?? "Sin lista"}</p>
      ) : (
        <SelectField label="Agencia" name="agency_pick" value={agencyCode} onChange={(value) => { setAgencyCode(value); setCredit(Boolean(agencies.find((item) => item.code === value)?.credit)); }} options={usable.map((item) => ({ value: item.code, label: item.name, hint: `${item.price_list} · comisión ${item.commission_pct} %${product.assignments.some((assigned) => assigned.agency.code === item.code) ? " · ya tiene tarifa" : ""}` }))} hint="Solo agencias activas con convenio vigente." />
      )}
      {product.public && <p className="text-[12.5px] text-fg-3">Precio público vigente: <b className="text-fg">{formatMoney(product.public.price, product.public.currency)}</b>. El neto no puede superarlo.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Precio neto" name="net_price" type="number" step="0.01" min="0" max={product.public && product.public.currency === currency ? product.public.price : undefined} required defaultValue={current?.net_price ?? product.general?.price ?? ""} />
        <SelectField label="Moneda" name="currency" defaultValue={currency} options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} />
        <TextField label="Comisión (%)" name="commission_pct" type="number" step="0.5" min="0" max="30" required defaultValue={current?.commission_pct ?? agency?.commission_pct ?? 10} />
      </div>
      <TextField label="Vigente hasta" name="valid_to" type="date" defaultValue={current?.valid_to ?? ""} hint="Vacío: rige mientras dure el convenio de la agencia." />
      <SwitchField label="Permite reservar a crédito" name="credit_allowed" checked={credit && Boolean(agency?.credit)} onCheckedChange={setCredit} disabled={!agency?.credit} hint={agency?.credit ? "Descuenta de la línea de crédito de la agencia." : "La agencia no tiene línea de crédito: solo prepago."} />
      <TextField label="Condiciones" name="conditions" maxLength={300} defaultValue={current?.conditions ?? ""} placeholder="Opcional" />
      <TextField label="Restricciones" name="restrictions" maxLength={300} defaultValue={current?.restrictions ?? ""} placeholder="Opcional" />
    </div>
  );
}

function RateForm({ product, agencies, rate }: { product: Product; agencies: Agency[]; rate?: B2bRate }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={rate ? "Editar tarifa" : "Asignar tarifa"}
      formId={`b2b-rate-${product.code}-${rate?.agency.code ?? "new"}`}
      title={rate ? `Tarifa de ${rate.agency.name}` : "Asignar tarifa B2B"}
      description={product.name}
      submitLabel="Guardar tarifa"
      action={b2bRateStep}
      initial={initial}
      trigger={(open) => (rate ? <RowIcon tone="edit" label="Editar tarifa" icon={<Pencil size={15} />} onClick={open} /> : <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={open}>Asignar tarifa</Button>)}
      onDone={() => router.refresh()}
    >
      {() => <RateFields product={product} agencies={agencies} rate={rate} />}
    </PanelAction>
  );
}

function RemoveRate({ product, rate }: { product: Product; rate: B2bRate }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Quitar"
      formId={`b2b-rate-remove-${product.code}-${rate.agency.code}`}
      title="Quitar tarifa B2B"
      description={`${rate.agency.name} dejará de ver y reservar ${product.name}. Sus reservas ya hechas no cambian.`}
      submitLabel="Quitar"
      action={b2bRateStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Quitar" icon={<Trash2 size={15} />} onClick={open} />}
      onDone={() => router.refresh()}
    >
      {() => <HiddenFields values={{ step: "remove", product: product.code, agency: rate.agency.code }} />}
    </PanelAction>
  );
}

function ManageRates({ product, agencies, canManage }: { product: Product; agencies: Agency[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="edit" label="Gestionar tarifas" icon={<Settings2 size={15} />} onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={`Tarifas B2B · ${product.name}`} description={product.public ? `Precio público ${formatMoney(product.public.price, product.public.currency)}${product.general ? ` · tarifa B2B general ${formatMoney(product.general.price, product.general.currency)}` : ""}` : "Sin tarifa pública vigente"}>
        <div className="flex flex-col gap-5">
          {canManage && <div><RateForm product={product} agencies={agencies} /></div>}
          <PanelSection title="Agencias con tarifa" aside={`${product.assignments.length}`}>
            {product.assignments.length === 0 ? (
              <p className="text-[13px] text-fg-3">Ninguna agencia puede reservar este producto todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {product.assignments.map((rate) => (
                  <li key={rate.agency.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2.5">
                    <span className="min-w-0">
                      <b className="block truncate text-[13.5px] font-semibold">{rate.agency.name}</b>
                      <span className="text-[12px] text-fg-3">{rate.price_list ?? "Sin lista"} · comisión {formatPercent(rate.commission_pct, 0)} · {rate.credit_allowed ? "con crédito" : "solo prepago"}{rate.valid_to ? ` · hasta ${formatDate(rate.valid_to)}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <b className="text-[13px]">{formatMoney(rate.net_price, rate.currency)}</b>
                      {rate.expired && <ChannelBadge status="vencida" />}
                      {canManage && (
                        <RowActions>
                          <RateForm product={product} agencies={agencies} rate={rate} />
                          <RemoveRate product={product} rate={rate} />
                        </RowActions>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        </div>
      </SidePanel>
    </>
  );
}

export function B2bPriceListsTable({ data, canManage }: { data: B2bProductRates; canManage: boolean }) {
  const rows = data.products;
  const columns: Column<Product>[] = [
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <a href={`/catalogo/productos/${row.code}`} className="text-[13.5px] font-semibold hover:text-accent">{row.name}</a>
          <span className="text-[12px] text-fg-3">{row.code}{row.status !== "ACTIVE" ? " · no activo" : ""}</span>
        </span>
      ),
    },
    { id: "public", header: "Precio público", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.public ? formatMoney(row.public.price, row.public.currency) : "—"}</span> },
    { id: "general", header: "Tarifa B2B general", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.general ? formatMoney(row.general.price, row.general.currency) : "—"}</span> },
    {
      id: "assignments",
      header: "Agencias",
      cell: (row) =>
        row.assignments.length === 0 ? (
          <span className="text-[12.5px] text-fg-3">Sin asignar</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.assignments.map((rate) => (
              <span key={rate.agency.code} title={`${formatMoney(rate.net_price, rate.currency)} · comisión ${rate.commission_pct} %`} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium">
                {rate.agency.name}
              </span>
            ))}
          </span>
        ),
    },
    { id: "actions", header: "", cell: (row) => <RowActions><ManageRates product={row} agencies={data.agencies} canManage={canManage} /></RowActions> },
  ];
  const metrics: MetricFilter<Product>[] = [
    { id: "assigned", label: "Con agencias", tone: "ok", icon: <PackageCheck size={19} />, matches: (row) => row.assignments.length > 0 },
    { id: "empty", label: "Sin agencias", tone: "warn", icon: <PackageX size={19} />, matches: (row) => row.assignments.length === 0 },
    { id: "credit", label: "Con crédito", tone: "violet", icon: <Handshake size={19} />, matches: (row) => row.assignments.some((rate) => rate.credit_allowed) },
  ];
  const filters: FilterConfig<Product>[] = [{ id: "agency", label: "Agencia", options: data.agencies.map((agency) => ({ value: agency.code, label: agency.name })), value: (row) => row.assignments.map((rate) => rate.agency.code) }];
  const sorts: SortOption<Product>[] = [
    { id: "name", label: "Producto", value: (row) => row.name },
    { id: "agencies", label: "Agencias", type: "number", value: (row) => row.assignments.length },
  ];
  return <DataTable screen="canales-b2b-precios" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="productos" searchText={(row) => `${row.code} ${row.name} ${row.assignments.map((rate) => rate.agency.name).join(" ")}`} searchPlaceholder="Buscar producto o agencia" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin productos B2B" />;
}
