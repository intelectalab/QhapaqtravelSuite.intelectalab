<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\BusinessDays;
use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Domain\Crm\Support\ClaimConsumer;
use App\Domain\Crm\Support\ClaimNotices;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RegisterWebClaim
{
    private const SEDE_PREFIX = ['lima' => 'LIM', 'cusco' => 'CUS', 'arequipa' => 'AQP', 'puno' => 'PUN', 'trujillo' => 'TRU'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly BusinessDays $days,
        private readonly ClaimBookDirectory $directory,
        private readonly AuditLogger $audit,
        private readonly ClaimNotices $notices,
    ) {}

    public function handle(array $data): array
    {
        $sede = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->where('id', $data['sede_id'])->first(['id', 'name'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige el establecimiento donde contrataste el servicio.');
        $owner = $this->owner();
        $now = Carbon::now($this->context->timezone());
        $responseDays = (int) $this->directory->settings()->response_days;
        $email = Str::lower(trim($data['email']));
        $client = DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id');
        $reservation = isset($data['reservation']) ? DB::table('booking_reservations')->whereNull('deleted_at')->where('code', Str::upper(trim($data['reservation'])))->first(['id', 'client_id']) : null;
        $reservationId = $reservation && $client && $reservation->client_id === $client ? $reservation->id : null;
        $prefix = 'LR-'.$this->prefix($sede->name).'-'.$now->year.'-';
        $number = $this->codes->next('crm_cases', $prefix, 6, 'book_number');
        $code = $this->codes->next('crm_cases', 'REC-');
        $id = (string) Str::uuid7();
        $due = $this->days->add($now, $responseDays)->toDateString();

        DB::table('crm_cases')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'client_id' => $client,
            'reservation_id' => $reservationId,
            'origin' => 'manual',
            'type_code' => $data['type'],
            'priority' => $data['type'] === 'reclamo' ? 'alta' : 'media',
            'subject' => Str::limit($data['detail'], 180),
            'description' => $data['detail'],
            'status' => 'abierta',
            'owner_id' => $owner,
            'is_book' => true,
            'book_number' => $number,
            'sede_id' => $sede->id,
            'channel' => 'web',
            'book_status' => 'received',
            'consumer' => json_encode(ClaimConsumer::build([
                'name' => $data['name'],
                'doc_type' => $data['doc_type'],
                'doc_number' => $data['doc_number'],
                'address' => $data['address'],
                'email' => $email,
                'phone' => $data['phone'],
            ], $data), JSON_UNESCAPED_UNICODE),
            'good' => json_encode(['kind' => $data['good_kind'], 'description' => $data['good_description'], 'amount' => (float) ($data['good_amount'] ?? 0), 'currency' => $data['good_currency'] ?? 'PEN'], JSON_UNESCAPED_UNICODE),
            'detail' => $data['detail'],
            'request' => $data['request'],
            'received_at' => $now,
            'due_date' => $due,
            'response_days' => $responseDays,
            'ack_sent_at' => $now,
        ]);
        DB::table('crm_case_events')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'case_id' => $id,
            'event' => 'registro',
            'from_status' => null,
            'to_status' => 'abierta',
            'message' => "Hoja registrada en el sitio web ({$sede->name})".(($data['is_minor'] ?? false) ? " · menor de edad, apoderado {$data['guardian_name']} ({$data['guardian_relation']})" : '').". El consumidor aceptó recibir la respuesta en {$email}; constancia enviada",
        ]);
        $this->audit->log('Libro de reclamaciones', $number, 'registrar', null, "{$data['type']} · web");
        $this->notices->acknowledge($id);
        app(StaffNotices::class)->toRoles(['manager', 'tenant_admin'], 'reclamacion.nueva', "{$number} · nueva hoja del Libro de Reclamaciones", "Registrada desde el sitio web ({$sede->name}). Plazo de respuesta: {$due}.", 'crm_case', $id, null, [$owner]);

        return ['number' => $number, 'received_at' => $now->toIso8601String(), 'due_date' => $due, 'response_days' => $responseDays, 'email' => $email, 'sede' => $sede->name];
    }

    private function owner(): string
    {
        $id = DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'r.id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->whereNull('u.deleted_at')->where('u.status', 'activo')->where('p.name', 'crm.claims.manage')
            ->orderByRaw("case when r.name = 'manager' then 0 else 1 end")->orderBy('u.code')
            ->value('u.id');

        return $id ?? throw ApiException::conflict('LR-OWNER', 'La agencia aún no tiene un responsable del Libro de Reclamaciones. Escríbenos por correo mientras tanto.');
    }

    private function prefix(string $sede): string
    {
        $first = Str::lower(Str::ascii(strtok($sede, ' —') ?: $sede));

        return self::SEDE_PREFIX[$first] ?? Str::upper(Str::substr($first, 0, 3));
    }
}
