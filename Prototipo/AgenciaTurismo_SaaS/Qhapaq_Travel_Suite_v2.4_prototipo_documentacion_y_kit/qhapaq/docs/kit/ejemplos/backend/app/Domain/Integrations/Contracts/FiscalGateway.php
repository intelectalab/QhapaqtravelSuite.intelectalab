<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;

/**
 * Emisión electrónica SUNAT vía OSE/PSE (spec 07 PROC-050; D-01 proveedor por definir; la spec 07 P-02 lo
 * llama `FiscalProvider`, el kit unifica el nombre en `FiscalGateway`).
 *
 * Se invoca SIEMPRE desde un job (cola `integrations`) alimentado por sys_outbox: un fallo del adaptador no
 * revierte la emisión interna (spec 07 T18); reintentos con backoff y alerta en fallo definitivo.
 */
interface FiscalGateway extends HealthCheckable
{
    /** Envía el comprobante. ok=true con status `emitido|aceptado|observado`; `externalId` = ticket/CDR. */
    public function issue(FiscalDocument $document): AdapterResult;

    /** Consulta el estado de un envío asíncrono (ticket) y devuelve `aceptado|observado|rechazado`. */
    public function status(string $externalId): AdapterResult;

    /** Comunicación de baja / anulación (resumen diario o baja según tipo). */
    public function void(string $invoiceId, string $reason): AdapterResult;
}
