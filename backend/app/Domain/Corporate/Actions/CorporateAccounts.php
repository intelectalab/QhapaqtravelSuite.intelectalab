<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Actions;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Corporate\Support\CorporateDirectory;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CorporateAccounts
{
    public const EDITABLE = ['currency', 'credit_days', 'require_approval', 'approval_threshold', 'approval_ttl_hours', 'default_cost_center_id', 'statement_auto', 'statement_day', 'statement_recipients', 'notes'];

    public function __construct(private readonly CorporateDirectory $directory, private readonly AuditLogger $audit) {}

    public function create(array $data, User $actor): string
    {
        $client = DB::table('crm_clients')->whereNull('deleted_at')
            ->where(fn ($query) => Str::isUuid((string) $data['client']) ? $query->where('id', $data['client']) : $query->where('code', $data['client']))
            ->first(['id', 'code', 'name', 'kind', 'email']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un cliente vigente del CRM.');

        if (Portfolio::ownOnly($actor) && ! Portfolio::inClients($actor, (string) $client->id)) {
            throw ApiException::forbidden('SCOPE_OWNERSHIP', 'Este cliente pertenece a la cartera de otro asesor.', ['crm.records.reassign']);
        }

        if ($client->kind !== 'empresa') {
            throw ApiException::unprocessable('CORP_CLIENT_COMPANY', 'La cuenta corporativa es para empresas. Este cliente está registrado como persona.');
        }

        if ($this->directory->forClient((string) $client->id) !== null) {
            throw ApiException::conflict('CORP_ACCOUNT_EXISTS', "{$client->name} ya tiene una cuenta corporativa.");
        }

        $values = $this->values([
            'currency' => 'PEN',
            'credit_days' => 30,
            'require_approval' => false,
            'approval_threshold' => null,
            'approval_ttl_hours' => 72,
            'statement_auto' => false,
            'statement_day' => 1,
            'statement_recipients' => array_filter([$client->email]),
            'notes' => null,
            ...array_intersect_key($data, array_flip(self::EDITABLE)),
        ]);
        $this->assertCoherent($values);

        return DB::transaction(function () use ($client, $values, $actor): string {
            $id = (string) Str::uuid7();
            DB::table('crm_corporate_accounts')->insert([
                'id' => $id,
                'client_id' => $client->id,
                'status' => 'activa',
                ...$values,
                'default_cost_center_id' => null,
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Cuenta corporativa', (string) $client->code, 'alta', null, $this->summary($values), evidence: ['account_id' => $id]);

            return $id;
        });
    }

    public function update(object $account, array $data, int $lockVersion): void
    {
        IfMatch::assertMatches($lockVersion, (int) $account->lock_version);
        $changes = array_intersect_key($data, array_flip(self::EDITABLE));

        if (array_key_exists('default_cost_center_id', $changes) && $changes['default_cost_center_id'] !== null) {
            $center = $this->directory->costCenter($account, (string) $changes['default_cost_center_id']);
            if (! $center->active) {
                throw ApiException::unprocessable('CORP_COST_CENTER_INACTIVE', 'El centro de costo por defecto debe estar activo.');
            }
            $changes['default_cost_center_id'] = (string) $center->id;
        }

        $before = $this->values((array) $account);
        $after = $this->values([...(array) $account, ...$changes]);
        $this->assertCoherent($after);
        $diff = array_filter(array_keys($after), fn (string $key): bool => ($before[$key] ?? null) !== ($after[$key] ?? null));

        if ($diff === [] && ! array_key_exists('default_cost_center_id', $changes)) {
            return;
        }

        DB::transaction(function () use ($account, $after, $before, $changes, $diff): void {
            $updated = DB::table('crm_corporate_accounts')->where('id', $account->id)->where('lock_version', $account->lock_version)->update([
                ...$after,
                ...(array_key_exists('default_cost_center_id', $changes) ? ['default_cost_center_id' => $changes['default_cost_center_id']] : []),
            ]);
            if ($updated === 0) {
                throw ApiException::conflict(IfMatch::STALE, 'La cuenta cambió mientras la editabas. Recarga para ver los cambios.');
            }
            $this->audit->log('Cuenta corporativa', (string) $account->client_code, 'actualizar', $this->summary($before), $this->summary($after), diff: array_values($diff));
        });
    }

    public function suspend(object $account, bool $active, int $lockVersion, ?string $reason): void
    {
        IfMatch::assertMatches($lockVersion, (int) $account->lock_version);

        if ($account->status === 'cerrada') {
            throw ApiException::conflict('CORP_ACCOUNT_CLOSED', 'La cuenta está cerrada y ya no se puede reactivar ni suspender.');
        }

        $target = $active ? 'activa' : 'suspendida';

        if ($account->status === $target) {
            throw ApiException::conflict('CORP_ACCOUNT_SAME_STATUS', $active ? 'La cuenta ya está activa.' : 'La cuenta ya está suspendida.');
        }

        DB::transaction(function () use ($account, $target, $active, $reason): void {
            DB::table('crm_corporate_accounts')->where('id', $account->id)->update(['status' => $target]);
            $this->audit->log('Cuenta corporativa', (string) $account->client_code, $active ? 'reactivar' : 'suspender', (string) $account->status, trim($target.($reason ? " · {$reason}" : '')));
        });
    }

    private function values(array $source): array
    {
        $recipients = $source['statement_recipients'] ?? [];
        $recipients = is_string($recipients) ? PgArray::parse($recipients) : (array) $recipients;
        $recipients = array_values(array_unique(array_filter(array_map(fn (mixed $email): string => Str::lower(trim((string) $email)), $recipients))));
        $requireApproval = filter_var($source['require_approval'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return [
            'currency' => Str::upper((string) ($source['currency'] ?? 'PEN')),
            'credit_days' => (int) ($source['credit_days'] ?? 0),
            'require_approval' => $requireApproval,
            'approval_threshold' => ($source['approval_threshold'] ?? null) === null || $source['approval_threshold'] === '' ? null : number_format((float) $source['approval_threshold'], 2, '.', ''),
            'approval_ttl_hours' => (int) ($source['approval_ttl_hours'] ?? 72),
            'statement_auto' => filter_var($source['statement_auto'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'statement_day' => (int) ($source['statement_day'] ?? 1),
            'statement_recipients' => PgArray::from($recipients),
            'notes' => ($source['notes'] ?? null) === null ? null : (trim((string) $source['notes']) ?: null),
        ];
    }

    private function assertCoherent(array $values): void
    {
        if ($values['require_approval'] && $values['approval_threshold'] === null) {
            throw ApiException::unprocessable('CORP_THRESHOLD_REQUIRED', 'Si la cuenta exige aprobación, indica desde qué monto se pide.');
        }

        if ($values['statement_auto'] && PgArray::parse($values['statement_recipients']) === []) {
            throw ApiException::unprocessable('CORP_RECIPIENTS_REQUIRED', 'Para enviar el estado de cuenta automáticamente, agrega al menos un correo de destino.');
        }
    }

    private function summary(array $values): string
    {
        return implode(' · ', array_filter([
            $values['currency'],
            "crédito {$values['credit_days']} días",
            $values['require_approval'] ? "aprobación desde {$values['approval_threshold']}" : 'sin aprobación previa',
            $values['statement_auto'] ? "envío automático el día {$values['statement_day']}" : 'sin envío automático',
        ]));
    }
}
