<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class PassengerFeedback
{
    public const TYPES = ['comentario' => 'Comentario', 'sugerencia' => 'Sugerencia', 'felicitacion' => 'Felicitación', 'reclamo' => 'Reclamo', 'incidencia' => 'Incidencia'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly PortalMessages $messages,
        private readonly RuleResolver $rules,
        private readonly TenantContext $context,
    ) {}

    public static function rules(): array
    {
        return [
            'trip' => ['nullable', 'string', 'max:30'],
            'type' => ['required', 'in:'.implode(',', array_keys(self::TYPES))],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'service' => ['nullable', 'string', 'max:30'],
            'text' => ['required', 'string', 'min:5', 'max:1000'],
        ];
    }

    public static function messages(): array
    {
        return [
            'type.*' => 'Elige el tipo de comentario.',
            'rating.*' => 'La calificación va de 1 a 5.',
            'text.*' => 'Escribe tu comentario (5 a 1000 caracteres).',
        ];
    }

    public function overview(PortalAccount $account, ?string $trip): array
    {
        $this->ensureEnabled();
        $reservation = $this->reservation($account, $trip);

        return [
            'trip' => ['code' => $reservation->code, 'title' => $reservation->title],
            'claims_book' => '/sitio/'.$this->context->tenant()->subdomain.'/libro-reclamaciones',
            'types' => collect(self::TYPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
            'services' => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'rechazado'])->orderBy('service_date')
                ->get(['code', 'name', 'service_date'])->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'date' => $row->service_date])->all(),
            'history' => DB::table('channel_pax_feedback as f')->leftJoin('booking_reservation_services as s', 's.id', '=', 'f.reservation_service_id')
                ->where('f.reservation_id', $reservation->id)->where('f.created_by', $account->user->getKey())->orderByDesc('f.created_at')
                ->get(['f.code', 'f.type', 'f.rating', 'f.text', 'f.status', 'f.reply', 'f.replied_at', 'f.created_at', 's.name as service'])
                ->map(fn (object $row): array => [...(array) $row, 'type_label' => self::TYPES[$row->type] ?? $row->type, 'rating' => $row->rating === null ? null : (int) $row->rating])->all(),
        ];
    }

    public function create(PortalAccount $account, array $data): array
    {
        $this->ensureEnabled();
        $reservation = $this->reservation($account, $data['trip'] ?? null);
        $serviceId = null;

        if (! empty($data['service'])) {
            $serviceId = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->where('code', $data['service'])->value('id')
                ?? throw ApiException::unprocessable('CAN-V21-03', 'El servicio no pertenece a tu viaje.', ['service' => ['El servicio no pertenece a tu viaje.']]);
        }

        $escalate = in_array($data['type'], ['reclamo', 'incidencia'], true);

        return DB::transaction(function () use ($account, $data, $reservation, $serviceId, $escalate): array {
            $code = $this->codes->next('channel_pax_feedback', 'FB-', 5);
            $conversation = $escalate ? $this->messages->send($account, [
                'trip' => $reservation->code,
                'subject' => self::TYPES[$data['type']].' desde el portal · '.$reservation->title,
                'topic' => $data['type'] === 'incidencia' ? 'salud' : null,
                'body' => $data['text'],
            ]) : null;

            DB::table('channel_pax_feedback')->insert([
                'code' => $code,
                'reservation_id' => $reservation->id,
                'passenger_name' => mb_substr($account->user->name, 0, 150),
                'type' => $data['type'],
                'rating' => $data['rating'] ?? null,
                'reservation_service_id' => $serviceId,
                'text' => trim((string) $data['text']),
                'status' => 'nuevo',
                'conversation_id' => $conversation ? DB::table('collab_conversations')->where('code', $conversation)->value('id') : null,
                'channel' => 'Portal pasajero',
                'contact_email' => $account->user->email,
                'contact_phone' => $account->client->phone,
                'created_by' => $account->user->getKey(),
                'updated_by' => $account->user->getKey(),
            ]);
            $this->audit->log('Comentario pasajero', $code, 'crear', null, self::TYPES[$data['type']].($conversation ? " → {$conversation}" : ''));

            return ['code' => $code, 'conversation' => $conversation, 'claims_book' => $data['type'] === 'reclamo'];
        });
    }

    private function ensureEnabled(): void
    {
        if (! $this->rules->on('R-PAX-FEEDBACK')) {
            throw ApiException::forbidden('CAN-V21-01', 'Los comentarios desde el portal no están habilitados para tu agencia.');
        }
    }

    private function reservation(PortalAccount $account, ?string $trip): object
    {
        return $trip ? $account->reservation($trip) : ($account->reservations()->first() ?? throw ApiException::notFound('No encontramos un viaje en tu cuenta.'));
    }
}
