<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReceiveWebContact
{
    public const REASONS = [
        'cotizar' => 'Quiero cotizar un viaje',
        'reserva' => 'Tengo una reserva',
        'pagos' => 'Pagos y comprobantes',
        'otro' => 'Otra consulta',
    ];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly CaptureWebLead $leads,
    ) {}

    public function handle(array $data): array
    {
        $now = Carbon::now($this->context->timezone());
        $email = Str::lower(trim($data['email']));
        $lead = $data['reason'] === 'cotizar' ? $this->leads->handle([
            'name' => $data['name'],
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'adults' => 1,
            'comments' => $data['message'],
        ], 'contacto') : null;
        $client = DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id');
        $reservation = isset($data['reservation']) ? DB::table('booking_reservations')->whereNull('deleted_at')->where('code', Str::upper(trim($data['reservation'])))->first(['id', 'client_id']) : null;
        $code = $this->codes->next('collab_conversations', 'CNV-');
        $id = (string) Str::uuid7();

        DB::table('collab_conversations')->insert([
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'channel' => 'form',
            'contact_name' => trim($data['name']),
            'contact_email' => $email,
            'contact_phone' => $data['phone'] ?? null,
            'subject' => Str::limit('Formulario web: '.self::REASONS[$data['reason']].' — '.trim($data['message']), 195),
            'status' => 'abierta',
            'priority' => $data['reason'] === 'reserva' ? 'alta' : 'media',
            'tags' => '{Web,Formulario}',
            'client_id' => $client,
            'lead_id' => $lead ? DB::table('crm_leads')->where('code', $lead['code'])->value('id') : null,
            'reservation_id' => $client !== null && $reservation?->client_id === $client ? $reservation->id : null,
            'first_response_due_at' => $now->copy()->addMinutes(120),
            'last_inbound_at' => $now,
            'last_message_at' => $now,
            'unread_count' => 1,
        ]);
        DB::table('collab_messages')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'conversation_id' => $id,
            'channel' => 'form',
            'direction' => 'in',
            'body' => trim($data['message']),
            'sent_at' => $now,
        ]);
        $this->audit->log('Conversación', $code, 'crear', after: 'form');

        return ['code' => $code, 'lead' => $lead['code'] ?? null];
    }
}
