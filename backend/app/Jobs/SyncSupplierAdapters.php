<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Admin\Support\IntegrationErrors;
use Illuminate\Support\Facades\DB;

final class SyncSupplierAdapters extends TenantJob
{
    public const QUEUE = 'integrations';

    protected function run(): string
    {
        $rows = DB::table('integration_adapters')->whereIn('status', ['activo', 'sandbox', 'parcial'])->orderBy('code')->get(['code', 'name']);
        $adapters = $rows->pluck('code');

        if ($adapters->isEmpty()) {
            return 'Sin integraciones activas por revisar';
        }

        $integrations = app(ManageIntegrations::class);
        $failed = collect();

        foreach ($rows as $adapter) {
            $test = $integrations->test($adapter->code);

            if ($test['ok']) {
                IntegrationErrors::resolve($this->tenantId, 'integration', $adapter->code);

                continue;
            }

            $failed->push($adapter->code);
            $attempt = (int) DB::table('integration_errors')->where('source', 'integration')->where('ref_code', $adapter->code)->where('status', 'reintentando')->value('attempt');
            IntegrationErrors::record($this->tenantId, 'integration', $adapter->code, (string) $adapter->name, (string) $test['result'], $attempt + 1, $this->tries);
        }
        $result = ($adapters->count() - $failed->count()).' de '.self::plural($adapters->count(), 'integración responde', 'integraciones responden');

        return $failed->isEmpty() ? $result : $this->warn($result.' · sin respuesta: '.$failed->implode(', '));
    }
}
