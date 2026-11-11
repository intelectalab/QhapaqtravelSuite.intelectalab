"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { deleteSiteImage, uploadSiteImage } from "@/app/(backoffice)/admin/personalizacion/actions";
import { cn } from "@/lib/cn";
import type { SiteImage } from "@/lib/site-design";

export function Segmented<T extends string>({ label, value, options, onChange, hint, testId, disabled = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; hint?: string; testId?: string; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      <div role="radiogroup" aria-label={label} data-testid={testId} data-value={value} className="grid gap-1 rounded-control bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            data-testid={testId ? `${testId}:${option.value}` : undefined}
            onClick={() => onChange(option.value)}
            className={cn("min-h-9 rounded-[10px] px-2 py-1.5 text-[12.5px] font-semibold transition", value === option.value ? "bg-surface text-fg shadow-[0_2px_8px_-4px_rgb(14_17_32/0.35)]" : "text-fg-3 hover:text-fg")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function OptionTile({ selected, onClick, title, hint, children, testId }: { selected: boolean; onClick: () => void; title: string; hint?: string; children?: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={cn("group relative flex flex-col gap-2 rounded-[14px] border p-3 text-left transition duration-200 hover:-translate-y-0.5", selected ? "border-accent bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] shadow-[0_8px_20px_-14px_var(--accent)]" : "border-line hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]")}
    >
      {children}
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        {title}
        {selected && <Check size={14} className="text-accent" strokeWidth={3} />}
      </span>
      {hint && <span className="-mt-1.5 text-[11.5px] leading-snug text-fg-3">{hint}</span>}
    </button>
  );
}

export function OrderedToggles<T extends string>({ items, labels, hints, onChange, testId, locked = [] }: { items: { id: T; visible: boolean }[]; labels: Record<T, string>; hints?: Partial<Record<T, string>>; onChange: (items: { id: T; visible: boolean }[]) => void; testId: string; locked?: T[] }) {
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <ol className="grid gap-2" data-testid={testId}>
      {items.map((item, index) => (
        <li key={item.id} data-testid={`${testId}:${item.id}`} className={cn("flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2.5 transition hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]", !item.visible && "bg-surface-2/60")}>
          <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-surface-2 text-[12px] font-bold tabular-nums text-fg-3">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <b className={cn("block truncate text-[13.5px] font-semibold", !item.visible && "text-fg-3 line-through decoration-fg-3/40")}>{labels[item.id]}</b>
            {hints?.[item.id] && <span className="block truncate text-[12px] text-fg-3">{hints[item.id]}</span>}
          </span>
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${labels[item.id]}`} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ArrowUp size={15} />
          </button>
          <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar ${labels[item.id]}`} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            disabled={locked.includes(item.id)}
            onClick={() => onChange(items.map((current) => (current.id === item.id ? { ...current, visible: !current.visible } : current)))}
            aria-pressed={item.visible}
            data-testid={`${testId}:${item.id}:toggle`}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition disabled:opacity-40", item.visible ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok" : "bg-surface-2 text-fg-3 hover:text-fg")}
          >
            {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            {item.visible ? "Visible" : "Oculta"}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9;
  return <span className={cn("text-[11.5px] tabular-nums", value.length > max ? "font-semibold text-bad" : near ? "text-warn" : "text-fg-3")}>{value.length}/{max}</span>;
}

export function ImagePicker({ label, hint, value, onChange, images, onImagesChange, imageHref, testId }: { label: string; hint?: string; value: string | null; onChange: (id: string | null) => void; images: SiteImage[]; onImagesChange: (images: SiteImage[]) => void; imageHref: (id: string) => string; testId: string }) {
  const [open, setOpen] = useState(value === null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const selected = images.find((image) => image.id === value) ?? null;

  const upload = (file: File) => {
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const result = await uploadSiteImage(form);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onImagesChange([result.image, ...images]);
      onChange(result.image.id);
      setOpen(false);
    });
  };

  const remove = (id: string) => {
    setMessage(null);
    start(async () => {
      const result = await deleteSiteImage(id);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onImagesChange(images.filter((image) => image.id !== id));
    });
  };

  return (
    <div data-testid={testId}>
      <p className="mb-1.5 text-[13px] font-semibold text-fg">{label}</p>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      {selected && (
        <div className="flex items-center gap-3 rounded-[14px] border border-line p-2">
          <span className="h-14 w-24 flex-none rounded-[10px] bg-surface-2 bg-cover bg-center" style={{ backgroundImage: `url(${imageHref(selected.id)})` }} />
          <span className="min-w-0 flex-1 text-[12.5px]">
            <b className="block truncate font-semibold">{selected.name}</b>
            <span className="text-fg-3">{selected.width && selected.height ? `${selected.width} × ${selected.height} px` : "Imagen"}</span>
          </span>
          <button type="button" onClick={() => setOpen(!open)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-accent transition hover:bg-surface-2">
            {open ? "Cerrar" : "Cambiar"}
          </button>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-fg-3 transition hover:bg-surface-2 hover:text-fg">
            Quitar
          </button>
        </div>
      )}
      {(open || !selected) && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending} data-testid={`${testId}:upload`} className="grid aspect-[4/3] place-items-center rounded-[12px] border border-dashed border-line text-fg-3 transition hover:border-accent hover:text-accent disabled:opacity-60">
            <span className="grid justify-items-center gap-1 text-[11.5px] font-semibold">
              {pending ? <LoaderCircle size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              {pending ? "Subiendo…" : "Subir imagen"}
            </span>
          </button>
          {images.map((image) => (
            <div key={image.id} className={cn("group relative aspect-[4/3] overflow-hidden rounded-[12px] border-2 transition", image.id === value ? "border-accent" : "border-transparent hover:border-line")}>
              <button type="button" onClick={() => { onChange(image.id); setOpen(false); }} aria-label={`Usar ${image.name}`} className="absolute inset-0 bg-surface-2 bg-cover bg-center transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${imageHref(image.id)})` }} />
              <button type="button" onClick={() => remove(image.id)} aria-label={`Borrar ${image.name}`} title="Borrar de la galería" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-[rgb(14_17_32/0.6)] text-white opacity-0 transition group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />
      <p className="mt-1.5 text-[12px] text-fg-3">JPG, PNG o WebP de hasta 4 MB. Para la portada, mejor horizontal de 1600 px o más.</p>
      {message && <p className="mt-1.5 text-[12.5px] font-semibold text-bad">{message}</p>}
    </div>
  );
}
