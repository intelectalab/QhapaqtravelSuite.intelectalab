<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use App\Domain\SupplierPortal\Support\SupplierOperations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierIncidents
{
    public function __construct(
        private readonly CodeSequence $sequence,
        private readonly AuditLogger $audit,
        private readonly OpsNotices $notices,
        private readonly Advisors $advisors,
        private readonly TenantContext $context,
    ) {}

    public function report(SupplierAccount $account, array $data): string
    {
        return DB::transaction(function () use ($account, $data): string {
            $service = $account->service((string) $data['service']);
            $from = Carbon::now($this->context->timezone())->subDays(SupplierOperations::INCIDENT_WINDOW_DAYS)->toDateString();

            if (in_array($service->status, ['cancelado', 'rechazado'], true) || $service->service_date < $from) {
                throw ApiException::unprocessable('SUP-BR-51', 'Solo puede reportar incidencias de servicios vigentes de los últimos '.SupplierOperations::INCIDENT_WINDOW_DAYS.' días.');
            }

            return $this->open($account, [
                'reservation_id' => $service->reservation_id,
                'reservation_service_id' => $service->id,
                'type' => $data['type'],
                'severity' => $data['severity'],
                'title' => trim((string) $data['title']),
                'description' => trim((string) $data['description']),
            ]);
        });
    }

    public function open(SupplierAccount $account, array $values): string
    {
        $order = DB::table('ops_orders')->where('reservation_id', $values['reservation_id'])->whereNull('deleted_at')->where('status', '<>', 'cancelada')->first(['id', 'coordinator_id']);
        $assignee = $order->coordinator_id ?? $this->advisors->all(['operations'])->first()['id'] ?? $this->advisors->all(['manager', 'tenant_admin'])->first()['id'] ?? null;
        $code = $this->sequence->next('ops_incidents', 'INC-', 4);
        $hours = IncidentDirectory::SLA_HOURS[$values['severity']];
        $id = (string) Str::uuid7();
        $actor = $account->user->getKey();

        DB::table('ops_incidents')->insert([
            'id' => $id,
            'code' => $code,
            'order_id' => $order?->id,
            'provider_id' => $account->id(),
            'status' => 'abierta',
            'assignee_id' => $assignee,
            'reported_by' => $actor,
            'source' => 'extranet',
            'sla_hours' => $hours,
            'sla_due_at' => CarbonImmutable::now()->addHours($hours),
            'created_by' => $actor,
            ...$values,
        ]);
        $this->log($id, $actor, 'registro', "Reporte desde la extranet de {$account->provider->name}.", 'proveedor');

        if ($values['severity'] === 'critica') {
            $this->log($id, null, 'alerta', 'Alerta crítica enviada a gerencia.', 'interna');
        }

        $this->audit->log('Incidencia', $code, 'crear', null, "abierta / {$values['severity']} (proveedor)");
        $critical = $values['severity'] === 'critica';
        $this->notices->toOperations($critical ? 'incidencia.critica' : 'incidencia.creada', "{$code} {$values['title']} · {$account->provider->name}", $values['description'], 'ops_incident', $id, $values['reservation_id'], $assignee, $critical);

        return $code;
    }

    public function comment(SupplierAccount $account, string $code, string $message): void
    {
        DB::transaction(function () use ($account, $code, $message): void {
            $incident = $account->incident($code);

            if (! in_array($incident->status, IncidentDirectory::OPEN, true)) {
                throw ApiException::conflict('SUP-BR-53', 'La incidencia ya está resuelta o cerrada: no admite comentarios.');
            }

            $this->log($incident->id, $account->user->getKey(), 'comentario', $message, 'proveedor');
            DB::table('ops_incidents')->where('id', $incident->id)->update(['updated_at' => now()]);
            $this->audit->log('Incidencia', $code, 'comentario_proveedor', null, mb_substr($message, 0, 60));
            $this->notices->toOperations('incidencia.comentario', "{$code}: nuevo comentario de {$account->provider->name}", $message, 'ops_incident', $incident->id, $incident->reservation_id, $incident->assignee_id);
        });
    }

    private function log(string $incidentId, mixed $userId, string $kind, string $message, string $visibility): void
    {
        DB::table('ops_incident_logs')->insert(['incident_id' => $incidentId, 'user_id' => $userId, 'kind' => $kind, 'message' => $message, 'visibility' => $visibility, 'created_by' => $userId]);
    }
}
