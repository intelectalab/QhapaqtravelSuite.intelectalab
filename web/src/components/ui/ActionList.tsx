import Link from "next/link";
import type { ReactNode } from "react";
import { toneStyle, type Tone } from "@/lib/tone";

export interface ActionListItem {
  id: string;
  icon: ReactNode;
  tone: Tone;
  title: string;
  detail?: string;
  action: string;
  href: string;
}

export function ActionList({ items }: { items: ActionListItem[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[36px_1fr_auto] items-center gap-3.5 border-t border-line py-3 first:border-t-0">
          <span style={toneStyle(item.tone)} className="tint-soft grid h-9 w-9 place-items-center rounded-[11px]">
            {item.icon}
          </span>
          <span className="min-w-0">
            <b className="block truncate font-semibold">{item.title}</b>
            {item.detail && <span className="block truncate text-[12.5px] text-fg-3">{item.detail}</span>}
          </span>
          <Link href={item.href} className="rounded-[10px] border border-line bg-surface px-3 py-[7px] text-[12.5px] font-semibold hover:bg-surface-2">
            {item.action}
          </Link>
        </li>
      ))}
    </ul>
  );
}
