import { Lightbulb, MessageCircle, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { type ArticleBlock, parseArticle } from "@/lib/landing-content";

function QuoteMock() {
  const rows = [
    ["Tren Vistadome ida y vuelta", "USD 177,50"],
    ["Boleto Machu Picchu", "USD 41,00"],
    ["Guía oficial bilingüe", "USD 47,25"],
    ["Hotel boutique, 4 noches", "USD 442,00"],
  ];
  return (
    <figure className="group my-8 overflow-hidden rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)] transition duration-500 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_rgb(22_24_42/0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--bad)_60%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--warn)_60%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--ok)_60%,transparent)]" />
        </span>
        <span className="text-[12px] font-semibold text-fg-2">Cotización · Cusco clásico 5D/4N</span>
        <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[11px] font-semibold text-ok">Margen sobre el mínimo</span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ul className="grid gap-2 text-[13px]">
          {rows.map(([label, value]) => (
            <li key={label} className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2">
              <span className="text-fg-2">{label}</span>
              <span className="font-mono font-semibold text-fg">{value}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col justify-between rounded-[16px] bg-menu p-4 text-white">
          <span className="text-[12px] text-white/60">Total por pasajero</span>
          <b className="mt-1 font-mono text-[26px] tracking-tight">USD 845,00</b>
          <span className="mt-3 flex items-center gap-1.5 text-[12.5px] text-white/75">
            <TrendingUp size={14} className="text-t2" />
            Margen USD 248,80 · 29,4 %
          </span>
          <span className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-white/12 px-3 py-2 text-[12.5px] font-semibold transition group-hover:bg-white/20">
            <MessageCircle size={14} />
            Enviar por WhatsApp
          </span>
        </div>
      </div>
      <figcaption className="border-t border-line px-5 py-2.5 text-[12px] text-fg-3">Vista del cotizador con datos de ejemplo.</figcaption>
    </figure>
  );
}

const MOCKS: Record<string, () => ReactNode> = { cotizador: QuoteMock };

function Block({ block }: { block: ArticleBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h2 id={block.id} className="site-display mt-12 scroll-mt-28 text-[25px] font-bold leading-tight tracking-[-0.025em] text-fg first:mt-0 sm:text-[29px]">
          {block.text}
        </h2>
      );
    case "paragraph":
      return <p className="mt-4 text-[16.5px] leading-[1.75] text-fg-2">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-4 grid gap-2.5">
          {block.items.map((item) => (
            <li key={item} className="relative pl-6 text-[16px] leading-relaxed text-fg-2 before:absolute before:left-1 before:top-[0.65em] before:h-2 before:w-2 before:rounded-[3px] before:bg-t3">
              {item}
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <aside className="mt-6 flex gap-3.5 rounded-[18px] border border-[color-mix(in_srgb,var(--t2)_45%,transparent)] bg-[color-mix(in_srgb,var(--t2)_12%,var(--surface))] p-5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-t2 text-t2-fg">
            <Lightbulb size={18} />
          </span>
          <span>
            <b className="block text-[14.5px] text-fg">{block.title}</b>
            <span className="mt-1 block text-[15px] leading-relaxed text-fg-2">{block.text}</span>
          </span>
        </aside>
      );
    case "table":
      return (
        <div className="mt-6 overflow-x-auto rounded-[16px] border border-line">
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead className="bg-surface-2 text-[12.5px] text-fg-2">
              <tr>
                {block.head.map((cell, index) => (
                  <th key={cell} scope="col" className={cn("px-4 py-3 font-semibold", index > 0 && "text-right")}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-t border-line transition hover:bg-surface-2">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className={cn("px-4 py-3", index === 0 ? "text-fg" : "text-right font-mono text-fg-2")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "mock": {
      const Mock = MOCKS[block.name];
      return Mock ? <Mock /> : null;
    }
  }
}

export function ArticleBody({ body, after }: { body: string; after?: { index: number; node: ReactNode } }) {
  const blocks = parseArticle(body);
  const headings = blocks.flatMap((block, index) => (block.kind === "heading" ? [index] : []));
  const insertAt = after ? (headings[after.index] ?? -1) : -1;
  return (
    <div>
      {blocks.map((block, index) => {
        const insert = index === insertAt ? after?.node : null;
        return (
          <div key={`${block.kind}-${index}`} className="contents">
            {insert}
            <Block block={block} />
          </div>
        );
      })}
    </div>
  );
}
