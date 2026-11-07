<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Jobs\DefaultScheduledJobs;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Console\Command;

final class SyncTenantJobs extends Command
{
    protected $signature = 'tenant:jobs {--tenant= : Código de la agencia (por defecto, todas)}';

    protected $description = 'Crea los procesos programados del catálogo que le falten a cada agencia y a la plataforma';

    public function handle(DefaultScheduledJobs $jobs, TenantDatabase $database, TenantContext $context): int
    {
        $tenants = Tenant::on('pgsql_platform')
            ->when($this->option('tenant'), fn ($query, $code) => $query->where('code', $code))
            ->orderBy('code')
            ->get(['id', 'code']);

        foreach ($tenants as $tenant) {
            $created = $database->run((string) $tenant->getKey(), fn (): int => $jobs->sync((string) $tenant->getKey()));
            $this->line("{$tenant->code}: {$created} proceso(s) nuevo(s)");
        }

        $context->clear();

        if (! $this->option('tenant')) {
            $this->line('Plataforma: '.$jobs->syncPlatform().' proceso(s) nuevo(s)');
        }

        return self::SUCCESS;
    }
}
