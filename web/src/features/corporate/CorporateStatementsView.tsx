"use client";

import { CalendarClock, FileText, MailCheck, Settings } from "lucide-react";
import { useState } from "react";
import { saveStatementSettings } from "@/app/(portal)/portal/corporativo/actions";
import { Badge } from "@/components/ui/Badge";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { num, type CorporateStatement, type CorporateStatements, type StatementSettings } from "@/lib/corporate";
import { formatDate, formatMoney } from "@/lib/format";
import { CorporateStep } from "./CorporateForms";

function SettingsFields({ settings }: { settings: StatementSettings }) {
  const [auto, setAuto] = useState(settings.statement_auto);
  return (
    <>
      <input type="hidden" name="lock_version" value={settings.lock_version} />
      <SwitchField label="Envío automático" name="statement_auto" checked={auto} onCheckedChange={setAuto} hint="Cada mes se envía el estado de cuenta del mes anterior." />
      <TextField label="Día del mes (1 a 28)" name="statement_day" type="number" min={1} max={28} defaultValue={settings.statement_day} required />
      <TextField label="Correos de destino" name="statement_recipients" defaultValue={settings.statement_recipients.join(", ")} required={auto} hint="Sepáralos con comas. Por ejemplo, el de cuentas por pagar." />
    </>
  );
}

export function StatementFigures({ statement }: { statement: CorporateStatement }) {
  const cur = statement.currency;
  const figures = [
    { label: "Saldo inicial", value: statement.opening_balance },
    { label: "Compras", value: statement.charges, sign: "+" },
    { label: "Pagos", value: statement.payments, sign: "−" },
    { label: "Notas de crédito", value: statement.credits, sign: "−" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="text-[11.5px] text-fg-3">
            {figure.sign ? `(${figure.sign}) ` : ""}
            {figure.label}
          </dt>
          <dd className={cn("font-mono text-[13px]", num(figure.value) === 0 && "text-fg-3")}>{formatMoney(figure.value, cur)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CorporateStatementsView({ data }: { data: CorporateStatements }) {
  const settings = data.settings;
  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={CalendarClock}
        title="Envío automático"
        aside={
          data.can_manage ? (
            <CorporateStep id="envio" label="Configurar" icon={<Settings size={15} />} size="sm" title="Envío automático del estado de cuenta" description="Elige el día y a quién le llega el estado de cuenta del mes anterior." submitLabel="Guardar" action={saveStatementSettings}>
              <SettingsFields settings={settings} />
            </CorporateStep>
          ) : undefined
        }
      >
        <p className="text-[13.5px] text-fg-2">
          {settings.statement_auto ? (
            <>
              Activo: el día <b className="text-fg">{settings.statement_day}</b> de cada mes se envía el estado de cuenta del mes anterior a <b className="text-fg">{settings.statement_recipients.join(", ")}</b>.
              {settings.statement_last_sent_at ? ` Último envío: ${formatDate(settings.statement_last_sent_at)}.` : ""}
            </>
          ) : (
            "Desactivado. Descarga el estado de cuenta desde esta pantalla cuando lo necesites."
          )}
        </p>
        {!data.can_manage && <p className="mt-2 text-[12px] text-fg-3">Solo el administrador o el pagador de la empresa cambian esta configuración.</p>}
      </SectionCard>
      <SectionCard icon={FileText} title="Estados de cuenta mensuales" aside={data.items.length}>
        {data.items.length === 0 ? (
          <EmptyLine>La agencia aún no emite estados de cuenta para tu empresa.</EmptyLine>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.items.map((statement, index) => (
              <li key={statement.code} style={rise(index)} className={cn("lift grid gap-3 rounded-tile border border-line px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)_auto] md:items-center", RISE)}>
                <span>
                  <b className="block text-[14px] font-semibold">{statement.label}</b>
                  <span className="font-mono text-[11.5px] text-fg-3">{statement.code}</span>
                </span>
                <StatementFigures statement={statement} />
                <span className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span className="text-right">
                    <span className="block text-[11.5px] text-fg-3">Saldo final</span>
                    <b className="font-mono text-[15px]">{formatMoney(statement.closing_balance, statement.currency)}</b>
                  </span>
                  {statement.status === "enviado" && (
                    <Badge tone="ok">
                      <MailCheck size={12} />
                      Enviado
                    </Badge>
                  )}
                  <a href={`/portal/corporativo/estado/${statement.code}`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-accent/10 px-2.5 text-[12.5px] font-semibold text-accent transition hover:bg-accent/15">
                    <FileText size={14} />
                    Ver PDF
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
