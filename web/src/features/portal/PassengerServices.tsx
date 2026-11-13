"use client";

import { BedDouble, Bus, CalendarDays, CheckCircle2, Clock3, Compass, FileCheck2, FileText, Hotel, MapPin, Phone, ShieldCheck, Ticket, UserRound, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { PaxDocuments, PaxSection, PaxService, PaxVoucher, PaxVouchers } from "@/lib/portal";
import { EmptyLine, PortalBadge, RISE, rise, SectionCard } from "./PortalUi";

export const TRIP_SECTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/portal/viaje/hoteles", label: "Hoteles", icon: Hotel },
  { href: "/portal/viaje/transporte", label: "Transporte", icon: Bus },
  { href: "/portal/viaje/actividades", label: "Actividades", icon: Compass },
  { href: "/portal/viaje/vouchers", label: "Vouchers", icon: Ticket },
  { href: "/portal/viaje/documentos", label: "Documentos", icon: FileCheck2 },
];

const STATE: Record<string, { label: string; tone: "ok" | "info" | "mute" | "warn" }> = {
  completado: { label: "Realizado", tone: "mute" },
  en_curso: { label: "Hoy", tone: "info" },
  hoy: { label: "Hoy", tone: "info" },
  proximo: { label: "Próximo", tone: "ok" },
};

export function TripSectionNav({ trip }: { trip: string | null }) {
  const pathname = usePathname();
  const items = [{ href: trip ? `/portal/viajes/${trip}` : "/portal", label: "Resumen", icon: CalendarDays }, ...TRIP_SECTIONS];
  return (
    <nav aria-label="Secciones de tu viaje" className={cn("scroll-thin mb-5 flex gap-1.5 overflow-x-auto", RISE)}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("group flex h-9 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-t1 text-white" : "border-line bg-surface text-fg-2 hover:border-t1 hover:text-fg")}>
            <Icon size={15} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="flex items-start gap-1.5 text-[12.5px] text-fg-2">
      <Icon size={13} className="mt-0.5 flex-none text-fg-3" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function ServiceCard({ service, index }: { service: PaxService; index: number }) {
  const state = STATE[service.state];
  return (
    <li style={rise(index)} className={cn("lift rounded-card border border-line bg-surface p-4 shadow-card", RISE, service.state === "completado" && "opacity-75")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="block text-[15px] font-semibold leading-snug">{service.name}</b>
          <span className="text-[12.5px] text-fg-3">
            {formatDate(service.date)}
            {service.time ? ` · ${service.time}` : ""}
            {service.nights ? ` · ${service.nights} ${service.nights === 1 ? "noche" : "noches"}` : ""}
            {` · ${service.pax} ${service.pax === 1 ? "persona" : "personas"}`}
          </span>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          {state && <Badge tone={state.tone}>{state.label}</Badge>}
          <PortalBadge status={service.status} />
        </span>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {service.meeting_point && <Fact icon={MapPin}>{service.meeting_point}</Fact>}
        {service.provider && <Fact icon={service.kind === "alojamiento" ? BedDouble : UserRound}>{service.provider.name}{service.provider.phone ? ` · ${service.provider.phone}` : ""}</Fact>}
        {service.guide && <Fact icon={UserRound}>Guía {service.guide}{service.guide_languages.length ? ` (${service.guide_languages.join(", ")})` : ""}</Fact>}
        {(service.driver || service.vehicle) && <Fact icon={Bus}>{[service.driver ? `Conductor ${service.driver}` : null, service.vehicle ? `placa ${service.vehicle}` : null].filter(Boolean).join(" · ")}</Fact>}
        {service.confirmation && <Fact icon={CheckCircle2}>Confirmación {service.confirmation}</Fact>}
      </div>
      {service.includes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {service.includes.map((item) => (
            <li key={item} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] text-fg-2">{item}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

const SECTION_COPY: Record<string, { title: string; subtitle: string; empty: string; icon: LucideIcon }> = {
  hotels: { title: "Hoteles", subtitle: "Dónde duermes cada noche, con su confirmación.", empty: "Tu viaje no incluye alojamiento con nosotros.", icon: Hotel },
  transport: { title: "Transporte", subtitle: "Traslados y trenes, con el punto y la hora de recojo.", empty: "Tu viaje no incluye traslados ni trenes.", icon: Bus },
  activities: { title: "Actividades", subtitle: "Tours y actividades, con tu guía y lo que incluyen.", empty: "Aún no hay actividades en tu viaje.", icon: Compass },
};

export function PassengerServicesView({ data }: { data: PaxSection }) {
  const copy = SECTION_COPY[data.section] ?? SECTION_COPY.activities;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">{copy.title}</h1>
        <p className="text-[13px] text-fg-3">{copy.subtitle}</p>
      </div>
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<copy.icon size={22} />} title={copy.empty} description="Si tienes dudas, escríbenos desde Mensajes o Contactos." />
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.items.map((service, index) => (
            <ServiceCard key={service.code} service={service} index={index} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function PassengerVouchersView({ data }: { data: PaxVouchers }) {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">Vouchers</h1>
        <p className="text-[13px] text-fg-3">Muéstralos en cada servicio. El código QR lo valida el guía o el proveedor.</p>
      </div>
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Ticket size={22} />} title="Tus vouchers aún no están listos" description="Aparecen aquí en cuanto cada servicio queda confirmado." />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((voucher, index) => (
            <li key={voucher.code} style={rise(index)} className={RISE}>
              <Link href={`/portal/viaje/vouchers/${encodeURIComponent(voucher.code)}`} className="lift group flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card">
                <span className="flex items-center justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] text-t1 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><Ticket size={17} /></span>
                  <PortalBadge status={voucher.status} />
                </span>
                <b className="text-[14px] font-semibold leading-snug">{voucher.label}</b>
                <span className="text-[12.5px] text-fg-3">{formatDate(voucher.date)} · {voucher.pax} {voucher.pax === 1 ? "persona" : "personas"} · v{voucher.version}</span>
                <span className="mt-auto font-mono text-[11.5px] text-fg-3">{voucher.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PassengerVoucherView({ voucher }: { voucher: PaxVoucher }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <SectionCard icon={Ticket} title={voucher.label} aside={<PortalBadge status={voucher.status} />}>
        <div className="grid gap-2">
          <Fact icon={CalendarDays}>{formatDate(voucher.date)}{voucher.service?.time ? ` · ${voucher.service.time}` : ""}</Fact>
          {voucher.meeting_point && <Fact icon={MapPin}>{voucher.meeting_point}</Fact>}
          {voucher.provider && <Fact icon={Phone}>{voucher.provider.name}{voucher.provider.phone ? ` · ${voucher.provider.phone}` : ""}</Fact>}
          {voucher.service?.confirmation && <Fact icon={CheckCircle2}>Confirmación {voucher.service.confirmation}</Fact>}
          <Fact icon={Clock3}>Versión {voucher.version} · reserva {voucher.reservation}</Fact>
        </div>
        <h3 className="mt-4 text-[13px] font-semibold text-fg">Pasajeros</h3>
        <ul className="mt-1.5 flex flex-col gap-1">
          {voucher.passengers.map((passenger) => (
            <li key={passenger.name} className="flex items-center justify-between gap-2 text-[13px]">
              <span>{passenger.name}</span>
              {passenger.lead && <Badge tone="info">Titular</Badge>}
            </li>
          ))}
        </ul>
      </SectionCard>
      <Card className="flex flex-col items-center gap-2 text-center">
        {voucher.qr_image ? <Image src={voucher.qr_image} alt={`Código QR del voucher ${voucher.code}`} width={220} height={220} unoptimized className="rounded-tile bg-white p-2" /> : <EmptyLine>El código QR aún no está disponible.</EmptyLine>}
        <span className="font-mono text-[12px] text-fg-3">{voucher.code}</span>
        <span className="text-[12px] text-fg-3">Muéstralo en el servicio. No hace falta imprimirlo.</span>
      </Card>
    </div>
  );
}

const DOC_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "mute" }> = {
  ok: { label: "Validado", tone: "ok" },
  validado: { label: "Validado", tone: "ok" },
  vigente: { label: "Vigente", tone: "ok" },
  pendiente: { label: "Pendiente", tone: "warn" },
  vencido: { label: "Vencido", tone: "bad" },
  observado: { label: "Observado", tone: "warn" },
};

function DocStatus({ status }: { status: string | null }) {
  if (!status) return <Badge tone="mute">Sin revisar</Badge>;
  const meta = DOC_STATUS[status] ?? { label: status.charAt(0).toUpperCase() + status.slice(1), tone: "mute" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PassengerDocumentsView({ data }: { data: PaxDocuments }) {
  const href = (item: PaxDocuments["items"][number]) => (item.kind === "voucher" && item.code ? `/portal/viaje/vouchers/${encodeURIComponent(item.code)}` : item.kind === "itinerary" ? `/portal/viajes/${encodeURIComponent(data.code)}/itinerario` : null);
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-fg">Documentos</h1>
        <p className="text-[13px] text-fg-3">Lo que necesitas llevar: itinerario, confirmación, vouchers y el estado de tus documentos de viaje.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SectionCard icon={FileText} title="Del viaje" aside={`${data.items.length}`}>
          <ul className="flex flex-col gap-2">
            {data.items.map((item, index) => {
              const link = item.available ? href(item) : null;
              const body = (
                <>
                  <span className="min-w-0 truncate text-[13.5px] font-medium">{item.label}</span>
                  {item.available ? <Badge tone={link ? "info" : "ok"}>{link ? "Abrir" : "Disponible"}</Badge> : <Badge tone="mute">Aún no</Badge>}
                </>
              );
              return (
                <li key={`${item.kind}-${item.code ?? index}`} style={rise(index)} className={RISE}>
                  {link ? (
                    <Link href={link} className="lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5">{body}</Link>
                  ) : (
                    <span className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5">{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <div className="flex flex-col gap-5">
          <SectionCard icon={UserRound} title="Documentos de identidad" aside={`${data.passports.length}`}>
            {data.passports.length === 0 ? (
              <EmptyLine>Completa los datos de los viajeros para revisarlos.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.passports.map((item) => (
                  <li key={item.passenger} className="flex items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5">
                    <span className="min-w-0">
                      <b className="block truncate text-[13px] font-semibold">{item.passenger}</b>
                      <span className="text-[12px] text-fg-3">{[item.document ?? "Sin documento", item.nationality, item.expires_on ? `vence ${formatDate(item.expires_on)}` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <DocStatus status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard icon={ShieldCheck} title="Seguro de viaje" aside={`${data.insurance.length}`}>
            {data.insurance.length === 0 ? (
              <EmptyLine>Tu viaje no tiene seguro registrado con nosotros.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.insurance.map((item) => (
                  <li key={`${item.passenger}-${item.number ?? ""}`} className="flex items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5">
                    <span className="min-w-0">
                      <b className="block truncate text-[13px] font-semibold">{item.passenger}</b>
                      <span className="text-[12px] text-fg-3">{[item.number ? `Póliza ${item.number}` : null, item.expires_on ? `vence ${formatDate(item.expires_on)}` : null, item.note].filter(Boolean).join(" · ") || "Sin datos de la póliza"}</span>
                    </span>
                    <DocStatus status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          {typeof data.policy.cancellation === "string" && data.policy.cancellation.trim() !== "" && (
            <SectionCard icon={FileText} title="Política de cancelación">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg-2">{data.policy.cancellation}</p>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
