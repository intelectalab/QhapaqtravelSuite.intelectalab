"use client";

/**
 * Idempotency-Key por INTENTO LÓGICO del usuario (CLAUDE.md web; spec 00 SEC-BR-16).
 *
 *  - Se genera al abrir el formulario/diálogo (no por cada fetch): los reintentos de red y el doble clic reutilizan
 *    la misma clave ⇒ el backend devuelve la misma respuesta y no duplica la reserva/pago.
 *  - `reset()` tras un éxito o cuando el usuario cambia los datos (es otra operación: misma clave con otro cuerpo
 *    respondería 422 IDEMPOTENCY_KEY_REUSED).
 *
 *   const idem = useIdempotencyKey();
 *   mutation.mutate({ ..., idempotencyKey: idem.key }, { onSuccess: idem.reset });
 */
import { useCallback, useState } from "react";

export function newIdempotencyKey(): string {
  return crypto.randomUUID(); // UUID v4 (contrato: 8–255 caracteres; columna key varchar(80))
}

export function useIdempotencyKey(): { key: string; reset: () => void } {
  const [key, setKey] = useState(newIdempotencyKey);
  const reset = useCallback(() => setKey(newIdempotencyKey()), []);
  return { key, reset };
}
