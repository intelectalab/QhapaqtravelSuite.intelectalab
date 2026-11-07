<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Sequences\DefaultSequences;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class SyncTenantSequences extends Command
{
    protected $signature = 'tenant:sequences {--tenant= : Código de la agencia (por defecto, todas)}';

    protected $description = 'Crea las series correlativas que falten y alinea el siguiente número con los códigos ya emitidos';

    public function handle(DefaultSequences $sequences, TenantDatabase $database, TenantContext $context): int
    {
        $tenants = Tenant::on('pgsql_platform')
            ->when($this->option('tenant'), fn ($query, $code) => $query->where('code', $code))
            ->orderBy('code')
            ->get(['id', 'code', 'timezone']);

        if ($tenants->isEmpty()) {
            $this->error('No se encontró ninguna agencia.');

            return self::FAILURE;
        }

        foreach ($tenants as $tenant) {
            $year = CarbonImmutable::now($tenant->timezone ?: 'America/Lima')->year;
            $next = $database->run((string) $tenant->getKey(), fn (): array => $sequences->sync((string) $tenant->getKey(), $year));
            $this->line($tenant->code.': '.collect($next)->map(fn (int $number, string $type): string => "{$type} {$number}")->implode(', '));
        }

        $context->clear();

        return self::SUCCESS;
    }
}
