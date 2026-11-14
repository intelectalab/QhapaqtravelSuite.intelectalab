import { ShieldCheck } from "lucide-react";

export function PortfolioBadge({ hint }: { hint: string }) {
  return (
    <span title={hint} className="mr-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 align-middle text-[12px] font-semibold text-accent" data-testid="portfolio-scope">
      <ShieldCheck size={13} />
      Mi cartera
    </span>
  );
}
