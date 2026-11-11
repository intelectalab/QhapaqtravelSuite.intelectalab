import { cn } from "@/lib/cn";
import { hueFor, type SiteImage } from "@/lib/site";

const RIDGES = [
  "M0 120 L60 70 L110 95 L170 40 L230 88 L290 55 L350 92 L400 64 L400 200 L0 200 Z",
  "M0 140 L50 110 L95 128 L150 86 L215 132 L270 100 L330 138 L400 108 L400 200 L0 200 Z",
  "M0 165 L70 140 L140 160 L210 132 L280 158 L340 142 L400 160 L400 200 L0 200 Z",
];

export function Scenery({ seed, className, label, image, children }: { seed: string; className?: string; label?: string; image?: SiteImage | null; children?: React.ReactNode }) {
  const hue = hueFor(seed);
  const sky = `linear-gradient(160deg, hsl(${hue} 62% 30%), hsl(${(hue + 28) % 360} 58% 46%) 55%, hsl(${(hue + 50) % 360} 70% 70%))`;
  const sunX = 18 + (hue % 60);

  return (
    <div role={label && !image ? "img" : undefined} aria-label={image ? undefined : label} className={cn("relative isolate overflow-hidden", className)} style={{ background: sky }}>
      <svg aria-hidden viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.06]">
        <circle cx={sunX * 4} cy={58} r={24} fill={`hsl(${(hue + 60) % 360} 90% 82%)`} opacity={0.85} />
        {RIDGES.map((d, index) => (
          <path key={d} d={d} fill={`hsl(${(hue + 200 + index * 12) % 360} ${30 - index * 6}% ${16 + index * 7}%)`} opacity={0.55 + index * 0.18} />
        ))}
        <path d="M170 40 L182 52 L176 52 L170 47 L164 54 L158 52 Z" fill="white" opacity={0.75} />
      </svg>
      {image ? (
        <div role="img" aria-label={image.alt || label} data-testid="site-photo" className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-[1.06]" style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }} />
      ) : (
        <div aria-hidden className="weave-tint absolute inset-x-0 bottom-0 h-6 bg-white opacity-[0.12] [mask-size:24px_24px]" />
      )}
      {children}
    </div>
  );
}
