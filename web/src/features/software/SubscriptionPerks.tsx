import { CalendarCheck, CreditCard, Gift, ReceiptText, RefreshCcw, ShieldCheck } from "lucide-react";
import { toneStyle, type Tone } from "@/lib/tone";

export function SubscriptionPerks({ days }: { days: number }) {
  const perks: { icon: typeof Gift; tone: Tone; title: string; text: string }[] = [
    { icon: CalendarCheck, tone: "t4", title: `${days > 0 ? days : 14} días de prueba`, text: "Con todas las funciones del plan y sin pedir tarjeta." },
    { icon: Gift, tone: "ok", title: "2 meses gratis al año", text: "En el plan anual pagas 10 meses y usas 12." },
    { icon: ReceiptText, tone: "t1", title: "Factura o boleta", text: "Precios en soles sin IGV; el 18 % se suma en el resumen antes de pagar." },
    { icon: CreditCard, tone: "t3", title: "Tarjeta, Yape, Plin o PayPal", text: "Los datos de la tarjeta los captura la pasarela; nunca pasan por KipuControl." },
    { icon: RefreshCcw, tone: "violet", title: "Sin permanencia", text: "Sube o baja de plan cuando tu operación lo pida." },
    { icon: ShieldCheck, tone: "t2", title: "Tus datos en orden", text: "La información de cada agencia queda aislada y cada cambio queda auditado." },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {perks.map((perk, index) => (
        <li key={perk.title} style={{ ...toneStyle(perk.tone), animationDelay: `${index * 70}ms` }} className="lift group flex gap-4 rounded-[18px] border border-line bg-surface p-5 animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-[var(--tint)] text-white shadow-[0_10px_20px_-12px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6">
            <perk.icon size={19} />
          </span>
          <span>
            <span className="block text-[15px] font-bold text-fg">{perk.title}</span>
            <span className="mt-1 block text-[13.5px] leading-relaxed text-fg-2">{perk.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
