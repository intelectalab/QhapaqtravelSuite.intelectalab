/**
 * Errores de la API (spec 00 §6; contrato `components.schemas.Error` y `ValidationError`).
 *
 *   4xx/5xx → { error, code?, message, required_permissions?, correlation_id?, details? }
 *   422     → { message, errors: { campo: [msg] }, code?, correlation_id? }
 *
 * Reglas de UI (CLAUDE.md web):
 *  - 409: conflicto (estado, disponibilidad, `STALE_VERSION`, `IDEMPOTENCY_IN_PROGRESS`) → recargar y avisar.
 *  - 422 con `errors` → mapear a cada campo del formulario (applyServerErrors).
 *  - 422 con `code` → mostrar el código de regla y el mensaje (p. ej. «RT-4 · La salida … no tiene cupo»).
 *  - Mostrar siempre el `correlation_id` en errores inesperados (soporte lo usa para buscar en logs).
 */

export type ApiErrorBody = {
  error?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
  required_permissions?: string[];
  correlation_id?: string;
  details?: Record<string, unknown>;
};

/** Códigos transversales usados por el backend del kit. */
export const ERROR_CODES = {
  staleVersion: "STALE_VERSION", // If-Match desactualizado (spec 00 SEC-BR-17 y contrato)
  idempotencyInProgress: "IDEMPOTENCY_IN_PROGRESS",
  idempotencyReused: "IDEMPOTENCY_KEY_REUSED",
  ownership: "SEC-BR-09",
  featureNotInPlan: "FEATURE_NOT_IN_PLAN",
  tenantSuspended: "TENANT_SUSPENDED",
} as const;

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? `Error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ApiErrorBody = {};
    try {
      body = (await response.clone().json()) as ApiErrorBody;
    } catch {
      body = { message: response.statusText || "Error de red" };
    }
    body.correlation_id ??= response.headers.get("X-Request-Id") ?? undefined;
    return new ApiError(response.status, body);
  }

  get code(): string | undefined {
    return this.body.code;
  }
  get correlationId(): string | undefined {
    return this.body.correlation_id;
  }
  get fieldErrors(): Record<string, string[]> {
    return this.body.errors ?? {};
  }
  get requiredPermissions(): string[] {
    return this.body.required_permissions ?? [];
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
  get isStale(): boolean {
    return this.status === 409 && this.code === ERROR_CODES.staleVersion;
  }
  get isValidation(): boolean {
    return this.status === 422;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  /** Reintentar automáticamente solo errores transitorios (red, 429, 5xx, idempotencia en curso). */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500 || this.code === ERROR_CODES.idempotencyInProgress;
  }

  /** Texto para toast/alert: «RT-4 · mensaje» o el mensaje con código de seguimiento. */
  userMessage(): string {
    if (this.code && this.status !== 500) return `${this.code} · ${this.message}`;
    return this.correlationId ? `${this.message} (código ${this.correlationId})` : this.message;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
