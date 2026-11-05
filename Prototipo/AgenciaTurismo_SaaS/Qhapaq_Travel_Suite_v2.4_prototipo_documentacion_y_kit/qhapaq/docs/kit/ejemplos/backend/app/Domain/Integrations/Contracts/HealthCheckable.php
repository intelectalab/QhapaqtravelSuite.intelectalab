<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

/**
 * Prueba de conexión del adaptador (POST /api/v1/integrations/{id}/test, spec 09 §6):
 * persiste `integration_adapters.last_test_at / last_test_ok / last_test_result`.
 */
interface HealthCheckable
{
    public function healthcheck(): AdapterResult;
}
