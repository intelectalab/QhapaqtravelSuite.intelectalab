import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg py-1 text-base font-bold text-accent transition hover:text-fg">
      <ArrowLeft size={18} strokeWidth={2.4} />
      {children}
    </Link>
  );
}
