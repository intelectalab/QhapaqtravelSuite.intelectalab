"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface FilePickerProps {
  label: string;
  accept: string;
  formats: string;
  maxKb: number;
  name?: string;
}

export function FilePicker({ label, accept, formats, maxKb, name = "file" }: FilePickerProps) {
  const [file, setFile] = useState<File | null>(null);
  const tooBig = file !== null && file.size > maxKb * 1024;
  const limit = maxKb >= 1024 ? `${Math.round(maxKb / 1024)} MB` : `${maxKb} KB`;
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-fg">{label}</span>
      <label className={cn("group flex cursor-pointer items-center gap-3 rounded-tile border border-dashed px-4 py-4 transition hover:-translate-y-0.5 hover:border-t1 hover:bg-[color-mix(in_srgb,var(--t1)_5%,var(--surface))]", tooBig ? "border-bad" : "border-line")}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--t1)_12%,var(--surface))] text-t1 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <FileUp size={18} />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <b className="block truncate font-semibold">{file ? file.name : "Elegir archivo"}</b>
          <span className={cn("block text-[12px]", tooBig ? "text-bad" : "text-fg-3")}>{file ? `${Math.ceil(file.size / 1024)} KB${tooBig ? ` · supera ${limit}` : ""}` : `${formats} de hasta ${limit}`}</span>
        </span>
        <input type="file" name={name} accept={accept} required className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}
