<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

final class SeedModule extends Command
{
    protected $signature = 'demo:seed-module {seeder : Nombre de la clase en database/seeders/Modules} {--tenant=TNT-0001}';

    protected $description = 'Carga los datos de demostración de un solo módulo';

    public function handle(TenantContext $context): int
    {
        DB::setDefaultConnection('pgsql_owner');
        $class = 'Database\\Seeders\\Modules\\'.$this->argument('seeder');

        if (! class_exists($class)) {
            $this->error("No existe {$class}.");

            return self::FAILURE;
        }

        $tenant = Tenant::query()->where('code', $this->option('tenant'))->firstOrFail();
        $context->set($tenant);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());
        DB::transaction(fn () => (new $class($tenant))->run());
        $context->clear();
        $this->info("{$this->argument('seeder')} listo.");

        return self::SUCCESS;
    }
}
