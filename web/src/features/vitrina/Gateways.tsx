"use client";

import { Calculator, CreditCard, FileUp, KeyRound, Percent, Plus, Settings2, Wallet } from "lucide-react";
import { useState } from "react";
import { importSettlement, saveGateway } from "@/app/(backoffice)/finanzas/pasarelas/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { GatewayAccount, GatewayFee, GatewayFeesOverview, GatewaysOverview } from "@/lib/vitrina";
import { initialStep, Meter, VitrinaBadge } from "./VitrinaUi";

const cents = (value: number) => Math.round(value * 100) / 100;

function sumBy(totals: GatewayFeesOverview["totals"], key: "gross" | "fee" | "fee_tax" | "fx_spread" | "net"): string {
  return totals.map((total) => formatMoney(total[key], total.currency)).join(" · ") || "—";
}

export function GatewayTiles({ fees }: { fees: GatewayFeesOverview }) {
  const cost = fees.totals.map((total) => ({ currency: total.currency, value: Number(total.fee) + Number(total.fee_tax) + Number(total.fx_spread), gross: Number(total.gross) }));
  return (
    <TileGrid>
      <TintTile icon={CreditCard} tone="t1" label="Cobrado por pasarelas" value={sumBy(fees.totals, "gross")} note={`${fees.items.length} cobros`} info={<p>Suma bruta de los cobros hechos por pasarela, por moneda.</p>} />
      <TintTile icon={Percent} tone="bad" label="Comisiones pagadas" value={cost.map((c) => formatMoney(c.value, c.currency)).join(" · ") || "—"} note={cost.map((c) => (c.gross ? `${((c.value / c.gross) * 100).toFixed(2)} % en ${c.currency}` : "")).join(" · ")} info={<p>Comisión de la pasarela más su IGV y el margen de cambio. La rentabilidad de cada reserva la descuenta.</p>} />
      <TintTile icon={Wallet} tone="ok" label="Neto recibido" value={sumBy(fees.totals, "net")} info={<p>Lo que llega al banco: bruto menos comisión, IGV de la comisión y margen de cambio.</p>} />
      <TintTile icon={FileUp} tone="sun" label="Por liquidar" value={fees.kpis.estimado ?? 0} note={`${fees.kpis.liquidado ?? 0} liquidadas · ${fees.kpis.ajustado ?? 0} ajustadas`} info={<p>Cobros con comisión estimada. Al importar el reporte de la pasarela se reemplaza por la real.</p>} />
    </TileGrid>
  );
}

export function GatewayFormAction({ gateway, overview }: { gateway?: GatewayAccount; overview: GatewaysOverview }) {
  const [tax, setTax] = useState(gateway?.tax_on_fee ?? false);
  const [pass, setPass] = useState(gateway?.pass_fee_to_customer ?? false);
  return (
    <PanelAction<StepResult>
      label={gateway ? "Configurar" : "Conectar pasarela"}
      icon={gateway ? <Settings2 size={14} /> : <Plus size={16} strokeWidth={2.4} />}
      variant={gateway ? "secondary" : "primary"}
      size={gateway ? "sm" : "md"}
      formId={gateway ? `gw-${gateway.id}` : "gw-new"}
      title={gateway ? `Configurar ${gateway.label}` : "Conectar pasarela"}
      description="Las credenciales se guardan cifradas en el servidor y nunca se muestran aquí."
      submitLabel={gateway ? "Guardar" : "Conectar"}
      action={saveGateway}
      initial={initialStep}
    >
      {() => (
        <>
          {gateway && <input type="hidden" name="id" value={gateway.id} />}
          <input type="hidden" name="tax_on_fee" value={tax ? "1" : "0"} />
          <input type="hidden" name="pass_fee_to_customer" value={pass ? "1" : "0"} />
          {!gateway && (
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Pasarela" name="provider" options={overview.providers} defaultValue="pasarela_local" />
              <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles (PEN)" }, { value: "USD", label: "Dólares (USD)" }]} defaultValue="PEN" />
            </div>
          )}
          <TextField label="Nombre" name="label" maxLength={80} defaultValue={gateway?.label} />
          <TextField label="Cuenta o comercio" name="account_ref" required minLength={3} maxLength={120} defaultValue={gateway?.account_ref} />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Comisión %" name="fee_pct" type="number" min={0} max={15} step="0.01" defaultValue={gateway?.fee_pct ?? "0"} />
            <TextField label="Cargo fijo" name="fee_fixed" type="number" min={0} step="0.01" defaultValue={gateway?.fee_fixed ?? "0"} />
            <TextField label="Margen de cambio %" name="fx_spread_pct" type="number" min={0} max={10} step="0.01" defaultValue={gateway?.fx_spread_pct ?? "0"} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Liquidación (días)" name="settle_days" type="number" min={0} max={60} defaultValue={gateway?.settle_days ?? 0} />
            <SelectField label="Estado" name="status" options={[{ value: "pendiente", label: "Pendiente" }, { value: "activa", label: "Activa" }, { value: "pausada", label: "Pausada" }]} defaultValue={gateway?.status ?? "pendiente"} />
            <SelectField label="Modo" name="mode" options={[{ value: "sandbox", label: "Pruebas" }, { value: "produccion", label: "Producción" }]} defaultValue={gateway?.mode ?? "sandbox"} />
          </div>
          <SwitchField label={`Cobra IGV (${overview.igv_pct} %) sobre la comisión`} name="tax_switch" checked={tax} onCheckedChange={setTax} />
          <SwitchField label="Trasladar la comisión al cliente como recargo" name="pass_switch" checked={pass} onCheckedChange={setPass} hint="El recargo se muestra en el checkout antes de pagar y figura en el comprobante." />
          <div className="rounded-tile border border-line p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><KeyRound size={14} /> Credenciales {gateway?.has_credentials ? <span className="font-normal text-ok">· registradas</span> : null}</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Client ID" name="client_id" autoComplete="off" />
              <TextField label="Secreto" name="secret" type="password" autoComplete="new-password" revealable />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-3">{gateway?.has_credentials ? "Déjelas vacías para conservar las actuales." : "Obligatorias para activar en producción."}</p>
          </div>
        </>
      )}
    </PanelAction>
  );
}

function GatewayCard({ gateway, overview }: { gateway: GatewayAccount; overview: GatewaysOverview }) {
  const conditions = [`${gateway.fee_pct} %`, Number(gateway.fee_fixed) > 0 ? `+ ${formatMoney(gateway.fee_fixed, gateway.fee_currency)}` : null, gateway.tax_on_fee ? "+ IGV" : null].filter(Boolean).join(" ");
  return (
    <article className="lift flex flex-col gap-3 rounded-tile border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <span className="min-w-0"><b className="block truncate text-[14.5px]">{gateway.label}</b><span className="text-[12px] text-fg-3">{gateway.provider_label} · {gateway.account_ref}</span></span>
        <VitrinaBadge status={gateway.status} />
      </header>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
        <div><dt className="text-fg-3">Comisión</dt><dd className="font-semibold">{conditions}</dd></div>
        <div><dt className="text-fg-3">Liquidación</dt><dd className="font-semibold">{gateway.settle_days ? `${gateway.settle_days} días` : "Inmediata"}</dd></div>
        <div><dt className="text-fg-3">Moneda</dt><dd className="font-semibold">{gateway.currency}{Number(gateway.fx_spread_pct) > 0 ? ` · cambio ${gateway.fx_spread_pct} %` : ""}</dd></div>
        <div><dt className="text-fg-3">Modo</dt><dd className="font-semibold">{gateway.mode === "produccion" ? "Producción" : "Pruebas"}{gateway.has_credentials ? " · credenciales en el vault" : ""}</dd></div>
      </dl>
      {gateway.totals.map((total) => (
        <div key={total.currency} className="flex flex-col gap-1">
          <span className="flex justify-between text-[12px] text-fg-3"><span>{total.count} cobros · neto {formatMoney(total.net, total.currency)}</span><span>costo {formatMoney(total.cost, total.currency)}</span></span>
          <Meter value={Number(total.cost)} max={Number(total.gross)} tone="bad" />
        </div>
      ))}
      {gateway.pass_fee_to_customer && <p className="text-[12px] text-fg-2">La comisión se traslada al cliente como recargo visible.</p>}
      {overview.can_manage && <footer className="mt-auto flex justify-end"><GatewayFormAction gateway={gateway} overview={overview} /></footer>}
    </article>
  );
}

export function GatewayCards({ overview }: { overview: GatewaysOverview }) {
  return <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{overview.items.map((gateway) => <GatewayCard key={gateway.id} gateway={gateway} overview={overview} />)}</section>;
}

export function FeesTable({ fees, gateways }: { fees: GatewayFeesOverview; gateways: GatewayAccount[] }) {
  const columns: Column<GatewayFee>[] = [
    { id: "date", header: "Fecha", cell: (row) => <span className="whitespace-nowrap text-[13px]">{formatDate(row.paid_on)}</span> },
    { id: "gateway", header: "Pasarela", cell: (row) => <span className="text-[13px]">{row.gateway.label}</span> },
    { id: "payment", header: "Cobro", mobile: "title", cell: (row) => <span><b className="font-mono text-[12.5px]">{row.payment}</b><span className="block font-mono text-[11.5px] text-fg-3">{row.reservation ?? row.external_ref ?? ""}</span></span> },
    { id: "gross", header: "Bruto", align: "right", cell: (row) => formatMoney(row.gross, row.currency) },
    { id: "fee", header: "Comisión", align: "right", cell: (row) => <span className="text-bad">{formatMoney(row.fee, row.currency)}</span> },
    { id: "tax", header: "IGV comisión", align: "right", wideOnly: true, cell: (row) => (Number(row.fee_tax) ? formatMoney(row.fee_tax, row.currency) : "—") },
    { id: "net", header: "Neto", align: "right", cell: (row) => <b>{formatMoney(row.net, row.currency)}</b> },
    { id: "pct", header: "% efectivo", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[12.5px]">{row.effective_pct} %</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
  ];
  const metrics: MetricFilter<GatewayFee>[] = [
    { id: "estimated", label: "Estimadas", tone: "sun", icon: <Calculator size={19} />, matches: (row) => row.status === "estimado" },
    { id: "settled", label: "Liquidadas", tone: "ok", icon: <Wallet size={19} />, matches: (row) => row.status !== "estimado" },
  ];
  const filters: FilterConfig<GatewayFee>[] = [{ id: "gateway", label: "Pasarela", options: gateways.map((g) => ({ value: g.id, label: g.label })), value: (row) => row.gateway.id }];
  const sorts: SortOption<GatewayFee>[] = [{ id: "date", label: "Fecha", type: "date", value: (row) => row.paid_on }, { id: "gross", label: "Bruto", type: "number", value: (row) => Number(row.gross) }];
  return <DataTable screen="finanzas-pasarelas" rows={fees.items} columns={columns} getKey={(row) => row.id} entityLabel="cobros" searchText={(row) => `${row.payment} ${row.reservation ?? ""} ${row.external_ref ?? ""}`} searchPlaceholder="Buscar cobro, reserva o referencia" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin cobros por pasarela" />;
}

export function ImportAction({ gateways }: { gateways: GatewayAccount[] }) {
  return (
    <PanelAction<StepResult> label="Importar liquidación" icon={<FileUp size={15} />} formId="gw-import" title="Importar liquidación" description="Reemplaza la comisión estimada por la real del reporte. Si no pega líneas, la traemos de la pasarela." submitLabel="Importar" action={importSettlement} initial={initialStep}>
      {() => (
        <>
          <SelectField label="Pasarela" name="gateway" options={gateways.map((g) => ({ value: g.id, label: g.label }))} defaultValue={gateways[0]?.id} />
          <TextArea label="Líneas del reporte (opcional)" name="lines" rows={6} placeholder={"PAG-01912; 17.20; 3.10; 2026-09-12; TXN 7710"} hint="Una por línea: cobro; comisión; IGV; fecha de liquidación; referencia." />
        </>
      )}
    </PanelAction>
  );
}

export function Simulator({ gateways }: { gateways: GatewayAccount[] }) {
  const [amount, setAmount] = useState("1000");
  const [currency, setCurrency] = useState("USD");
  const value = Number(amount) || 0;
  const rows = gateways.map((gateway) => {
    const fixed = gateway.fee_currency === currency ? Number(gateway.fee_fixed) : 0;
    const fee = cents((value * Number(gateway.fee_pct)) / 100 + fixed);
    const tax = gateway.tax_on_fee ? cents(fee * 0.18) : 0;
    const spread = gateway.currency !== currency ? cents((value * Number(gateway.fx_spread_pct)) / 100) : 0;
    return { gateway, fee, tax, spread, net: cents(value - fee - tax - spread) };
  });
  const best = Math.max(...rows.map((row) => row.net), 0);
  return (
    <Card>
      <CardHeader title="Simulador: cuánto le queda de un cobro" subtitle="Valores referenciales con la configuración de cada pasarela; el real llega en su reporte." />
      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <TextField label="Monto" name="sim_amount" type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
        <SelectField label="Moneda del cliente" name="sim_currency" options={[{ value: "USD", label: "USD" }, { value: "PEN", label: "PEN" }]} value={currency} onChange={setCurrency} />
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.gateway.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
            <span className="text-[13px] font-semibold">{row.gateway.label}</span>
            <b className="text-right text-[13.5px]">{formatMoney(row.net, currency)}</b>
            <Meter value={row.net} max={best || 1} tone={row.net === best ? "ok" : "t1"} />
            <span className="text-right text-[11.5px] text-fg-3">−{formatMoney(row.fee + row.tax + row.spread, currency)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
