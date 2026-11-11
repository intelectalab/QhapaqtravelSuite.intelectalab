<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\CampaignWorkflow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class DispatchScheduledCampaigns extends TenantJob
{
    public const QUEUE = 'default';

    protected function run(): string
    {
        $due = DB::table('mkt_campaigns')->where('status', 'programada')->whereNotNull('scheduled_at')->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')->get(['id', 'code', 'owner_id', 'created_by']);

        if ($due->isEmpty()) {
            return 'Sin campañas por enviar';
        }

        $workflow = app(CampaignWorkflow::class);
        $sent = 0;
        $returned = [];

        foreach ($due as $campaign) {
            $actor = User::query()->find($campaign->owner_id) ?? User::query()->find($campaign->created_by);

            if ($actor === null) {
                $returned[] = $this->returnToDraft($campaign, 'sin responsable activo');

                continue;
            }

            try {
                $workflow->send($campaign->code, $actor);
                $sent++;
            } catch (ApiException $error) {
                $returned[] = $this->returnToDraft($campaign, $error->getMessage());
            }
        }

        $summary = self::plural($sent, 'campaña enviada', 'campañas enviadas');

        return $returned === [] ? $summary : $this->warn($summary.' · '.self::plural(count($returned), 'volvió a borrador', 'volvieron a borrador').': '.implode(', ', $returned));
    }

    private function returnToDraft(object $campaign, string $reason): string
    {
        $updated = DB::table('mkt_campaigns')->where('id', $campaign->id)->where('status', 'programada')->update(['status' => 'borrador', 'updated_at' => now()]);

        if ($updated > 0) {
            app(AuditLogger::class)->log('Campaña', $campaign->code, 'desprogramar', 'programada', "borrador · no se pudo enviar: {$reason}");
        }

        return $campaign->code;
    }
}
