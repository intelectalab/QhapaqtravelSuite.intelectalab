<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Corporate\Actions\CorporateStatements;

final class SendCorporateStatements extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $sent = app(CorporateStatements::class)->runAutomatic();

        return $sent === [] ? 'Ninguna cuenta corporativa tiene envío programado para hoy' : self::plural(count($sent), 'estado de cuenta enviado', 'estados de cuenta enviados').': '.implode(', ', $sent);
    }
}
