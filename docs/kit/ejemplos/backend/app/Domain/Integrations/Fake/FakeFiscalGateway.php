<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;
use Brick\Math\BigDecimal;

/**
 * OSE simulada para desarrollo, pruebas y demo (equivale al modo "simulado" del prototipo, spec 07 §1).
 * Determinista: acepta todo salvo reglas mínimas de forma, para poder probar los caminos de error:
 *  - total ≤ 0                          ⇒ rechazo permanente
 *  - customerDocNumber = 'TIMEOUT'      ⇒ error transitorio (prueba de reintentos con backoff)
 * Guarda lo enviado en memoria para aserciones en Pest: app(FiscalGateway::class)->issued.
 */
final class FakeFiscalGateway implements FiscalGateway
{
    /** @var list<FiscalDocument> */
    public array $issued = [];

    public function issue(FiscalDocument $document): AdapterResult
    {
        if ($document->customerDocNumber === 'TIMEOUT') {
            return AdapterResult::transient('Tiempo de espera agotado (simulado).');
        }
        if (BigDecimal::of($document->totalAmount)->isLessThanOrEqualTo(0)) {
            return AdapterResult::permanent('El total del comprobante debe ser mayor a cero (simulado).');
        }

        $this->issued[] = $document;

        return AdapterResult::success('aceptado', 'FAKE-CDR-'.$document->series.'-'.$document->number, [
            'simulated' => true,
            'hash' => hash('sha256', $document->series.$document->number.$document->totalAmount),
        ]);
    }

    public function status(string $externalId): AdapterResult
    {
        return AdapterResult::success('aceptado', $externalId, ['simulated' => true]);
    }

    public function void(string $invoiceId, string $reason): AdapterResult
    {
        return AdapterResult::success('anulado', 'FAKE-BAJA-'.$invoiceId, ['simulated' => true]);
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
