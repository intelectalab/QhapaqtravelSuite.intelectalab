<?php

declare(strict_types=1);

namespace App\Domain\Crm\Actions;

use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\OpportunityDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OpportunityWorkflow
{
    public function __construct(
        private readonly OpportunityDirectory $directory,
        private readonly CrmCatalog $catalog,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {
    }

    public function changeStage(string $code, array $data, User $actor): array
    {
        $opportunity = $this->directory->scoped($actor)->where('o.code', $code)->first(['o.*'])
            ?? throw ApiException::notFound('La oportunidad no existe.');
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
}
