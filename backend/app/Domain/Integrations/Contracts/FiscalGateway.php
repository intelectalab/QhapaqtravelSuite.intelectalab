<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;

interface FiscalGateway extends HealthCheckable
{
    public function issue(FiscalDocument $document): AdapterResult;

    public function status(string $externalId): AdapterResult;

    public function void(string $invoiceId, string $reason): AdapterResult;
}
