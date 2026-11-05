export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--t3)" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--t2)" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--t1)" />
      <path d="M13 13h9v9h-4.5v-4.5H13z" fill="var(--t4)" />
    </svg>
  );
}
