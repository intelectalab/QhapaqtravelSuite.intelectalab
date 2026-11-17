"use client";

import { Check, Shapes } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { LogoGlyph } from "@/components/shell/BrandMark";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { FormError } from "@/features/auth/AuthForms";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import type { LogoMark, LogoOverview } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { RISE } from "./AdminParts";

export function LogoPicker({ data, choose }: { data: LogoOverview; choose: (state: AdminActionState, form: FormData) => Promise<AdminActionState> }) {
  const [picked, setPicked] = useState<LogoMark>(data.current);
  const [state, run, pending] = useActionState<AdminActionState, FormData>(choose, ADMIN_INITIAL);
  const active = pending ? picked : data.current;
  const pick = (mark: LogoMark) => {
    if (mark === data.current || pending) return;
    setPicked(mark);
    const form = new FormData();
    form.set("mark", mark);
    startTransition(() => run(form));
  };

  return (
    <Card>
      <TintCardTitle icon={Shapes} title="Logo de KipuControl" aside="Menú, inicio de sesión, landing y pestaña" />
      <div role="radiogroup" aria-label="Logo de KipuControl" className="grid gap-3 sm:grid-cols-2">
        {data.options.map((option, index) => {
          const selected = active === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              data-testid={`logo:${option.value}`}
              onClick={() => pick(option.value)}
              style={{ animationDelay: `${index * 60}ms` }}
              className={cn("group flex flex-col gap-3 rounded-[16px] border p-3 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 disabled:cursor-wait", selected ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-accent/40", RISE)}
            >
              <span className="flex items-center gap-2.5 rounded-[12px] bg-menu px-3.5 py-3">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-white transition-transform duration-300 group-hover:-rotate-6">
                  <LogoGlyph mark={option.value} />
                </span>
                <b className="text-[15px] font-bold tracking-tight text-white">KipuControl</b>
              </span>
              <span className="flex items-center gap-2 rounded-t-[9px] border border-b-0 border-line bg-surface-2 px-2.5 py-1.5 text-[11.5px] text-fg-2">
                <LogoGlyph mark={option.value} size={14} />
                Inicio · KipuControl
              </span>
              <span className="flex items-start justify-between gap-2 px-0.5">
                <span className="leading-tight">
                  <b className="block text-[13.5px] font-semibold">{option.label}</b>
                  <span className="text-[12px] text-fg-3">{option.hint}</span>
                </span>
                {selected && (
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-accent text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <FormError message={state.done ? null : state.message} />
      <p className="mt-3 text-[12px] text-fg-3">{pending ? "Cambiando el logo…" : "El cambio se aplica al momento para todos. Las agencias siguen usando su propio logo en su sitio."}</p>
    </Card>
  );
}
