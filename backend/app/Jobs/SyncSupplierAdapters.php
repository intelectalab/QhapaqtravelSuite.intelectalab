<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Actions\ManageIntegrations;
use Illuminate\Support\Facades\DB;

final class SyncSupplierAdapters extends TenantJob
{
    public const QUEUE = 'integrations';

    protected function run(): string
    {
        $adapters = DB::table('integration_adapters')->whereIn('status', ['activo', 'sandbox', 'parcial'])->orderBy('code')->pluck('code');

        if ($adapters->isEmpty()) {
            return 'Sin integraciones activas por revisar';
        }

        $integrations = app(ManageIntegrations::class);
        $failed = $adapters->reject(fn (string $code): bool => (bool) $integrations->test($code)['ok'])->values();
        $result = ($adapters->count() - $failed->count()).' de '.self::plural($adapters->count(), 'integración responde', 'integraciones responden');

        return $failed->isEmpty() ? $result : $this->warn($result.' · sin respuesta: '.$failed->implode(', '));
    }
}
