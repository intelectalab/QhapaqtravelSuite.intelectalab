<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\OpportunityDirectory;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OpportunityWorkflow
{
    public function __construct(
        private readonly OpportunityDirectory $directory,
        private readonly CrmCatalog $catalog,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
        private readonly Advisors $advisors,
    ) {}

    public function changeStage(string $code, array $data, User $actor): array
    {
        $opportunity = $this->directory->scoped($actor)->where('o.code', $code)->first(['o.*'])
            ?? throw Portfolio::missing($actor, 'crm_opportunities', $code, 'La oportunidad no existe.', 'Esta oportunidad');
        $target = $data['stage'];
        $closed = in_array($opportunity->stage, ['ganada', 'perdida'], true);
        $warnings = [];

        if ($target === $opportunity->stage) {
            throw ApiException::unprocessable('SAME_STAGE', 'La oportunidad ya está en esa etapa.');
        }

        if ($closed && ! ($data['confirm_reopen'] ?? false)) {
            throw ApiException::conflict('CRM-BR-26', 'La oportunidad está cerrada. Confirma que quieres reabrirla.');
        }

        $stage = DB::table('crm_pipeline_stages')->where('code', $target)->first() ?? throw ApiException::unprocessable('STAGE', 'Esa etapa no existe.');
        $today = Carbon::now($this->context->tenant()->timezone ?: 'America/Lima')->toDateString();
        $values = ['stage' => $target, 'probability' => (int) $stage->default_probability, 'closed_at' => null, 'lost_reason_code' => null, 'lost_detail' => null, 'lost_at_stage' => null];

        if ($target === 'ganada') {
            $values = [...$values, 'probability' => 100, 'closed_at' => $today];
            $approved = DB::table('quote_quotes')->where('opportunity_id', $opportunity->id)->whereIn('status', ['aprobada', 'convertida'])->exists();
            if (! $approved) {
                $warnings[] = 'Ganaste la oportunidad sin una cotización aprobada. La reserva se genera desde la cotización aprobada.';
            }
        }

        if ($target === 'perdida') {
            $reason = (string) ($data['lost_reason'] ?? '');
            if (! $this->catalog->has('lost_reason', $reason)) {
                throw ApiException::unprocessable('CRM-BR-24', 'Elige por qué se perdió.');
            }
            if ($reason === 'otro' && trim((string) ($data['lost_detail'] ?? '')) === '') {
                throw ApiException::unprocessable('CRM-BR-24', 'Cuéntanos el motivo cuando eliges "Otro".');
            }
            $values = [...$values, 'probability' => 0, 'closed_at' => $today, 'lost_reason_code' => $reason, 'lost_detail' => $data['lost_detail'] ?? null, 'lost_at_stage' => $closed ? null : $opportunity->stage];
        }

        DB::table('crm_opportunities')->where('id', $opportunity->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Oportunidad', $code, $closed ? 'reabrir' : 'cambio_etapa', $opportunity->stage, $target);

        return $warnings;
    }

    private const FIELDS = ['title' => 'Título', 'amount' => 'Monto', 'currency' => 'Moneda', 'probability' => 'Probabilidad', 'expected_close_date' => 'Fecha de cierre', 'destination_label' => 'Destino', 'pax' => 'Pasajeros', 'notes' => 'Notas', 'owner_id' => 'Responsable'];

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $client = $this->client((string) $data['client_code'], $actor);
            $stage = DB::table('crm_pipeline_stages')->where('code', 'descubrimiento')->first();
            $owner = $this->owner($data['owner_id'] ?? null, $actor);
            $code = $this->codes->next('crm_opportunities', 'OPP-');
            DB::table('crm_opportunities')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'client_id' => $client->id,
                'title' => trim($data['title']),
                'stage' => 'descubrimiento',
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'probability' => (int) ($stage->default_probability ?? 35),
                'expected_close_date' => $data['expected_close_date'],
                'owner_id' => $owner,
                'destination_label' => trim((string) ($data['destination'] ?? '')) ?: null,
                'pax' => (int) ($data['pax'] ?? 0),
                'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
                'origin' => 'manual',
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Oportunidad', $code, 'crear', after: "{$client->code} · ".trim($data['title']));

            return $code;
        });
    }

    public function update(string $code, array $data, int $version, User $actor): void
    {
        $opportunity = $this->directory->scoped($actor)->where('o.code', $code)->first(['o.*']) ?? throw Portfolio::missing($actor, 'crm_opportunities', $code, 'La oportunidad no existe.', 'Esta oportunidad');
        $closed = in_array($opportunity->stage, ['ganada', 'perdida'], true);
        $values = [
            'title' => trim($data['title']),
            'amount' => $data['amount'],
            'currency' => $data['currency'],
            'probability' => $closed ? (int) $opportunity->probability : (int) $data['probability'],
            'expected_close_date' => $data['expected_close_date'],
            'destination_label' => trim((string) ($data['destination'] ?? '')) ?: null,
            'pax' => (int) ($data['pax'] ?? 0),
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
        ];

        if (! empty($data['owner_id']) && ! Portfolio::ownOnly($actor)) {
            $values['owner_id'] = $this->owner($data['owner_id'], $actor);
        }

        $changed = array_filter(self::FIELDS, fn (string $label, string $field) => array_key_exists($field, $values) && $this->differs($values[$field], $opportunity->{$field}), ARRAY_FILTER_USE_BOTH);

        if ($changed === []) {
            return;
        }

        $updated = DB::table('crm_opportunities')->where('id', $opportunity->id)->where('lock_version', $version)
            ->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::conflict('STALE_VERSION', 'Alguien cambió esta oportunidad mientras la veías. Recarga la página e inténtalo de nuevo.');
        }

        $this->audit->log('Oportunidad', $code, 'editar', after: implode(', ', $changed));

        if (isset($changed['owner_id'])) {
            $this->audit->log('Oportunidad', $code, 'reasignar', DB::table('iam_users')->where('id', $opportunity->owner_id)->value('name'), DB::table('iam_users')->where('id', $values['owner_id'])->value('name'));
        }
    }

    private function differs(mixed $next, mixed $previous): bool
    {
        if (is_numeric($next) && is_numeric($previous)) {
            return (float) $next !== (float) $previous;
        }

        return (string) $next !== (string) $previous;
    }

    private function client(string $code, User $actor): object
    {
        $client = DB::table('crm_clients')->where('code', $code)->whereNull('deleted_at')->first(['id', 'code', 'owner_id']) ?? throw ApiException::unprocessable('CRM-BR-20', 'Elige un cliente de la lista.');

        if (Portfolio::ownOnly($actor) && $client->owner_id !== $actor->getKey()) {
            throw ApiException::forbidden('CRM-BR-21', 'Solo puedes crear oportunidades para clientes de tu cartera.');
        }

        return $client;
    }

    private function owner(?string $requested, User $actor): string
    {
        if (Portfolio::ownOnly($actor) || ! $requested) {
            return $actor->getKey();
        }

        if (! $this->advisors->has($requested)) {
            throw ApiException::unprocessable('CRM-BR-31', 'Elige un responsable activo de la lista.');
        }

        return $requested;
    }
}
