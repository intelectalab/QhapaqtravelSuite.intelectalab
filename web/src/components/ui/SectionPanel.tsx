import type { TabItem } from "./Tabs";

export function SectionPanel({ tabs, active }: { tabs: TabItem[]; active: string }) {
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;
  return (
    <section aria-label={current.label} className="p-5">
      {current.content}
    </section>
  );
}
