<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\AutomationWorkflow;
use App\Domain\Marketing\Support\AutomationDirectory;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class RunAutomations extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $automations = DB::table('mkt_automations')->where('status', 'activa')->orderBy('code')->get();
        $fallback = app(Advisors::class)->all(['tenant_admin', 'manager'])->first()['id'] ?? null;
        $sent = 0;
        $ran = 0;

        foreach ($automations as $automation) {
            if (app(AutomationDirectory::class)->queue($automation)->isEmpty()) {
                continue;
            }

            $actor = User::query()->find($automation->updated_by ?? $automation->created_by) ?? ($fallback ? User::query()->find($fallback) : null);

            if (! $actor instanceof User) {
                continue;
            }

            try {
                $result = app(AutomationWorkflow::class)->run((string) $automation->code, $actor);
                $sent += $result['sent'];
                $ran++;
            } catch (ApiException) {
                continue;
            }
        }

        return $ran === 0 ? 'Sin contactos en cola para las automatizaciones activas' : self::plural($ran, 'automatización ejecutada', 'automatizaciones ejecutadas').' · '.self::plural($sent, 'mensaje', 'mensajes');
    }
}
