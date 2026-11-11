import { CalendarHeart, CreditCard, Ticket } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/features/site/Hero";

const PERKS = [
  { icon: CalendarHeart, title: "Tus reservas en un lugar", text: "Estado de cada viaje, servicios y viajeros." },
  { icon: Ticket, title: "Vouchers al instante", text: "Descárgalos cuando operaciones los emita." },
  { icon: CreditCard, title: "Pagos sin trámites", text: "Paga tu saldo en línea y sigue tus pagos por validar." },
];

export function AuthFrame({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: { text: string; label: string; href: string } }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="rounded-card border border-line bg-surface p-6 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          {children}
          {footer && (
            <p className="mt-6 border-t border-line pt-4 text-[13.5px] text-fg-2">
              {footer.text}{" "}
              <Link href={footer.href} className="font-semibold text-accent hover:underline">
                {footer.label}
              </Link>
            </p>
          )}
        </div>
        <aside className="grid gap-3 lg:self-start">
          {PERKS.map(({ icon: Icon, title: perk, text }, index) => (
            <div key={perk} className="lift flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${80 + index * 60}ms` }}>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1">
                <Icon size={18} />
              </span>
              <span>
                <b className="block text-[14px] font-semibold text-fg">{perk}</b>
                <span className="text-[12.5px] leading-relaxed text-fg-2">{text}</span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
