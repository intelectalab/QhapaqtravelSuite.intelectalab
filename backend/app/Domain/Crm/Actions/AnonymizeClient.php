<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AnonymizeClient
{
    public const NAME = 'Cliente anonimizado';

    public const DOC = 'ANONIMIZADO';

    private const DOMAIN = 'anonimizado.invalid';

    private const OPEN_RESERVATIONS = ['completada', 'cancelada'];

    private const OPEN_RECEIVABLES = ['abierta', 'parcial', 'vencida'];

    public function __construct(
        private readonly ClientWorkflow $clients,
        private readonly AfterSalesWorkflow $cases,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(string $code, string $reason, ?string $caseCode, User $actor): array
    {
        if (Portfolio::ownOnly($actor)) {
            throw ApiException::forbidden('ARCO-03', 'La supresión de datos personales la ejecuta Gerencia o la administración de la agencia.');
        }

        $client = $this->clients->client($code, $actor);
        $case = $caseCode === null ? null : DB::table('crm_cases')->where('code', $caseCode)->where('client_id', $client->id)->where('type_code', ArcoRequests::CASE_TYPE)->first(['id', 'code', 'status']);
        if ($caseCode !== null && $case === null) {
            throw ApiException::unprocessable('ARCO-04', 'La solicitud ARCO indicada no es de este cliente.');
        }

        $reservations = DB::table('booking_reservations')->where('client_id', $client->id)->whereNull('deleted_at');
        $active = (clone $reservations)->whereNotIn('status', self::OPEN_RESERVATIONS)->pluck('code');
        if ($active->isNotEmpty()) {
            throw ApiException::conflict('ARCO-01', 'El cliente tiene viajes vigentes ('.$active->take(3)->implode(', ').'). Se pueden suprimir sus datos cuando terminen o se cancelen.');
        }
        if (DB::table('fin_receivables')->where('client_id', $client->id)->whereIn('status', self::OPEN_RECEIVABLES)->exists()) {
            throw ApiException::conflict('ARCO-02', 'El cliente tiene saldos por cobrar. Se pueden suprimir sus datos cuando estén pagados o cancelados.');
        }

        return DB::transaction(fn (): array => $this->apply($client, $reservations, $reason, $case, $actor));
    }

    private function apply(object $client, Builder $reservations, string $reason, ?object $case, User $actor): array
    {
        $now = now();
        $by = $actor->getKey();
        $placeholder = Str::lower(str_replace('-', '', (string) $client->code)).'@'.self::DOMAIN;

        DB::table('crm_clients')->where('id', $client->id)->update([
            'name' => self::NAME.' '.$client->code,
            'doc_number' => self::DOC,
            'email' => $placeholder,
            'phone' => null,
            'phone_norm' => null,
            'city' => null,
            'birth_date' => null,
            'tags' => DB::raw("'{}'::text[]"),
            'consents' => null,
            'deleted_at' => $now,
            'updated_by' => $by,
            'updated_at' => $now,
        ]);

        $contacts = DB::table('crm_client_contacts')->where('client_id', $client->id)->update(['name' => 'Contacto anonimizado', 'email' => null, 'phone' => null, 'updated_by' => $by, 'updated_at' => $now]);

        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', (clone $reservations)->select('id'))->update([
            'full_name' => 'Pasajero anonimizado',
            'doc_type' => null,
            'doc_number' => null,
            'phone' => null,
            'email' => null,
            'birth_date' => null,
            'diet_notes' => null,
            'updated_by' => $by,
            'updated_at' => $now,
        ]);

        $leadIds = array_filter([$client->source_lead_id ?? null]);
        $leads = DB::table('crm_leads')->where(fn (Builder $query) => $query->where('converted_client_id', $client->id)->orWhere('matched_client_id', $client->id)->orWhereIn('id', $leadIds))
            ->update(['full_name' => 'Lead anonimizado', 'company' => null, 'email' => null, 'phone' => null, 'phone_norm' => null, 'notes' => null, 'web_request' => null, 'updated_by' => $by, 'updated_at' => $now]);

        DB::table('mkt_contacts_subscribers')->where('client_id', $client->id)->whereNull('deleted_at')
            ->update(['full_name' => 'Suscriptor anonimizado', 'email' => $placeholder, 'phone' => null, 'phone_e164' => null, 'deleted_at' => $now, 'updated_by' => $by, 'updated_at' => $now]);

        $revoked = $this->revokeConsents((string) $client->id, $by, $now);
        $users = $this->closePortal((string) $client->id, $placeholder, $by, $now);

        $this->audit->log('Cliente', (string) $client->code, 'anonimizar', 'datos personales', 'Supresión ARCO · '.Str::limit($reason, 200, ''));

        if ($case !== null && in_array($case->status, ['abierta', 'en_proceso'], true)) {
            $this->cases->transition((string) $case->code, 'resolve', 'Datos personales suprimidos. Se conservan los comprobantes y registros contables que exige la ley.', $actor);
        }

        return [
            'code' => $client->code,
            'anonymized_at' => $now->toIso8601String(),
            'passengers' => $passengers,
            'contacts' => $contacts,
            'leads' => $leads,
            'consents_revoked' => $revoked,
            'portal_users' => $users,
            'case' => $case === null ? null : (string) $case->code,
        ];
    }

    private function revokeConsents(string $clientId, mixed $by, Carbon $now): int
    {
        $ids = DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $clientId)->where('status', 'otorgado')->pluck('id')->all();

        if ($ids === []) {
            return 0;
        }

        DB::table('mkt_consents')->whereIn('id', $ids)->update(['status' => 'revocado', 'revoked_at' => $now, 'revoke_source' => 'Supresión ARCO', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $by, 'updated_at' => $now]);
        DB::table('mkt_consent_events')->insert(array_map(fn (mixed $id): array => ['consent_id' => $id, 'event' => 'revocado', 'source' => 'Supresión ARCO', 'actor_id' => $by, 'occurred_at' => $now], $ids));

        return count($ids);
    }

    private function closePortal(string $clientId, string $placeholder, mixed $by, Carbon $now): int
    {
        $users = DB::table('iam_users')->where('client_id', $clientId)->whereNull('deleted_at')->get(['id', 'code']);

        foreach ($users as $user) {
            DB::table('iam_users')->where('id', $user->id)->update([
                'name' => 'Usuario anonimizado',
                'email' => Str::lower((string) ($user->code ?? $user->id)).'.'.$placeholder,
                'phone' => null,
                'status' => 'inactivo',
                'deactivated_at' => $now,
                'deactivated_reason' => 'Supresión de datos personales (ARCO)',
                'deleted_at' => $now,
                'updated_by' => $by,
                'updated_at' => $now,
            ]);
            DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->delete();
            DB::table('iam_user_invitations')->where('user_id', $user->id)->whereNull('accepted_at')->update(['expires_at' => $now]);
        }

        return $users->count();
    }
}
