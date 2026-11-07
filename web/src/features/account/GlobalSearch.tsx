"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { searchEverything } from "@/app/(backoffice)/cuenta/actions";
import { cn } from "@/lib/cn";
import { SEARCH_MIN, type SearchHit, type SearchResult } from "@/lib/account";

const DEBOUNCE_MS = 250;

const EMPTY: SearchResult = { items: [], scope: "tenant", message: null };

export interface SearchScreen {
  href: string;
  label: string;
  group: string;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function screenHits(screens: SearchScreen[], term: string): SearchHit[] {
  const wanted = normalize(term);
  return screens.filter((screen) => normalize(`${screen.label} ${screen.group}`).includes(wanted)).slice(0, 5).map((screen) => ({ type: "screen", type_label: "Pantallas", code: screen.group, title: screen.label, subtitle: null, href: screen.href }));
}

export function GlobalSearch({ hint, search = searchEverything, screens = [], title = "Buscar en la agencia", description = "Busca clientes, leads, oportunidades, cotizaciones, reservas, productos, proveedores y órdenes por código o nombre.", placeholder = "Código, nombre, correo o documento" }: { hint: string; search?: (term: string) => Promise<SearchResult>; screens?: SearchScreen[]; title?: string; description?: string; placeholder?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const latest = useRef("");

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    latest.current = term;
    if (term.length < SEARCH_MIN) return;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const next = await search(term);
        if (latest.current === term) {
          setResult({ ...next, items: [...screenHits(screens, term), ...next.items] });
          setActive(0);
        }
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, search, screens]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: { hit: SearchResult["items"][number]; index: number }[] }>();
    result.items.forEach((hit, index) => {
      const group = map.get(hit.type) ?? { label: hit.type_label, items: [] };
      group.items.push({ hit, index });
      map.set(hit.type, group);
    });
    return [...map.values()];
  }, [result.items]);

  const short = query.trim().length < SEARCH_MIN;
  const visible = short ? [] : result.items;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResult(EMPTY);
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(visible.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && visible[active]) {
      event.preventDefault();
      go(visible[active].href);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-testid="global-search"
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-bg px-3 text-left text-fg-3 transition hover:border-fg-3/40 md:max-w-[520px]"
      >
        <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-gradient-to-br from-t1 to-t4 text-white">
          <Sparkles size={13} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px]">
          <span className="sm:hidden">Buscar</span>
          <span className="max-sm:hidden">{hint}</span>
        </span>
        <kbd className="flex-none rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg-3 max-md:hidden">Ctrl K</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(14_17_32/0.35)] backdrop-blur-[2px] motion-safe:data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          data-testid="global-search-dialog"
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_30px_60px_-24px_rgb(14_17_32/0.45)] outline-none"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <label className="flex flex-none items-center gap-3 border-b border-line px-4">
            <Search size={18} className="flex-none text-fg-3" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              data-testid="field:q"
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
            />
            {pending && <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-accent" />}
          </label>
          <div className="scroll-thin flex-1 overflow-y-auto p-2">
            {short ? (
              <p className="px-3 py-6 text-center text-[13px] text-fg-3">Escribe al menos {SEARCH_MIN} caracteres. Usa las flechas para moverte y Enter para abrir.</p>
            ) : result.message ? (
              <p className="px-3 py-6 text-center text-[13px] text-bad">{result.message}</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-fg-3">{pending ? "Buscando…" : `Sin resultados para «${query.trim()}».`}</p>
            ) : (
              groups.map((group) => (
                <section key={group.label} className="mb-1.5">
                  <h3 className="px-3 pb-1 pt-2 text-[11.5px] font-semibold text-fg-3">{group.label}</h3>
                  {group.items.map(({ hit, index }) => (
                    <button
                      key={`${hit.type}:${hit.code}`}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(hit.href)}
                      data-testid={`search-result:${hit.code}`}
                      className={cn("flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition", index === active ? "bg-surface-2" : "hover:bg-surface-2")}
                    >
                      <span className="w-[120px] flex-none truncate font-mono text-[12px] text-fg-3">{hit.code}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-semibold">{hit.title}</b>
                        {hit.subtitle && <span className="block truncate text-[12px] text-fg-3">{hit.subtitle}</span>}
                      </span>
                      {index === active ? <CornerDownLeft size={15} className="flex-none text-fg-3" /> : <ArrowRight size={15} className="flex-none text-fg-3 opacity-0" />}
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>
          {result.scope === "own" && !short && <p className="flex-none border-t border-line px-4 py-2.5 text-[12px] text-fg-3">Solo ves los registros de tu cartera.</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
