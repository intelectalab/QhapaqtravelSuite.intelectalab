"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { loadNotifications, readAllNotifications } from "@/app/(backoffice)/cuenta/actions";
import { cn } from "@/lib/cn";
import type { NotificationFeed } from "@/lib/account";
import { formatDateTime } from "@/lib/format";

const REFRESH_MS = 60_000;

function ItemBody({ href, onOpen, children }: { href?: string | null; onOpen: () => void; children: ReactNode }) {
  if (!href) return <span className="min-w-0 flex-1">{children}</span>;
  return (
    <Link href={href} onClick={onOpen} className="min-w-0 flex-1 rounded-md outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40">
      {children}
    </Link>
  );
}

export function NotificationBell({ load = loadNotifications, readAll = readAllNotifications, logHref = "/admin/notificaciones", emptyHint = "Aquí aparecerán los avisos que te envíe el sistema." }: { load?: () => Promise<NotificationFeed | null>; readAll?: () => Promise<number | null>; logHref?: string; emptyHint?: string } = {}) {
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const next = await load();
      if (next) setFeed(next);
    });
  }, [load]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const markAll = () => {
    startTransition(async () => {
      const marked = await readAll();
      if (marked !== null) setFeed((current) => (current ? { ...current, unread: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current));
    });
  };

  const unread = feed?.unread ?? 0;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
    >
      <Popover.Trigger
        aria-label={unread > 0 ? `Avisos, ${unread} sin leer` : "Avisos"}
        title="Avisos"
        data-testid="notifications-bell"
        data-unread={unread}
        className="relative grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-brand px-1 text-[10px] font-bold leading-none text-brand-fg">{unread > 99 ? "99+" : unread}</span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 flex max-h-[min(560px,80vh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_24px_48px_-20px_rgb(14_17_32/0.4)] animate-in">
          <header className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
            <b className="flex-1 text-[14px] font-semibold">Avisos</b>
            {unread > 0 && (
              <button type="button" onClick={markAll} disabled={pending} data-testid="notifications-read-all" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-accent transition hover:bg-surface-2 disabled:opacity-50">
                <CheckCheck size={15} />
                Marcar todo como leído
              </button>
            )}
          </header>
          <div className="scroll-thin flex-1 overflow-y-auto">
            {feed === null ? (
              <p className="px-4 py-8 text-center text-[13px] text-fg-3">{pending ? "Cargando avisos…" : "No pudimos cargar tus avisos."}</p>
            ) : feed.items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-[14px] bg-surface-2 text-fg-3">
                  <Inbox size={20} />
                </span>
                <p className="text-[13.5px] font-semibold">Estás al día</p>
                <p className="mt-1 text-[12.5px] text-fg-3">{emptyHint}</p>
              </div>
            ) : (
              <ul>
                {feed.items.map((item) => (
                  <li key={item.id} data-testid={`notification:${item.code ?? item.id}`} data-read={item.read} className={cn("flex gap-3 border-b border-line-2 px-4 py-3 last:border-0", !item.read && "bg-accent/[0.04]")}>
                    <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", item.read ? "bg-transparent" : "bg-brand")} />
                    <ItemBody href={item.href} onOpen={() => setOpen(false)}>
                      <span className="flex items-baseline gap-2">
                        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.subject}</b>
                        <time className="flex-none text-[11.5px] text-fg-3" dateTime={item.created_at}>
                          {formatDateTime(item.created_at, false)}
                        </time>
                      </span>
                      {item.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-fg-2">{item.body}</span>}
                      <span className="mt-1 block text-[11.5px] text-fg-3">{item.event_label}</span>
                    </ItemBody>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {feed?.canViewLog && (
            <footer className="flex-none border-t border-line px-4 py-2.5 text-right">
              <Link href={logHref} onClick={() => setOpen(false)} className="text-[12.5px] font-semibold text-accent hover:underline">
                Ver el historial de envíos
              </Link>
            </footer>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
