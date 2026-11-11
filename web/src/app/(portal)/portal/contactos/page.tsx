import { Compass, Headset, Phone, ShieldAlert, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import type { PaxContacts } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Contactos del viaje" };

function Contact({ icon, title, name, detail, phone, email, urgent = false, index }: { icon: ReactNode; title: string; name: string; detail?: string | null; phone?: string | null; email?: string | null; urgent?: boolean; index: number }) {
  return (
    <article className={`lift rounded-card border bg-surface p-5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] ${urgent ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)]" : "border-line"}`} style={{ animationDelay: `${index * 60}ms` }}>
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${urgent ? "bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-bad" : "bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1"}`}>{icon}</span>
      <h2 className="mt-3 text-[12.5px] font-semibold text-fg-3">{title}</h2>
      <b className="block text-[16px] font-bold tracking-tight text-fg">{name}</b>
      {detail && <p className="text-[12.5px] text-fg-2">{detail}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className={`inline-flex h-10 items-center gap-2 rounded-control px-4 text-[13.5px] font-semibold transition hover:-translate-y-0.5 ${urgent ? "bg-bad text-white" : "bg-brand text-brand-fg"}`}>
            <Phone size={15} />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex h-10 items-center rounded-control border border-line px-4 text-[13.5px] font-semibold text-fg transition hover:bg-surface-2">
            {email}
          </a>
        )}
      </div>
    </article>
  );
}

export default async function PortalContactsPage({ searchParams }: PageProps<"/portal/contactos">) {
  const { trip } = await searchParams;
  const data = await passengerData<PaxContacts>(`/contacts${typeof trip === "string" ? `?trip=${encodeURIComponent(trip)}` : ""}`, "No pudimos cargar los contactos.");
  if (!data) redirect(PORTAL_HOME);
  let index = 0;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">Contactos de tu viaje</h1>
        <p className="text-[13px] text-fg-3">Reserva {data.code}. Ante una urgencia llama al número de emergencias; para lo demás, escríbenos desde Mensajes.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Contact index={index++} urgent icon={<ShieldAlert size={19} />} title={data.emergency.label} name={data.emergency.office?.name ?? "Agencia"} detail={data.emergency.office?.address} phone={data.emergency.phone} />
        {data.coordinator && <Contact index={index++} icon={<Headset size={19} />} title="Coordinador de tu operación" name={data.coordinator.name} phone={data.coordinator.phone} email={data.coordinator.email} />}
        {data.guide && <Contact index={index++} icon={<Compass size={19} />} title="Tu próximo guía" name={data.guide.name} detail={`${data.guide.service} · ${formatDate(data.guide.date, "long")}`} phone={data.guide.phone} />}
        {data.advisor && <Contact index={index++} icon={<UserRound size={19} />} title="Tu asesor de viaje" name={data.advisor.name} phone={data.advisor.phone} email={data.advisor.email} />}
      </div>
    </div>
  );
}
