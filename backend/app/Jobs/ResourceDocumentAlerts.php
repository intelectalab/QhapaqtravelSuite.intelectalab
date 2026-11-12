<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ResourceDocumentAlerts extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    public const DAYS = 30;

    protected function run(): string
    {
        $limit = $this->today()->addDays(self::DAYS)->toDateString();
        $licenses = DB::table('ops_drivers')->whereNull('deleted_at')->where('license_expires_on', '<=', $limit)->get(['id', 'full_name as name', 'license_expires_on as expires']);
        $soat = DB::table('ops_vehicles')->whereNull('deleted_at')->where('soat_expires_on', '<=', $limit)->get(['id', 'plate as name', 'soat_expires_on as expires']);

        if ($licenses->isEmpty() && $soat->isEmpty()) {
            return 'Sin licencias ni SOAT por vencer en '.self::DAYS.' días';
        }

        $users = app(Advisors::class)->all(['operations'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;
        $today = $this->today()->toDateString();

        foreach ([['ops_driver', 'Licencia de', $licenses], ['ops_vehicle', 'SOAT de', $soat]] as [$type, $label, $rows]) {
            foreach ($rows as $row) {
                $expired = $row->expires < $today;
                $subject = "{$label} {$row->name} ".($expired ? 'vencido' : 'por vencer');
                $body = ($expired ? 'Venció el ' : 'Vence el ').Carbon::parse($row->expires)->format('d/m/Y').'. Sin documento vigente no se puede asignar a un servicio.';

                foreach ($users as $userId) {
                    $sent += $this->notifyOnce('recurso.documento_vence', $userId, $type, (string) $row->id, $subject, $body, true) ? 1 : 0;
                }
            }
        }

        return self::plural($licenses->count(), 'licencia', 'licencias').' y '.self::plural($soat->count(), 'SOAT', 'SOAT').' por vencer · '.self::plural($sent, 'aviso', 'avisos');
    }
}
