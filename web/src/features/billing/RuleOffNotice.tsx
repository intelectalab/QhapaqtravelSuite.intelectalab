import { Lock } from "lucide-react";
import Link from "next/link";

export function RuleOffNotice({ feature, kept }: { feature: string; kept: string }) {
  return (
    <div className="lift mb-5 flex flex-wrap items-start gap-3 rounded-card border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))] px-4 py-3.5">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-warn">
        <Lock size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">{feature} no está activo en tu plan</p>
        <p className="text-[12.5px] text-fg-2">{kept} No puedes crear nuevos.</p>
      </div>
      <Link href="/admin/suscripcion" className="self-center text-[12.5px] font-semibold text-accent hover:underline">
        Ver planes
      </Link>
    </div>
  );
}
