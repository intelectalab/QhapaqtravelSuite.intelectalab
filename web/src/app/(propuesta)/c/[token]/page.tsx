import { CalendarDays, CircleAlert, FileText, Mail, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { apiFetch } from "@/lib/server/api";

export const metadata: Metadata = { title: "Propuesta de viaje", robots: { index: false, follow: false } };

interface PublicQuote {
  agency: { name: string; advisor: string | null; email: string | null };
  code: string;
  title: string;
  client: string | null;
  status: string;
  version: number;
  travel_from: string | null;
  travel_to: string | null;
  valid_until: string | null;
  currency: string;
  pax: { adt: number; chd: number; inf: number };
  items: { product: string; date: string; qty: number; pax: number; segment: string; unit_price: string; total: string }[];
  totals: { sale: string; discount: string; net: string; tax: string; tax_pct: string; grand: string } | null;
  conditions: string | null;
  portal_url: string;
}

const STATUS_NOTE: Record<string, string> = {
  aprobada: "Ya aprobaste esta propuesta. Tu asesor te contactará para confirmar la reserva.",
  convertida: "Esta propuesta ya es una reserva confirmada.",
  vencida: "La validez de esta propuesta terminó. Pide a tu asesor una versión actualizada.",
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Unavailable({ message }: { message: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bad/10 text-bad">
          <CircleAlert size={24} />
        </span>
        <h1 className="text-[24px] font-bold tracking-[-0.03em]">No pudimos abrir la propuesta</h1>
        <p className="text-fg-3">{message}</p>
      </div>
    </main>
  );
}

export default async function PublicQuotePage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const result = await apiFetch<PublicQuote>(`/public/quotes/${encodeURIComponent(token)}`, { auth: false });
  if (!result.ok || !result.data) return <Unavailable message={result.error?.message ?? "El enlace no es válido."} />;
  const quote = result.data;
  const pax = [quote.pax.adt ? plural(quote.pax.adt, "adulto", "adultos") : null, quote.pax.chd ? plural(quote.pax.chd, "niño", "niños") : null, quote.pax.inf ? plural(quote.pax.inf, "infante", "infantes") : null].filter(Boolean).join(", ");
  const note = STATUS_NOTE[quote.status];

  return (
    <main className="min-h-dvh bg-bg px-4 py-8 sm:py-12">
      <article className="mx-auto flex max-w-3xl flex-col gap-6" data-testid="public-quote">
        <header className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-accent">{quote.agency.name}</span>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.035em] sm:text-[34px]">{quote.title}</h1>
          <p className="text-[14px] text-fg-3">
            Propuesta {quote.code} · versión {quote.version}
            {quote.client ? ` · para ${quote.client}` : ""}
          </p>
        </header>

        {note && (
          <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px] text-fg-2">
            <CircleAlert size={17} className="mt-0.5 flex-none text-warn" />
            {note}
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: CalendarDays, label: "Viaje", value: quote.travel_from && quote.travel_to ? `${formatDate(quote.travel_from)} al ${formatDate(quote.travel_to)}` : "Por definir" },
            { icon: Users, label: "Pasajeros", value: pax || "Por definir" },
            { icon: FileText, label: "Válida hasta", value: quote.valid_until ? formatDate(quote.valid_until) : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="lift flex items-center gap-3 rounded-[16px] border border-line bg-surface px-4 py-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] text-fg-3">{label}</span>
                <b className="block truncate text-[14px] font-semibold">{value}</b>
              </span>
            </div>
          ))}
        </section>

        <section className="rounded-[18px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-[15px] font-semibold">Lo que incluye</h2>
          <ul className="flex flex-col">
            {quote.items.map((item, index) => (
              <li key={`${item.product}-${index}`} className="flex items-start justify-between gap-4 border-t border-line-2 py-3 text-[13.5px] first:border-t-0">
                <span className="min-w-0">
                  <b className="block font-semibold">{item.product}</b>
                  <span className="text-fg-3">
                    {formatDate(item.date)} · {plural(item.pax, "pasajero", "pasajeros")} ({item.segment.toLowerCase()})
                    {item.qty > 1 ? ` × ${item.qty}` : ""} · {formatMoney(item.unit_price, quote.currency)} c/u
                  </span>
                </span>
                <b className="flex-none font-mono">{formatMoney(item.total, quote.currency)}</b>
              </li>
            ))}
          </ul>
          {quote.totals && (
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-[13.5px]">
              {Number(quote.totals.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-fg-3">Descuento</dt>
                  <dd className="font-mono text-ok">− {formatMoney(quote.totals.discount, quote.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-fg-3">Valor de venta</dt>
                <dd className="font-mono">{formatMoney(quote.totals.net, quote.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-3">IGV {Number(quote.totals.tax_pct)} %</dt>
                <dd className="font-mono">{formatMoney(quote.totals.tax, quote.currency)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-[18px] font-bold">
                <dt>Total</dt>
                <dd className="font-mono">{formatMoney(quote.totals.grand, quote.currency)}</dd>
              </div>
            </dl>
          )}
        </section>

        {quote.conditions && (
          <section className="rounded-[18px] border border-line bg-surface p-5">
            <h2 className="mb-2 text-[15px] font-semibold">Condiciones comerciales</h2>
            <p className="whitespace-pre-line text-[13.5px] text-fg-2">{quote.conditions}</p>
          </section>
        )}

        <footer className="flex flex-col gap-3 rounded-[18px] bg-surface-2 p-5 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
          <span className="text-fg-2">
            {quote.agency.advisor ? `Te atiende ${quote.agency.advisor}.` : "Tu asesor responde tus dudas."} Para aprobarla o pedir cambios, ingresa al portal del cliente.
          </span>
          <span className="flex flex-none gap-2">
            {quote.agency.email && (
              <a href={`mailto:${quote.agency.email}?subject=${encodeURIComponent(`Propuesta ${quote.code}`)}`} className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-3.5 font-semibold hover:border-accent/40">
                <Mail size={15} />
                Escribir
              </a>
            )}
            <Link href={quote.portal_url} className="inline-flex h-10 items-center rounded-control bg-accent px-3.5 font-semibold text-white">
              Ir al portal
            </Link>
          </span>
        </footer>
      </article>
    </main>
  );
}
