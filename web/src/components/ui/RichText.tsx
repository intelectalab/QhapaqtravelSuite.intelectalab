import { cn } from "@/lib/cn";

type Block = { kind: "heading" | "paragraph"; text: string } | { kind: "list"; items: string[] };

function blocks(body: string): Block[] {
  const result: Block[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("- ")) {
      const last = result[result.length - 1];
      if (last && last.kind === "list") last.items.push(line.slice(2));
      else result.push({ kind: "list", items: [line.slice(2)] });
      continue;
    }
    result.push(line.startsWith("#") ? { kind: "heading", text: line.replace(/^#+\s*/, "") } : { kind: "paragraph", text: line });
  }
  return result;
}

export function RichText({ body, size = "md", className }: { body: string; size?: "sm" | "md"; className?: string }) {
  const small = size === "sm";
  return (
    <div className={cn("flex flex-col", small ? "gap-1.5 text-[13.5px]" : "gap-3 text-[15.5px]", "leading-relaxed", className)}>
      {blocks(body).map((block, index) =>
        block.kind === "heading" ? (
          <h2 key={index} className={cn("font-semibold tracking-tight text-fg", small ? "mt-1 text-[15px]" : "mt-4 text-[21px] first:mt-0")}>
            {block.text}
          </h2>
        ) : block.kind === "list" ? (
          <ul key={index} className="flex flex-col gap-1.5">
            {block.items.map((item) => (
              <li key={item} className="relative pl-5 text-fg-2 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--tint,var(--accent))]">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="text-fg-2">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
