import { AlertTriangle, ArrowDownLeft, Ban, Calculator, CalendarClock, ClipboardCheck, Coins, CreditCard, History, Landmark, LineChart, Percent, RotateCcw, Scale, Settings2, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MiniTable, ProgressBar } from "@/components/ui/MiniTable";
import { TextField } from "@/components/ui/TextField";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { ROUTING_DESTINATIONS, SESSION_TODAY, type CashFlowProjection, type FxRevaluationPreview, type PaymentRoutingRule, type RoutingDestination, type TreasuryOverview, type TreasurySettingsData } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { RegisterRevaluationAction, TreasurySettingsAction } from "./TreasuryConfig";
import { CountAction, ExpenseAction, OpenSessionAction, ReplenishmentActions, ReplenishmentRequestAction, SettleGatewayAction } from "./TreasuryOps";
import { AccountsDataTable, CashFlowDetailTable, CountsTable, FlowToggles, WeeklyFlowChart } from "./TreasuryTables";

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
  return <AccountsDataTable data={data} editable={editable} />;
}

export function CashSection({ data, editable }: { data: TreasuryOverview; editable: boolean }) {
  const cashes = data.accounts.filter((account) => account.kind === "petty_cash" && account.active);
  const gateways = data.accounts.filter((account) => account.kind === "gateway" && account.active);
  const open = new Set(data.sessions.filter((session) => session.status === "open").map((session) => session.account_code));
  const banks = data.accounts.filter((account) => account.kind === "bank" && account.active).map((account) => ({ value: account.code, label: `${account.name} · ${formatMoney(account.balance, account.currency)}` }));
  const threshold = data.options.threshold_pct ?? 40;
  const expenseOptions = { categories: data.options.expense_categories, reservations: data.options.reservations };
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {cashes.map((account) => {
          const pct = account.fund ? Math.round((account.balance / account.fund) * 100) : 0;
          const isOpen = account.session_today ? account.session_today === "open" : open.has(account.code);
          const session = SESSION_TODAY[account.session_today ?? (isOpen ? "open" : "none")];
          return (
            <Card key={account.code} className="lift">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <Link href={accountHref(account.code)} className="block truncate text-[14.5px] font-semibold hover:underline">
                    {account.name}
                  </Link>
                  <span className="text-xs text-fg-3">{[account.sede, account.custodian].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge tone={session.tone}>{session.label}</Badge>
              </div>
              <p className="font-mono text-[22px] font-bold">{formatMoney(account.balance)}</p>
              <p className="mb-2 text-xs text-fg-3">
                de un fondo de {formatMoney(account.fund ?? 0)} · reponer bajo el {threshold} %
              </p>
              <ProgressBar value={pct} tone={pct < threshold ? "bad" : pct < Math.min(100, threshold + 30) ? "warn" : "ok"} />
              {editable && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isOpen ? (
                    <>
                      <ExpenseAction account={account} today={data.today} max={data.options.max_petty_expense} options={expenseOptions} />
                      <CountAction account={account} denominations={data.options.denominations} custodians={data.options.custodians} closing={false} tolerance={data.options.petty_tolerance} />
                      <CountAction account={account} denominations={data.options.denominations} custodians={data.options.custodians} closing tolerance={data.options.petty_tolerance} />
                    </>
                  ) : account.session_today === "closed" ? (
                    <CountAction account={account} denominations={data.options.denominations} custodians={data.options.custodians} closing={false} tolerance={data.options.petty_tolerance} />
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
        <CountsTable data={data} editable={editable} />
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
                  {session.closed_at && (
                    <span className="block text-xs text-fg-3">
                      Cerró {session.closed_by ?? "—"} a las {formatDateTime(session.closed_at).split(", ").pop()}
                      {session.count && (
                        <>
                          {" · "}
                          <a href={`/finanzas/tesoreria/arqueos/${encodeURIComponent(session.count.code)}/acta`} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                            acta {session.count.code}
                          </a>
                        </>
                      )}
                    </span>
                  )}
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
  const totals = flow.totals ?? { in: flow.horizons.reduce((sum, horizon) => sum + horizon.in, 0), out: flow.horizons.reduce((sum, horizon) => sum + horizon.out, 0) };
  const totalMax = Math.max(1, totals.in, totals.out);
  return (
    <div className="flex flex-col gap-5">
      {flow.options && (
        <Card>
          <FlowToggles options={flow.options} />
        </Card>
      )}
      {flow.risk ? (
        <p className={cn("rounded-card border px-4 py-3 text-[13.5px]", ALERT_TONE.bad)}>
          <b className="font-semibold">Riesgo de liquidez:</b> el saldo proyectado queda en {formatMoney(flow.risk.closing)} entre los {flow.risk.label}. Evalúa una línea de crédito o reprograma pagos.
        </p>
      ) : (
        <Card>
          <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ok">
            <ClipboardCheck size={16} />
            Sin déficit proyectado a 90 días
          </p>
          {[
            { label: "Entradas a 90 días", value: totals.in, tone: "bg-ok" },
            { label: "Salidas a 90 días", value: totals.out, tone: "bg-bad" },
          ].map((bar) => (
            <div key={bar.label} className="mb-1.5 flex items-center gap-2 text-[12.5px]">
              <span className="w-36 text-fg-3">{bar.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full origin-left rounded-full motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]", bar.tone)} style={{ width: `${(bar.value / totalMax) * 100}%` }} />
              </span>
              <span className="w-24 text-right font-mono">{formatMoney(bar.value, "PEN", { compact: true })}</span>
            </div>
          ))}
        </Card>
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
      {flow.horizons.some((horizon) => horizon.cxc !== undefined) && (
        <Card>
          <TintCardTitle icon={Wallet} title="Desglose por concepto" aside="En soles" />
          <MiniTable head={["Concepto", ...flow.horizons.map((horizon) => horizon.label)]} align={["left", ...flow.horizons.map(() => "right" as const)]} minWidth={560}>
            {BREAKDOWN.map((line) => (
              <tr key={line.key} className={cn(line.total && "font-semibold")}>
                <td>{line.label}</td>
                {flow.horizons.map((horizon) => (
                  <td key={horizon.label} className="text-right">
                    {line.total ? <span className={cn("font-mono", Number(horizon[line.key] ?? 0) < 0 && "text-bad")}>{formatMoney(Number(horizon[line.key] ?? 0))}</span> : signedMoney(Number(horizon[line.key] ?? 0))}
                  </td>
                ))}
              </tr>
            ))}
          </MiniTable>
          {flow.usd_rate !== undefined && <p className="mt-3 text-[12.5px] text-fg-3">Los dólares se convierten al tipo de cambio de cada documento o, si no lo tiene, al de hoy ({flow.usd_rate}).</p>}
        </Card>
      )}
      {flow.weeks && flow.weeks.length > 0 && (
        <Card>
          <TintCardTitle icon={LineChart} title="Entradas y salidas por semana" aside="13 semanas" />
          <WeeklyFlowChart weeks={flow.weeks} />
        </Card>
      )}
      <Card>
        <TintCardTitle icon={Wallet} title="Detalle proyectado" aside={String(flow.items.length)} />
        <CashFlowDetailTable flow={flow} />
      </Card>
    </div>
  );
}

const BREAKDOWN: { key: "opening" | "cxc" | "cxp" | "commissions" | "fixed" | "closing"; label: string; total?: boolean }[] = [
  { key: "opening", label: "Saldo inicial", total: true },
  { key: "cxc", label: "Cuentas por cobrar" },
  { key: "cxp", label: "Cuentas por pagar a proveedores" },
  { key: "commissions", label: "Comisiones aprobadas" },
  { key: "fixed", label: "Egresos fijos estimados" },
  { key: "closing", label: "Saldo final proyectado", total: true },
];

const signedMoney = (value: string | number) => {
  const amount = Number(value);
  return <span className={cn("font-mono", amount > 0 ? "text-ok" : amount < 0 ? "text-bad" : "text-fg-3")}>{amount > 0 ? "+" : ""}{formatMoney(amount)}</span>;
};

export function FxSection({ preview }: { preview: FxRevaluationPreview | null }) {
  if (!preview) return null;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={Coins} title={`Revaluación de ${preview.period}`} aside={preview.can.register && preview.pending > 0 ? <RegisterRevaluationAction preview={preview} /> : preview.pending === 0 ? "Registrada" : undefined} />
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="seccion" value="cambio" />
          <div className="w-48">
            <TextField label="Tipo de cambio de cierre" name="tc" type="number" step="0.0001" min="0.5" max="20" defaultValue={preview.close_rate} />
          </div>
          <Button type="submit" variant="secondary">
            Calcular
          </Button>
          <p className="text-[12.5px] text-fg-3">Referencia del día: {preview.reference_rate}. Usa el de cierre publicado por la SBS.</p>
        </form>
        {preview.rows.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No hay cuentas activas en dólares.</p>
        ) : (
          <MiniTable head={["Cuenta", "Saldo USD", "TC contable", "Valor contable", "Valor al cierre", "No realizada", "Realizada del mes", ""]} align={["left", "right", "right", "right", "right", "right", "right", "left"]} minWidth={900}>
            {preview.rows.map((row) => (
              <tr key={row.code}>
                <td>
                  <Link href={accountHref(row.code)} className="font-semibold hover:underline">
                    {row.name}
                  </Link>
                  <span className="block text-xs text-fg-3">{row.code}</span>
                </td>
                <td className="text-right font-mono">{formatMoney(row.balance_usd, "USD")}</td>
                <td className="text-right font-mono text-fg-2">{Number(row.book_rate).toFixed(4)}</td>
                <td className="text-right font-mono">{formatMoney(row.book_pen)}</td>
                <td className="text-right font-mono">{formatMoney(row.market_pen)}</td>
                <td className="text-right">{signedMoney(row.unrealized_pen)}</td>
                <td className="text-right">{signedMoney(row.realized_pen)}</td>
                <td>{row.registered ? <Badge tone="ok">{row.registered}</Badge> : <Badge tone="warn">Pendiente</Badge>}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={5}>Total del periodo</td>
              <td className="text-right">{signedMoney(preview.totals.unrealized_pen)}</td>
              <td className="text-right">{signedMoney(preview.totals.realized_pen)}</td>
              <td />
            </tr>
          </MiniTable>
        )}
        {!preview.can.register && preview.pending > 0 && <p className="mt-3 text-[12.5px] text-fg-3">La registra Contabilidad o quien tenga el permiso de facturación.</p>}
      </Card>
      <RealizedFxCard preview={preview} />
      <FxHistoryCard preview={preview} />
    </div>
  );
}

function RealizedFxCard({ preview }: { preview: FxRevaluationPreview }) {
  const operations = preview.rows.flatMap((row) => (row.realized_operations ?? []).map((operation) => ({ ...operation, account: row.name })));
  return (
    <Card>
      <TintCardTitle icon={Scale} title="Diferencia realizada por operación" aside={operations.length ? String(operations.length) : undefined} />
      {operations.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">Sin salidas de dólares con un tipo de cambio distinto al promedio en {preview.period}.</p>
      ) : (
        <MiniTable head={["Operación", "Cuenta", "Monto USD", "TC operación", "TC promedio", "Diferencia"]} align={["left", "left", "right", "right", "right", "right"]} minWidth={720}>
          {operations.map((operation) => (
            <tr key={operation.code}>
              <td>
                <b className="block font-semibold">{operation.description}</b>
                <span className="text-xs text-fg-3">
                  {operation.code} · {formatDate(operation.date)}
                </span>
              </td>
              <td>{operation.account}</td>
              <td className="text-right font-mono">{formatMoney(operation.amount_usd, "USD")}</td>
              <td className="text-right font-mono">{Number(operation.rate).toFixed(4)}</td>
              <td className="text-right font-mono text-fg-2">{Number(operation.average).toFixed(4)}</td>
              <td className="text-right">{signedMoney(operation.diff_pen)}</td>
            </tr>
          ))}
        </MiniTable>
      )}
      <p className="mt-3 text-[12.5px] text-fg-3">Cada salida en dólares se valoriza al promedio ponderado; la diferencia es monto × (TC de la operación − promedio).</p>
    </Card>
  );
}

function FxHistoryCard({ preview }: { preview: FxRevaluationPreview }) {
  return (
    <>
      <Card>
        <TintCardTitle icon={History} title="Historial de revaluaciones" aside={preview.history.length ? String(preview.history.length) : undefined} />
        {preview.history.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no se registró ninguna diferencia cambiaria.</p>
        ) : (
          <MiniTable head={["Revaluación", "Cuenta", "Saldo USD", "TC contable", "TC cierre", "Diferencia", "Registró"]} align={["left", "left", "right", "right", "right", "right", "left"]} minWidth={760}>
            {preview.history.map((row) => (
              <tr key={row.code}>
                <td>
                  <b className="block font-semibold">{row.code}</b>
                  <span className="text-xs text-fg-3">
                    {row.period} · {formatDate(row.date)}
                  </span>
                </td>
                <td>{row.account.name}</td>
                <td className="text-right font-mono">{formatMoney(row.balance_usd, "USD")}</td>
                <td className="text-right font-mono text-fg-2">{Number(row.book_rate).toFixed(4)}</td>
                <td className="text-right font-mono">{Number(row.close_rate).toFixed(4)}</td>
                <td className="text-right">{signedMoney(row.diff_pen)}</td>
                <td className="text-xs">{row.user ?? "—"}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </>
  );
}

function SettingBlock({ icon: Icon, title, rows }: { icon: typeof Wallet; title: string; rows: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className={cn("lift rounded-[14px] px-4 py-3.5", SOFT_TINT)}>
      <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <Icon size={15} className="text-[var(--tint)]" />
        {title}
      </p>
      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-[13px]" title={row.hint}>
            <dt className="text-fg-3">{row.label}</dt>
            <dd className="whitespace-nowrap font-mono font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const ROUTING_ICONS: Record<RoutingDestination, typeof Wallet> = { bank: Landmark, gateway: CreditCard, petty_cash: Wallet, none: Ban };

function PaymentRoutingCard({ rules }: { rules: PaymentRoutingRule[] }) {
  return (
    <Card>
      <TintCardTitle icon={ArrowDownLeft} title="Cuenta de cada medio de pago" />
      <p className="-mt-1 mb-3 text-[12.5px] text-fg-3">Cada cobro confirmado entra solo a esta cuenta y su reversión sale de la misma. Los pagos a proveedores salen de la cuenta de origen elegida al pagar.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rules.map((rule) => {
          const Icon = ROUTING_ICONS[rule.destination];
          const accounts = rule.destination === "none" ? [] : Array.from(new Set([rule.accounts.PEN, rule.accounts.USD].filter((name): name is string => Boolean(name))));
          return (
            <li key={rule.method} className={cn("lift flex items-center gap-3 rounded-[12px] px-3.5 py-2.5", SOFT_TINT)}>
              <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface", rule.destination === "none" ? "text-fg-3" : "text-[var(--tint)]")}>
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{rule.label}</span>
                <span className="block truncate text-[12px] text-fg-3" title={accounts.join(" · ")}>
                  {rule.destination === "none" ? ROUTING_DESTINATIONS.none : accounts.length ? accounts.join(" · ") : "Sin cuenta activa de ese tipo"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function TreasurySettingsSection({ settings, editable }: { settings: TreasurySettingsData | null; editable: boolean }) {
  if (!settings) return null;
  const monthly = settings.recurring_outflows.reduce((sum, item) => sum + item.amount, 0);
  const max = Math.max(1, ...settings.recurring_outflows.map((item) => item.amount));
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={Settings2} title="Parámetros de la agencia" aside={editable ? <TreasurySettingsAction settings={settings} /> : settings.updated_by ? `Editó ${settings.updated_by}` : undefined} />
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <SettingBlock
            icon={Wallet}
            title="Caja chica"
            rows={[
              { label: "Tolerancia del arqueo", value: formatMoney(settings.petty_tolerance), hint: "Una diferencia mayor la aprueba otra persona." },
              { label: "Máximo por gasto", value: formatMoney(settings.max_petty_expense), hint: "Por encima se paga desde un banco." },
              { label: "Declaración jurada hasta", value: formatMoney(settings.sworn_statement_max) },
              { label: "Reponer bajo el", value: `${settings.replenish_threshold_pct} % del fondo` },
            ]}
          />
          <SettingBlock
            icon={CreditCard}
            title="Pasarela y depósitos"
            rows={[
              { label: "Comisión de la pasarela", value: `${settings.gateway_fee_pct} %` },
              { label: "Depositar el efectivo en", value: `${settings.cash_deposit_hours} h` },
            ]}
          />
          <SettingBlock
            icon={Percent}
            title="Rentabilidad"
            rows={[
              { label: "Meta de margen", value: `${settings.margin_target_pct} %` },
              { label: "Margen mínimo", value: `${settings.margin_floor_pct} %`, hint: "Debajo de este valor la reserva queda en rojo." },
            ]}
          />
        </div>
        {!editable && <p className="mt-3 text-[12.5px] text-fg-3">Solo el administrador de la agencia cambia estos parámetros.</p>}
      </Card>
      <PaymentRoutingCard rules={settings.payment_routing} />
      <Card>
        <TintCardTitle icon={CalendarClock} title="Egresos fijos del mes" aside={settings.recurring_outflows.length ? formatMoney(monthly) : undefined} />
        {settings.recurring_outflows.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin egresos fijos: el flujo proyectado solo considera cobros y pagos registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {settings.recurring_outflows.map((item, index) => (
              <li key={`${item.concept}-${index}`} className="group grid grid-cols-[3.5rem_minmax(0,1fr)_7rem] items-center gap-3 text-[13px]">
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-center text-[12px] font-semibold text-fg-2">Día {item.day}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.concept}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full origin-left rounded-full bg-bad/70 transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${(item.amount / max) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right font-mono font-semibold">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
