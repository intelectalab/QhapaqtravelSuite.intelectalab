"use client";

import { Check, Copy, FileJson, ListChecks, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";

const SAMPLES: { id: string; label: string; code: string }[] = [
  {
    id: "node",
    label: "Node.js",
    code: `const crypto = require("crypto");

function verify(rawBody, header, secret) {
  const items = header.split(",").map((part) => part.split("="));
  const t = items.find(([key]) => key === "t")?.[1];
  const signatures = items.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return signatures.some((value) => value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)));
}`,
  },
  {
    id: "php",
    label: "PHP",
    code: `function verify(string $rawBody, string $header, string $secret): bool
{
    $t = null;
    $signatures = [];
    foreach (explode(',', $header) as $part) {
        [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
        if ($key === 't') $t = $value;
        if ($key === 'v1') $signatures[] = $value;
    }
    if ($t === null || abs(time() - (int) $t) > 300) return false;
    $expected = hash_hmac('sha256', $t.'.'.$rawBody, $secret);
    foreach ($signatures as $signature) {
        if (hash_equals($expected, $signature)) return true;
    }
    return false;
}`,
  },
  {
    id: "python",
    label: "Python",
    code: `import hashlib, hmac, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    items = [part.split("=", 1) for part in header.split(",")]
    t = next((value for key, value in items if key == "t"), None)
    signatures = [value for key, value in items if key == "v1"]
    if t is None or abs(time.time() - int(t)) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, value) for value in signatures)`,
  },
];

const HEADERS: [string, string][] = [
  ["KipuControl-Signature", "t=<unix>,v1=<firma>. Durante una rotación llegan dos v1: la del secreto nuevo y la del anterior."],
  ["KipuControl-Event-Type", "El evento, por ejemplo reservation.confirmed."],
  ["KipuControl-Event-Id", "Identificador único del evento. Úsalo para no procesar dos veces el mismo aviso."],
  ["KipuControl-Delivery-Id", "Código de la entrega, el mismo que ves en el log de entregas."],
];

const CONVENTIONS: [string, string][] = [
  ["Paginación", "Por cursor: page[size] y page[cursor]. La respuesta trae meta.next_cursor mientras haya más."],
  ["Montos", "Como texto decimal con dos posiciones y su moneda al lado, para no perder céntimos."],
  ["Fechas", "ISO 8601 en UTC. Las fechas sin hora van como AAAA-MM-DD."],
  ["Errores", "422 con errors por campo; 403 con required_permissions; 409 cuando el registro cambió o el estado no lo permite."],
  ["Reintentos seguros", "Envía Idempotency-Key en las altas para que un reintento no duplique el registro."],
  ["Concurrencia", "Envía If-Match con la versión que leíste: si alguien guardó antes, recibes 409 STALE_VERSION."],
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          });
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[8px] bg-surface px-2 py-1 text-[11.5px] font-semibold text-fg-2 shadow-card transition hover:text-fg"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      <pre className="scroll-thin overflow-x-auto rounded-[12px] bg-surface-2 p-3 pr-20 font-mono text-[11.5px] leading-relaxed">{code}</pre>
    </div>
  );
}

export function ApiDocs({ openapiUrl, version }: { openapiUrl: string; version: string }) {
  const [language, setLanguage] = useState(SAMPLES[0].id);
  const sample = SAMPLES.find((item) => item.id === language) ?? SAMPLES[0];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={FileJson} title="Especificación OpenAPI" aside={`Versión ${version}`} />
        <p className="mb-3 text-[13px] text-fg-2">Describe cada ruta con sus parámetros, respuestas y errores. Impórtala en Postman, Insomnia o tu generador de clientes.</p>
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 break-all font-mono text-[12.5px]">{openapiUrl}</span>
          <a href={openapiUrl} target="_blank" rel="noreferrer" className="rounded-[9px] bg-surface px-3 py-1.5 text-[12.5px] font-semibold shadow-card transition hover:text-accent">
            Abrir JSON
          </a>
        </div>
      </Card>

      <Card>
        <TintCardTitle icon={ShieldCheck} title="Verificar la firma de los webhooks" tone="ok" />
        <ol className="mb-4 grid gap-2 text-[13px] sm:grid-cols-3">
          {["Lee el cuerpo crudo, antes de convertirlo a JSON.", "Calcula HMAC-SHA256 de t + «.» + cuerpo con el secreto del webhook.", "Compara en tiempo constante y rechaza si t tiene más de 5 minutos."].map((step, index) => (
            <li key={step} className="lift flex items-start gap-2.5 rounded-tile border border-line px-3 py-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ok/15 text-[12px] font-bold text-ok">{index + 1}</span>
              <span className="text-fg-2">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mb-3 flex w-fit gap-1 rounded-control bg-surface-2 p-1">
          {SAMPLES.map((item) => (
            <button key={item.id} type="button" onClick={() => setLanguage(item.id)} className={cn("rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold", language === item.id ? "bg-surface shadow-card" : "text-fg-3 hover:text-fg")}>
              {item.label}
            </button>
          ))}
        </div>
        <CodeBlock code={sample.code} />
        <h3 className="mb-2 mt-4 text-[13px] font-semibold">Cabeceras de cada entrega</h3>
        <dl className="flex flex-col divide-y divide-line-2 rounded-[14px] border border-line">
          {HEADERS.map(([name, text]) => (
            <div key={name} className="grid gap-1 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-surface-2 sm:grid-cols-[220px_minmax(0,1fr)]">
              <dt className="font-mono text-[12.5px] font-semibold">{name}</dt>
              <dd className="text-fg-2">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] text-fg-3">Responde con un código 2xx en menos de 10 segundos. Si una entrega falla, puedes reenviarla desde el log de entregas; tras 10 fallos seguidos, o si respondes 410, el webhook se deshabilita.</p>
      </Card>

      <Card>
        <TintCardTitle icon={ListChecks} title="Convenciones" tone="t4" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONVENTIONS.map(([title, text]) => (
            <li key={title} className="lift rounded-tile border border-line px-3 py-2.5 text-[13px]">
              <b className="block font-semibold">{title}</b>
              <span className="text-fg-2">{text}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
