<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ArcoRequests
{
    public const CASE_TYPE = 'arco';

    public const TYPES = [
        'acceso' => ['label' => 'Acceso', 'days' => 20],
        'rectificacion' => ['label' => 'Rectificación', 'days' => 10],
        'cancelacion' => ['label' => 'Cancelación', 'days' => 10],
        'oposicion' => ['label' => 'Oposición', 'days' => 10],
    ];

    public function __construct(
        private readonly AfterSalesWorkflow $cases,
        private readonly BusinessDays $days,
        private readonly NotificationLog $notifications,
        private readonly Advisors $advisors,
        private readonly TenantContext $context,
    ) {}

    public function request(PortalAccount $account, string $type, string $detail): array
    {
        $kind = self::TYPES[$type];
        $client = $account->client;
        $now = Carbon::now($this->context->timezone());
        $due = $this->days->add($now, $kind['days']);

        $managers = $this->advisors->all(['tenant_admin', 'manager'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $owner = $client->owner_id ?? $managers->first() ?? throw ApiException::conflict('ARCO-05', 'La agencia no tiene a quién asignar tu solicitud. Escríbele directamente.');

        return DB::transaction(function () use ($account, $client, $type, $kind, $detail, $due, $managers, $owner): array {
            $this->ensureCaseType();
            $code = $this->cases->openCase([
                'client_id' => $client->id,
                'origin' => 'manual',
                'type_code' => self::CASE_TYPE,
                'priority' => 'alta',
                'subject' => "Solicitud ARCO · {$kind['label']}",
                'description' => $detail,
                'owner_id' => $owner,
                'due_date' => $due->toDateString(),
                'response_days' => $kind['days'],
                'request' => $type,
            ], $account->user, "Solicitud de {$kind['label']} enviada desde el portal del cliente");

            $recipients = $managers->push((string) $owner)->unique();
            foreach ($recipients as $userId) {
                $this->notifications->record([
                    'event_code' => 'arco.solicitud',
                    'channel' => 'portal',
                    'recipient_user_id' => $userId,
                    'subject' => "Solicitud ARCO de {$client->code}: {$kind['label']}",
                    'body_rendered' => "Respóndela hasta el {$due->format('d/m/Y')} ({$kind['days']} días hábiles). Caso {$code}.",
                    'source_type' => 'crm_case',
                    'source_id' => (string) DB::table('crm_cases')->where('code', $code)->value('id'),
                    'created_by' => $account->user->getKey(),
                ]);
            }

            return ['code' => $code, 'type' => $type, 'due_date' => $due->toDateString(), 'response_days' => $kind['days']];
        });
    }

    private function ensureCaseType(): void
    {
        if (DB::table('crm_catalog_items')->where('kind', 'case_type')->where('code', self::CASE_TYPE)->exists()) {
            return;
        }

        DB::table('crm_catalog_items')->insert([
            'kind' => 'case_type',
            'code' => self::CASE_TYPE,
            'label' => 'Solicitud ARCO (datos personales)',
            'requires_detail' => false,
            'sort_order' => (int) DB::table('crm_catalog_items')->where('kind', 'case_type')->max('sort_order') + 1,
            'is_active' => true,
        ]);
    }
}
