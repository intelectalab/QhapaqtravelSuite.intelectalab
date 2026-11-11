import { AlertTriangle, Calculator, ClipboardCheck, CreditCard, Landmark, LineChart, RotateCcw, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MiniTable, ProgressBar } from "@/components/ui/MiniTable";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { CashFlowProjection, TreasuryOverview } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { AccountFormAction, CountAction, CountDecisionActions, ExpenseAction, OpenSessionAction, ReplenishmentActions, ReplenishmentRequestAction, SettleGatewayAction } from "./TreasuryOps";

const ALERT_TONE = { warn: "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]", bad: "border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]", info: "border-line bg-surface-2" };

export const accountHref = (code: string) => `/finanzas/tesoreria/cuentas/${encodeURIComponent(code)}`;

export function TreasuryAlerts({ data }: { data: TreasuryOverview }) {
  if (data.alerts.length === 0) return null;
  return (
    <Card>
      <TintCardTitle icon={AlertTriangle} title="Alertas de tesorería" aside={String(data.alerts.length)} />
      <ul className="flex flex-col gap-2">
        {data.alerts.map((alert) => (
          <li key={alert.text} className={cn("rounded-[12px] border px-3.5 py-2.5 text-[13px]", ALERT_TONE[alert.tone])}>
            {alert.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AccountsTable({ data, editable }: { data: TreasuryOverview; editable: boolean }) {
  return (
    <Card>
      <TintCardTitle icon={Landmark} title="Cuentas" aside={editable ? <AccountFormAction data={data} /> : String(data.accounts.length)} />
      <MiniTable head={["Cuenta", "Tipo", "Sede", "Saldo", "En soles", "Estado", ""]} align={["left", "left", "left", "right", "right", "left", "right"]} minWidth={720}>
        {data.accounts.map((account) => (
          <tr key={account.code} className={cn(!account.active && "opacity-55")}>
            <td>
              <Link href={accountHref(account.code)} className="font-semibold hover:underline">
                {account.name}
              </Link>
              <span className="block text-xs text-fg-3">{[account.code, account.bank, account.number, account.custodian && `custodia ${account.custodian}`].filter(Boolean).join(" · ")}</span>
            </td>
            <td>{account.kind_label}</td>
            <td>{account.sede ?? "—"}</td>
            <td className="text-right font-mono">{formatMoney(account.balance, account.currency)}</td>
            <td className="text-right font-mono text-fg-2">{account.currency === "PEN" ? "—" : formatMoney(account.balance_pen)}</td>
            <td>
              <Badge tone={account.active ? "ok" : "mute"}>{account.active ? "Activa" : "Inactiva"}</Badge>
            </td>
            <td className="text-right">{editable && <AccountFormAction data={data} account={account} />}</td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function CashSection({ data, editable }: { data: TreasuryOverview; editable: boolean }) {
  const cashes = data.accounts.filter((account) => account.kind === "petty_cash" && account.active);
  const gateways = data.accounts.filter((account) => account.kind === "gateway" && account.active);
  const open = new Set(data.sessions.filter((session) => session.status === "open").map((session) => session.account_code));
  const banks = data.accounts.filter((account) => account.kind === "bank" && account.active).map((account) => ({ value: account.code, label: `${account.name} · ${formatMoney(account.balance, account.currency)}` }));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {cashes.map((account) => {
          const pct = account.fund ? Math.round((account.balance / account.fund) * 100) : 0;
          const isOpen = open.has(account.code);
          return (
            <Card key={account.code} className="lift">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <Link href={accountHref(account.code)} className="block truncate text-[14.5px] font-semibold hover:underline">
                    {account.name}
                  </Link>
                  <span className="text-xs text-fg-3">{[account.sede, account.custodian].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge tone={isOpen ? "t4" : "mute"}>{isOpen ? "Abierta" : "Cerrada"}</Badge>
              </div>
              <p className="font-mono text-[22px] font-bold">{formatMoney(account.balance)}</p>
              <p className="mb-2 text-xs text-fg-3">de un fondo de {formatMoney(account.fund ?? 0)}</p>
              <ProgressBar value={pct} tone={pct < 40 ? "bad" : pct < 70 ? "warn" : "ok"} />
              {editable && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isOpen ? (
                    <>
                      <ExpenseAction account={account} today={data.today} max={data.options.max_petty_expense} />
                      <CountAction account={account} denominations={data.options.denominations} custodians={data.options.custodians} closing={false} />
                      <CountAction account={account} denominations={data.options.denominations} custodians={data.options.custodians} closing />
                    </>
                  ) : (
                    <OpenSessionAction account={account} />
                  )}
                  <ReplenishmentRequestAction account={account} />
                </div>
              )}
            </Card>
          );
        })}
        {gateways.map((account) => (
          <Card key={account.code} className="lift">
            <div className="mb-3 flex items-start justify-between gap-2">
              <Link href={accountHref(account.code)} className="truncate text-[14.5px] font-semibold hover:underline">
                {account.name}
              </Link>
              <CreditCard size={18} className="text-violet" />
            </div>
            <p className="font-mono text-[22px] font-bold">{formatMoney(account.balance, account.currency)}</p>
            <p className="mb-3 text-xs text-fg-3">por liquidar al banco</p>
            {editable && account.balance > 0 && <SettleGatewayAction account={account} feePct={data.options.gateway_fee_pct} today={data.today} />}
          </Card>
        ))}
      </div>

      <Card>
        <TintCardTitle icon={Calculator} title="Arqueos" aside={data.counts.length ? String(data.counts.length) : undefined} />
        {data.counts.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no hay arqueos registrados.</p>
        ) : (
          <MiniTable head={["Arqueo", "Caja", "Sistema", "Contado", "Diferencia", "Firmó", "Estado", ""]} align={["left", "left", "right", "right", "right", "left", "left", "right"]} minWidth={820}>
            {data.counts.map((count) => (
              <tr key={count.code}>
                <td>
                  <b className="block font-semibold">{count.code}</b>
                  <span className="text-xs text-fg-3">
                    {count.kind === "closing" ? "Cierre" : "Sorpresa"} · {formatDateTime(count.at)}
                  </span>
                </td>
                <td>{count.account.name}</td>
                <td className="text-right font-mono">{formatMoney(count.expected)}</td>
                <td className="text-right font-mono">{formatMoney(count.counted)}</td>
                <td className={cn("text-right font-mono", Number(count.difference) !== 0 && "text-bad")} title={count.note ?? undefined}>
                  {formatMoney(count.difference)}
                </td>
                <td className="text-xs">
                  {count.signed_by ?? "—"}
                  {count.witness && <span className="block text-fg-3">testigo {count.witness}</span>}
                </td>
                <td>
                  <StatusBadge status={count.status_label} />
                </td>
                <td className="text-right">{editable && <CountDecisionActions count={count} viewerId={data.viewer_id} />}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={RotateCcw} title="Reposiciones" aside={data.replenishments.length ? String(data.replenishments.length) : undefined} />
          {data.replenishments.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Sin reposiciones registradas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.replenishments.map((item) => (
                <li key={item.code} className={cn("flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13px]", SOFT_TINT)}>
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold">{item.account}</b>
                    <span className="text-xs text-fg-3">
                      {item.code} · {item.requested_by ?? "—"} · {formatDateTime(item.requested_at)}
                    </span>
                    {item.reject_reason && <span className="block text-xs text-bad">{item.reject_reason}</span>}
                  </span>
                  <span className="text-right">
                    <b className="block font-mono">{formatMoney(item.amount)}</b>
                    <Badge tone={item.status === "paid" ? "ok" : item.status === "rejected" ? "bad" : "warn"}>{item.status_label}</Badge>
                  </span>
                  {editable && <ReplenishmentActions row={item} viewerId={data.viewer_id} banks={banks} today={data.today} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={ClipboardCheck} title="Apertura y cierre diario" aside={`${data.sessions.length} recientes`} />
          <ul className="flex flex-col">
            {data.sessions.map((session) => (
              <li key={session.code} className="flex items-center justify-between gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0">
                  <b className="block font-semibold">{session.account}</b>
                  <span className="text-xs text-fg-3">
                    {formatDate(session.date)} · abrió {session.opened_by ?? "—"} con {formatMoney(session.opening)}
                  </span>
                </span>
                {session.status === "open" ? <Badge tone="t4">Abierta</Badge> : session.count ? <Badge tone={session.count.difference === 0 ? "ok" : "warn"}>{session.count.result}</Badge> : <Badge tone="mute">Cerrada</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function CashFlowSection({ flow }: { flow: CashFlowProjection | null }) {
  if (!flow) return null;
  const max = Math.max(1, ...flow.horizons.map((horizon) => Math.max(horizon.in, horizon.out)));
  return (
    <div className="flex flex-col gap-5">
      {flow.risk && (
        <p className={cn("rounded-card border px-4 py-3 text-[13.5px]", ALERT_TONE.bad)}>
          <b className="font-semibold">Riesgo de liquidez:</b> el saldo proyectado queda en {formatMoney(flow.risk.closing)} entre los {flow.risk.label}.
        </p>
      )}
      <Card>
        <TintCardTitle icon={LineChart} title="Flujo proyectado" aside={`Saldo hoy ${formatMoney(flow.opening_pen)}`} />
        <div className="grid gap-3 md:grid-cols-3">
          {flow.horizons.map((horizon) => (
            <div key={horizon.label} className={cn("lift rounded-[14px] px-4 py-3.5", SOFT_TINT)}>
              <p className="mb-2 text-[12.5px] font-semibold text-fg-3">{horizon.label}</p>
              <div className="mb-1 flex items-center gap-2 text-[12px]">
                <span className="w-14 text-fg-3">Entra</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-ok" style={{ width: `${(horizon.in / max) * 100}%` }} />
                </span>
                <span className="w-24 text-right font-mono">{formatMoney(horizon.in, "PEN", { compact: true })}</span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-[12px]">
                <span className="w-14 text-fg-3">Sale</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-bad" style={{ width: `${(horizon.out / max) * 100}%` }} />
                </span>
                <span className="w-24 text-right font-mono">{formatMoney(horizon.out, "PEN", { compact: true })}</span>
              </div>
              <p className="flex justify-between border-t border-line-2 pt-2 text-[13px]">
                <span className="text-fg-3">Saldo al cierre</span>
                <b className={cn("font-mono", horizon.closing < 0 && "text-bad")}>{formatMoney(horizon.closing, "PEN", { compact: true })}</b>
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <TintCardTitle icon={Wallet} title="Detalle proyectado" aside={String(flow.items.length)} />
        <MiniTable head={["Fecha", "Origen", "Concepto", "Entra", "Sale"]} align={["left", "left", "left", "right", "right"]}>
          {flow.items.map((item, index) => (
            <tr key={`${item.code ?? item.concept}-${index}`}>
              <td className="whitespace-nowrap">
                {formatDate(item.date)}
                {item.overdue && <span className="block text-xs text-bad">vencida</span>}
              </td>
              <td className="text-xs">
                {item.source}
                {item.code && <span className="block font-mono text-fg-3">{item.code}</span>}
              </td>
              <td>{item.concept}</td>
              <td className="text-right font-mono text-ok">{item.kind === "in" ? formatMoney(item.pen) : ""}</td>
              <td className="text-right font-mono text-bad">{item.kind === "out" ? formatMoney(item.pen) : ""}</td>
            </tr>
          ))}
        </MiniTable>
      </Card>
    </div>
  );
}
