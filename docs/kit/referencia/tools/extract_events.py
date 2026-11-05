#!/usr/bin/env python3
"""Genera kit-ia/referencia/EVENTOS-JOBS-NOTIFICACIONES.md desde la §8 de cada especificación.

Clasifica cada tabla de la §8 por su encabezado:
  - eventos de dominio  (primera columna «Evento…» sin columnas de canal/destinatario),
  - jobs                (primera columna «Job» / «Código» o columna «Cola» con frecuencia),
  - notificaciones      (columnas «Canal» / «Destinatario» / «Destino»),
  - tablas mixtas «Elemento | Cola | …» (se clasifican fila por fila: webhook, Reverb, job, notificación, evento),
  - push móviles («Evento | Destinatario | Deep link»).
Además: webhooks salientes (texto de la §8 y semilla webhooks.json), canales Reverb (todas las specs + contrato
`x-realtime-channels`), catálogo de eventos de notificación configurables (seeds settings.notifications) y la
semilla de jobs (seeds/jobs.json). Las viñetas de la §8 que no son tabla se listan como «otros elementos».

Uso: python3 kit-ia/referencia/tools/extract_events.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from specparse import KIT, MODULE_NAMES, iter_tables, md_escape, spec_files  # noqa: E402

OUT = KIT / "referencia" / "EVENTOS-JOBS-NOTIFICACIONES.md"
QUEUES = ["critical", "default", "notifications", "documents", "integrations", "reports", "low"]
openapi = json.loads((KIT / "api" / "openapi.json").read_text(encoding="utf-8"))
seeds = KIT / "seeds"


def col(h, *keys):
    for i, x in enumerate(h):
        xl = x.lower()
        if any((xl.startswith(k) if k == "cola" else k in xl) for k in keys):
            return i
    return None


def mobile_arch(spec: str, section: str) -> bool:
    """05 §8.4 describe la arquitectura de las apps (SQLite, sync); no son eventos ni jobs."""
    return spec == "05" and "8.4" in section


def cell(r, i):
    return r[i] if i is not None and i < len(r) else ""


def queues_in(txt: str) -> str:
    found = [q for q in QUEUES if re.search(r"(?<![\w-])`?" + q + r"`?(?![\w-])", txt)]
    return ", ".join(found)


def retries_in(txt: str) -> str:
    m = re.search(r"(`?tries`?\s*\d+[^|;]*|reintent[^|;.]*|backoff[^|;.]*|máx\.?\s*\d+\s*intentos[^|;]*)", txt, re.I)
    return m.group(1).strip() if m else ""


events, jobs, notifs, webhooks, realtime, pushes, others = [], [], [], [], [], [], []

for path in spec_files():
    spec = path.name[:2]
    for t in iter_tables(path):
        if not t.h2.startswith("## 8"):
            # canales Reverb y webhooks mencionados fuera de la §8 se recogen más abajo por texto
            continue
        h = [x.strip() for x in t.header]
        h0 = h[0].lower()
        if mobile_arch(spec, t.section) and col(h, "deep link") is None:
            continue
        for r in t.rows:
            if not any(r):
                continue
            row_txt = " | ".join(r)
            base = dict(spec=spec, section=t.section)
            if h0.startswith("evento / job") or h0.startswith("evento/job"):
                first = re.search(r"`([^`]+)`", r[0])
                tok = first.group(1) if first else r[0]
                is_job = (":" in tok or re.match(r"(Process|Send|Dispatch|Expire|Generate|Sync|Refresh|Schedule|Deliver|"
                                                 r"Release|Compute|Calculate|Recalculate|Purge|Import|Notify|Run|Mark|"
                                                 r"Check|Update|Build|Consolidate|Emit|Poll|Fetch|Detect)[A-Z]", tok)
                          or re.search(r"cada|diario|scheduler|cron", r[0], re.I))
                trig_i = col(h, "programación", "disparo", "frecuencia")
                eff = cell(r, col(h, "efecto", "qué hace"))
                q = queues_in(cell(r, col(h, "cola"))) or cell(r, col(h, "cola"))
                if is_job:
                    jobs.append(dict(base, name=r[0], queue=q, trigger=cell(r, trig_i), desc=eff, retries=retries_in(row_txt)))
                else:
                    events.append(dict(base, event=r[0], trigger=cell(r, trig_i), listeners=eff, queue=q, notification=""))
                continue
            if h0.startswith("evento") and col(h, "deep link") is not None:
                pushes.append(dict(base, event=r[0], to=cell(r, 1), link=cell(r, col(h, "deep link"))))
            elif h0.startswith("evento") and (col(h, "canal") is not None or col(h, "destin") is not None) \
                    and col(h, "listener") is None:
                notifs.append(dict(base, event=r[0], channel=cell(r, col(h, "canal")),
                                   to=cell(r, col(h, "destin")),
                                   template=cell(r, col(h, "asunto", "plantilla", "mensaje")) or "",
                                   note=""))
            elif h0.startswith("evento"):
                trig = cell(r, col(h, "disparador", "disparo", "emisor", "origen"))
                lis = cell(r, col(h, "listener", "efecto"))
                q = cell(r, col(h, "cola")) if col(h, "cola") is not None else queues_in(lis)
                notif = cell(r, col(h, "notificaci"))
                extra = cell(r, col(h, "adicional"))
                events.append(dict(base, event=r[0], trigger=trig, listeners=" ".join(x for x in [lis, extra] if x),
                                   queue=queues_in(q) or q, notification=notif))
                if notif and notif not in ("—", "-"):
                    notifs.append(dict(base, event=r[0], channel="", to="", template="", note=notif))
            elif h0.startswith("job") or h0.startswith("código") or (col(h, "cola") is not None and col(h, "frecuencia", "cron", "programación", "disparo") is not None):
                name_i = 0 if not h0.startswith("código") else col(h, "nombre")
                jobs.append(dict(base, name=r[0] if name_i == 0 else f"{r[0]} · {cell(r, name_i)}",
                                 queue=queues_in(cell(r, col(h, "cola"))) or cell(r, col(h, "cola")),
                                 trigger=cell(r, col(h, "frecuencia", "cron", "programación", "disparo")),
                                 desc=cell(r, col(h, "qué hace", "descripci", "notas", "detalle")),
                                 retries=retries_in(row_txt)))
            elif h0.startswith("elemento") or h0 in ("canal", "tipo"):
                name = r[0]
                q = cell(r, col(h, "cola"))
                desc = " ".join(r[1:])
                nl = name.lower()
                if "webhook" in nl:
                    webhooks.append(dict(base, events=desc, queue=queues_in(q) or q))
                elif "reverb" in nl or "tiempo real" in nl or "broadcast" in nl:
                    realtime.append(dict(base, channel=desc, desc=name))
                elif "job" in nl or "scheduler" in nl or "cron" in desc.lower():
                    jobs.append(dict(base, name=name, queue=queues_in(q) or q, trigger="", desc=cell(r, 2) or desc,
                                     retries=retries_in(row_txt)))
                elif "notific" in nl or "push" in nl or "correo" in nl or "email" in nl:
                    notifs.append(dict(base, event=name, channel="", to="", template="", note=desc))
                else:
                    events.append(dict(base, event=name, trigger="", listeners=desc, queue=queues_in(q) or q,
                                       notification=""))
            elif col(h, "canal") is not None or col(h, "destin") is not None:
                notifs.append(dict(base, event=r[0], channel=cell(r, col(h, "canal")), to=cell(r, col(h, "destin")),
                                   template="", note=" ".join(r[1:])))
            else:
                others.append(dict(base, text=" · ".join(x for x in r if x)))
    # viñetas y párrafos de la §8 que no son tabla
    in8 = False
    sec = ""
    fence = False
    for ln in path.read_text(encoding="utf-8").splitlines():
        if ln.startswith("## "):
            in8 = ln.startswith("## 8")
            sec = "§8"
            continue
        if not in8:
            continue
        if ln.startswith("###"):
            if ln.startswith("### "):
                sec = "§" + re.sub(r"^#+\s*", "", ln).strip()
            continue
        if mobile_arch(spec, sec) and not re.search(r"[Pp]ush", ln):
            continue
        if ln.strip().startswith("```"):
            fence = not fence
            continue
        if fence or ln.lstrip().startswith("|") or not ln.strip() or ln.strip() == "---":
            continue
        if re.search(r"[Jj]ob|[Ee]vento|[Nn]otific|[Cc]ola|webhook|Webhook|Reverb|cron|[Ss]cheduler|push|Push|canal|`[A-Z][a-zA-Z]+(ed|Job)`", ln):
            others.append(dict(spec=spec, section=sec, text=ln.strip().lstrip("-* ").strip()))

for j in jobs:
    if not j["queue"]:
        j["queue"] = queues_in(j["desc"])
    if not j["trigger"]:
        m = re.search(r"((?:diario|cada|semanal|mensual|lunes|hourly|daily)[^,)`]*)", j["name"] + " " + j["desc"], re.I)
        if m:
            j["trigger"] = m.group(1).strip()

# webhooks salientes: eventos citados en specs (formato recurso.accion) + semilla
wh_events = defaultdict(set)
for path in spec_files():
    for n, ln in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if re.search(r"webhook", ln, re.I):
            for m in re.finditer(r"`([a-z_]+(?:\.[a-z_]+)+(?:/[a-z_]+)*)`", ln):
                tok = m.group(1)
                if re.match(r"(reservation|payment|invoice|quote|lead|client|review|widget|passenger|booking|voucher|"
                            r"operation|incident|order|subscription|tenant|product|availability|claim|refund)\.", tok):
                    base_, acts = tok.rsplit(".", 1)
                    for a in acts.split("/"):
                        wh_events[f"{base_}.{a}"].add(path.name[:2])
seed_wh = json.loads((seeds / "webhooks.json").read_text(encoding="utf-8")) if (seeds / "webhooks.json").exists() else []
for w in seed_wh:
    for e in w.get("events", []):
        wh_events[e].add("seed")

# canales Reverb en todas las specs + contrato
rt_channels = OrderedDict()
for path in spec_files():
    for ln in path.read_text(encoding="utf-8").splitlines():
        for m in re.finditer(r"`((?:private-|presence-)?[a-z]+(?:\.\{?[a-zA-Z_]+\}?)+(?:\.[a-z_]+)*)`", ln):
            ch = m.group(1)
            if ("{" in ch and re.match(r"(private-|presence-)?(tenant|user|webchat|platform|ops|reservation|inbox|approvals|chat)", ch)):
                ctx = re.sub(r"\s+", " ", " ".join(c for c in ln.strip("|").split("|") if c.strip()))[:220]
                rt_channels.setdefault(ch, [])
                if len(rt_channels[ch]) < 3 and all(c[0] != path.name[:2] for c in rt_channels[ch]):
                    rt_channels[ch].append((path.name[:2], ctx))
contract_rt = openapi.get("x-realtime-channels", [])

seed_jobs = json.loads((seeds / "jobs.json").read_text(encoding="utf-8"))
settings = json.loads((seeds / "settings.json").read_text(encoding="utf-8"))
notif_matrix = settings.get("notifications", [])
notif_rules = settings.get("notifRules", {})

# ------------------------------------------------------------------ Markdown
L = []
A = L.append
A("# Eventos de dominio, jobs, notificaciones, webhooks y tiempo real")
A("")
A("> Generado por `kit-ia/referencia/tools/extract_events.py` desde la §8 de `proto/docs/especificaciones/*.md`, "
  "`kit-ia/api/openapi.json` (`x-realtime-channels`) y las semillas `jobs.json`, `settings.json` (`notifications`, "
  "`notifRules`) y `webhooks.json`. Texto literal de las especificaciones; cuando un dato no está definido se indica «Por definir».")
A("")
A(f"**Cifras:** {len(events)} eventos de dominio · {len(jobs)} jobs · {len(notifs)} notificaciones · {len(pushes)} push "
  f"móviles · {len(wh_events)} eventos de webhook saliente · {len(rt_channels)} canales Reverb.")
A("")
A("## 1. Marco común (spec 00 §8, CONVENCIONES §4)")
A("")
A("- **Colas Horizon (Redis):** `critical` (pagos, conversión, revocación de tokens) · `default` · `notifications` · "
  "`documents` (PDF) · `integrations` (outbox, adapters) · `reports` (exportaciones, read models) · `low`. Supervisores por cola.")
A("- **Jobs:** `TenantAware` (fijan `app.tenant_id` antes de tocar datos), `tries` + `backoff` exponencial, "
  "`ShouldBeUnique` cuando aplique, registro en `sys_job_runs`. Scheduler en `routes/console.php`.")
A("- **Reintentos por defecto** (09 INT-BR-04/05): errores transitorios (timeout, 5xx, 429) con backoff `base × 2^intento` "
  "(1, 2, 4, 8, 16 min ± 20 % jitter), máx. 5; luego fallo definitivo + alerta + auditoría. Errores permanentes (4xx de "
  "validación, destinatario inválido) pasan directo a fallo definitivo. Donde la tabla de jobs no indica reintentos, aplica esta política.")
A("- **Eventos de dominio:** se emiten **después del commit** (`afterCommit`); una notificación fallida nunca revierte la "
  "transacción (SEC-BR-22). Efectos externos garantizados vía outbox transaccional `sys_outbox` (cola `integrations`).")
A("- **Notificaciones:** `NotificationDispatcher` (cola `notifications`) lee `notif_event_rules` del tenant, resuelve "
  "destinatarios, condición y momento (inmediato / lote 15 min / horario laboral), elige plantilla por canal y crea "
  "`notif_messages` (`pendiente`); un job por canal envía por adapter (`MailSender`, `MessagingChannel`, FCM/APNs, Portal = "
  "registro + broadcast Reverb). Canales: Email, WhatsApp, Push, Portal.")
A("- **Tiempo real:** Laravel Reverb; canal privado por usuario `private-tenant.{tenantId}.user.{userId}` (campana, "
  "cambios de permisos → refrescar `/me/access`) y canales de tablero listados en §6.")
A("")

A("## 2. Eventos de dominio")
A("")
A("| Spec | Evento | Disparador / emisor | Listeners / efecto | Cola | Notificación asociada |")
A("|---|---|---|---|---|---|")
for e in events:
    A(f"| {e['spec']} | {md_escape(e['event'])} | {md_escape(e['trigger']) or '—'} | {md_escape(e['listeners']) or '—'} | "
      f"{md_escape(e['queue']) or '—'} | {md_escape(e['notification']) or '—'} |")
A("")

A("## 3. Jobs y scheduler")
A("")
A("| Spec | Job | Cola Horizon | Disparador / cron | Qué hace | Reintentos |")
A("|---|---|---|---|---|---|")
for j in jobs:
    A(f"| {j['spec']} | {md_escape(j['name'])} | {md_escape(j['queue']) or 'Por definir'} | {md_escape(j['trigger']) or 'on-demand / evento'} | "
      f"{md_escape(j['desc']) or '—'} | {md_escape(j['retries']) or 'Política general (§1)'} |")
A("")
A("### 3.1 Jobs de la semilla (`kit-ia/seeds/jobs.json`, pantalla Administración › Jobs)")
A("")
A("| ID | Nombre | Programación (prototipo) |")
A("|---|---|---|")
for j in seed_jobs:
    A(f"| {j.get('id')} | {md_escape(j.get('name', ''))} | {md_escape(j.get('cron', ''))} |")
A("")

A("## 4. Notificaciones")
A("")
A("### 4.1 Catálogo configurable por tenant (Administración › Notificaciones; `settings.notifications`)")
A("")
A("| Evento | Email | WhatsApp | Push | Portal | Destinatarios (`notifRules`) |")
A("|---|---|---|---|---|---|")
yn = lambda v: "sí" if v else "no"  # noqa: E731
for n in notif_matrix:
    A(f"| {n.get('event')} | {yn(n.get('email'))} | {yn(n.get('whatsapp'))} | {yn(n.get('push'))} | {yn(n.get('portal'))} | "
      f"{md_escape(notif_rules.get(n.get('event'), '—'))} |")
A("")
A("### 4.2 Notificaciones por módulo (según las especificaciones)")
A("")
A("Plantilla: cuando la especificación da el asunto o el código de plantilla se muestra; si no, «Por definir» "
  "(la plantilla vigente por canal se elige en `notif_templates`).")
A("")
A("| Spec | Evento | Canal | Destinatario | Plantilla / asunto | Detalle |")
A("|---|---|---|---|---|---|")
for n in notifs:
    A(f"| {n['spec']} | {md_escape(n['event'])} | {md_escape(n['channel']) or '—'} | {md_escape(n['to']) or '—'} | "
      f"{md_escape(n['template']) or 'Por definir'} | {md_escape(n['note']) or '—'} |")
A("")
if pushes:
    A("### 4.3 Push de las apps móviles (spec 05 §8.4.5)")
    A("")
    A("| Evento | Destinatario | Deep link |")
    A("|---|---|---|")
    for p in pushes:
        A(f"| {md_escape(p['event'])} | {md_escape(p['to'])} | {md_escape(p['link'])} |")
    A("")

A("## 5. Webhooks salientes")
A("")
A("Firma HMAC-SHA256 por suscripción, entrega por la cola `integrations` (outbox), timeout 10 s, sin redirecciones, "
  "validación SSRF; 2xx = entregado, 410 = deshabilitar suscripción, otro código o timeout = reintento con backoff "
  "(13 §8.4, API-BR-06/07). Registro de entregas en `integration_webhook_deliveries` (semilla `webhookDeliveries.json`).")
A("")
A("| Evento | Citado en | ")
A("|---|---|")
for e in sorted(wh_events):
    src = sorted(wh_events[e])
    A(f"| `{e}` | {', '.join('semilla webhooks.json' if s == 'seed' else 'spec ' + s for s in src)} |")
A("")
for w in webhooks:
    A(f"- *{w['spec']} {md_escape(w['section'])}*: {md_escape(w['events'])} (cola {w['queue'] or 'integrations'})")
A("")

A("## 6. Canales de tiempo real (Reverb)")
A("")
A("| Canal | Spec | Uso (extracto) |")
A("|---|---|---|")
for ch, lst in rt_channels.items():
    for spec, ctx in lst:
        A(f"| `{ch}` | {spec} | {md_escape(ctx)} |")
for c in contract_rt:
    A(f"| `{md_escape(c.get('channel', ''))}` | contrato ({c.get('spec', '')[:2]}) | {md_escape(c.get('description', ''))} · auth: {md_escape(c.get('auth', ''))} |")
for r in realtime:
    if any(ch in r["channel"] for ch in rt_channels):
        continue
    A(f"| {md_escape(r['channel'])} | {r['spec']} | {md_escape(r['desc'])} |")
A("")
A("Autorización de canales (Supuesto, coherente con 00 §8): `routes/channels.php` valida que el `tenantId` del canal "
  "coincida con el del token y que el usuario tenga el permiso de la pantalla que consume el canal.")
A("")

A("## 7. Otros elementos de la §8 (texto no tabular)")
A("")
by = defaultdict(list)
for o in others:
    by[o["spec"]].append(o)
for spec in sorted(by):
    A(f"### {spec} · {MODULE_NAMES.get(spec, spec)}")
    A("")
    for o in by[spec]:
        A(f"- *{md_escape(o['section'])}*: {o['text']}")
    A("")
OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"eventos {len(events)} · jobs {len(jobs)} · notificaciones {len(notifs)} · push {len(pushes)} · "
      f"webhooks {len(wh_events)} · reverb {len(rt_channels)} · otros {len(others)}")
