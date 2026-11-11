import { ArrowDownLeft, ArrowUpRight, BookOpen, CreditCard, Landmark, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { AccountFormAction, CountAction, ExpenseAction, OpenSessionAction, ReplenishmentRequestAction, SettleGatewayAction, TransferAction } from "@/features/finance/TreasuryOps";
import { cn } from "@/lib/cn";
import type { TreasuryLedger, TreasuryOverview } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

const getLedger = cache(async (code: string) => (await getResource<TreasuryLedger>(`/treasury/accounts/${encodeURIComponent(code)}/movements`, "No pudimos cargar la cuenta.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/finanzas/tesoreria/cuentas/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getLedger(code)).name };
}

const ICON = { bank: Landmark, petty_cash: Wallet, gateway: CreditCard };
const TONE = { bank: "t1", petty_cash: "sun", gateway: "violet" } as const;

export default async function CuentaPage({ params }: PageProps<"/finanzas/tesoreria/cuentas/[code]">) {
  const { code } = await params;
  const [ledger, overview] = await Promise.all([getLedger(code), getResource<TreasuryOverview>("/treasury/accounts", "No pudimos cargar la tesorería.")]);
  const account = overview?.accounts.find((item) => item.code === ledger.code);
  const manage = Boolean(overview?.can.manage) && ledger.active && account !== undefined;
  const Icon = ICON[ledger.kind];

  return (
    <ToneScope tone={ledger.active ? TONE[ledger.kind] : "mute"}>
      <PageHeader
        back={{ href: "/finanzas/tesoreria?seccion=cuentas", label: "Tesorería" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Icon size={24} />
          </span>
        }
        title={ledger.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={ledger.active ? "ok" : "mute"}>{ledger.active ? "Activa" : "Inactiva"}</Badge>
          </span>
        }
        subtitle={`${ledger.code} · ${ledger.kind_label} · ${ledger.currency}`}
        actions={
          manage && overview && account ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {ledger.kind === "bank" && <TransferAction data={overview} from={ledger.code} compact />}
              {ledger.kind === "gateway" && account.balance > 0 && <SettleGatewayAction account={account} feePct={overview.options.gateway_fee_pct} today={overview.today} />}
              {ledger.kind === "petty_cash" &&
                (ledger.open_session ? (
                  <>
                    <ExpenseAction account={account} today={overview.today} max={overview.options.max_petty_expense} />
                    <CountAction account={account} denominations={overview.options.denominations} custodians={overview.options.custodians} closing={false} />
                    <CountAction account={account} denominations={overview.options.denominations} custodians={overview.options.custodians} closing />
                  </>
                ) : (
                  <OpenSessionAction account={account} />
                ))}
              {ledger.kind === "petty_cash" && <ReplenishmentRequestAction account={account} />}
              <AccountFormAction data={overview} account={account} />
            </div>
          ) : undefined
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Icon} tone={TONE[ledger.kind]} label="Saldo" value={formatMoney(ledger.balance, ledger.currency)} note={ledger.fund ? `Fondo fijo ${formatMoney(ledger.fund, ledger.currency)}` : undefined} />
        <TintTile icon={ArrowDownLeft} tone="ok" label="Ingresos del mes" value={formatMoney(ledger.month_in, ledger.currency)} />
        <TintTile icon={ArrowUpRight} tone="bad" label="Egresos del mes" value={formatMoney(ledger.month_out, ledger.currency)} />
        <TintTile
          icon={BookOpen}
          tone="violet"
          label={ledger.kind === "petty_cash" ? "Sesión de hoy" : ledger.kind === "gateway" ? "Liquida en" : "CCI"}
          value={<span className="text-[15px]">{ledger.kind === "petty_cash" ? (ledger.open_session ? `Abierta ${formatDateTime(ledger.open_session.opened_at)}` : "Sin abrir") : ledger.kind === "gateway" ? (ledger.settle_to?.name ?? "—") : (ledger.cci ?? "Sin registrar")}</span>}
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <TintCardTitle icon={BookOpen} title="Libro de la cuenta" aside={`${ledger.movements.length} movimientos`} />
          {ledger.movements.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">La cuenta no tiene movimientos desde su apertura.</p>
          ) : (
            <MiniTable head={["Fecha", "Movimiento", "Ingreso", "Egreso", "Saldo", "Estado"]} align={["left", "left", "right", "right", "right", "left"]} minWidth={720}>
              {ledger.movements.map((movement) => (
                <tr key={movement.code} className={cn(movement.status === "voided" && "opacity-50")}>
                  <td className="whitespace-nowrap">{formatDate(movement.date)}</td>
                  <td>
                    <b className="block font-semibold">{movement.description}</b>
                    <span className="text-xs text-fg-3">{[movement.code, movement.type_label, movement.category, movement.reference, movement.counterparty].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="text-right font-mono text-ok">{movement.direction === "in" ? formatMoney(movement.amount, ledger.currency) : ""}</td>
                  <td className="text-right font-mono text-bad">{movement.direction === "out" ? formatMoney(movement.amount, ledger.currency) : ""}</td>
                  <td className="text-right font-mono">{formatMoney(movement.balance, ledger.currency)}</td>
                  <td>
                    <StatusBadge status={movement.status === "posted" ? "registrado" : "anulado"} />
                  </td>
                </tr>
              ))}
            </MiniTable>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={Landmark} title="Datos de la cuenta" />
          <FieldList
            fields={[
              ...(ledger.bank ? [{ label: "Banco", value: ledger.bank }] : []),
              ...(ledger.number ? [{ label: "Número", value: ledger.number }] : []),
              { label: "Sede", value: ledger.sede ?? "—" },
              ...(ledger.custodian ? [{ label: "Custodia", value: ledger.custodian }] : []),
              { label: "Apertura", value: `${formatMoney(ledger.opening_balance, ledger.currency)} · ${formatDate(ledger.opening_date)}` },
            ]}
          />
        </Card>
      </div>
    </ToneScope>
  );
}
