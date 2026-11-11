<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\AutomationDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Outbox\OutboxWriter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AutomationWorkflow
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly AutomationDirectory $directory,
        private readonly OutboxWriter $outbox,
    ) {}

    public function configure(string $code, array $data, User $actor): void
    {
        $automation = $this->find($code);
        $template = DB::table('mkt_templates')->where('code', $data['template'])->first(['id', 'code', 'name', 'channel', 'status'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una plantilla.');

        if ($template->channel !== $automation->channel) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La plantilla no corresponde al canal de la automatización.');
        }

        if ($automation->status === 'activa' && $this->blockedTemplate($template)) {
            throw ApiException::unprocessable('MKT-BR-03', 'Una automatización activa no puede usar una plantilla de WhatsApp sin aprobación de Meta.');
        }

        $before = DB::table('mkt_templates')->where('id', $automation->template_id)->value('code').' · '.$automation->delay_desc;
        DB::table('mkt_automations')->where('id', $automation->id)->update(['template_id' => $template->id, 'delay_desc' => $data['delay'], 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Automatización', $automation->code, 'configurar', $before, "{$template->code} · {$data['delay']}");
    }

    public function activate(string $code, User $actor): void
    {
        $automation = $this->find($code);

        if ($automation->status === 'activa') {
            throw ApiException::conflict('MKT-AUT-STATE', 'La automatización ya está activa.');
        }

        $template = DB::table('mkt_templates')->where('id', $automation->template_id)->first(['channel', 'status']);

        if ($template && $this->blockedTemplate($template)) {
            throw ApiException::unprocessable('MKT-BR-03', 'La plantilla de WhatsApp de esta automatización aún no está aprobada por Meta.');
        }

        $this->status($automation, 'activa', 'activar', $actor);
    }

    public function pause(string $code, User $actor): void
    {
        $automation = $this->find($code);

        if ($automation->status === 'pausada') {
            throw ApiException::conflict('MKT-AUT-STATE', 'La automatización ya está pausada.');
        }

        $this->status($automation, 'pausada', 'pausar', $actor);
    }

    public function run(string $code, User $actor): array
    {
        return DB::transaction(function () use ($code, $actor): array {
            $automation = DB::table('mkt_automations')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('La automatización no existe.');

            if ($automation->status !== 'activa') {
                throw ApiException::conflict('MKT-AUT-STATE', 'Activa la automatización para ejecutarla.');
            }

            $queue = $this->directory->queue($automation);

            if ($queue->isEmpty()) {
                throw ApiException::unprocessable('MKT-AUT-EMPTY', 'No hay contactos en cola para esta automatización.');
            }

            $sent = $queue->whereNull('block');
            $suppressed = $queue->whereNotNull('block');
            $template = DB::table('mkt_templates')->where('id', $automation->template_id)->value('code');
            $runId = (string) Str::uuid7();

            DB::table('mkt_automation_runs')->insert([
                'id' => $runId,
                'automation_id' => $automation->id,
                'started_at' => now(),
                'finished_at' => now(),
                'queued' => $queue->count(),
                'sent' => $sent->count(),
                'suppressed' => $suppressed->count(),
                'triggered_by' => $actor->getKey(),
            ]);
            DB::table('mkt_automation_enrollments')->insert($queue->map(fn (array $item): array => [
                'id' => (string) Str::uuid7(),
                'automation_id' => $automation->id,
                'subject_type' => $item['contact']['type'],
                'subject_id' => $item['contact']['id'],
                'ref_type' => $item['ref_type'],
                'ref_id' => $item['ref_id'],
                'status' => $item['block'] === null ? 'enviado' : 'suprimido',
                'reason' => $item['block'],
                'processed_at' => now(),
            ])->all());
            DB::table('mkt_automations')->where('id', $automation->id)->update([
                'sent_total' => DB::raw('sent_total + '.$sent->count()),
                'suppressed_total' => DB::raw('suppressed_total + '.$suppressed->count()),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);

            if ($sent->isNotEmpty()) {
                $address = $automation->channel === 'email' ? 'email' : 'mobile';
                $this->outbox->add('mkt_automation_run', $runId, 'marketing.automation.messages', [
                    'automation' => $automation->code,
                    'channel' => $automation->channel,
                    'template' => $template,
                    'recipients' => $sent->map(fn (array $item): array => ['subject_type' => $item['contact']['type'], 'subject_id' => $item['contact']['id'], 'address' => $item['contact'][$address], 'ref_type' => $item['ref_type'], 'ref_id' => $item['ref_id']])->values()->all(),
                ]);
            }

            $this->audit->log('Automatización', $automation->code, 'ejecutar', "{$queue->count()} en cola", "{$sent->count()} enviados · {$suppressed->count()} suprimidos");

            return ['queued' => $queue->count(), 'sent' => $sent->count(), 'suppressed' => $suppressed->count()];
        });
    }

    private function status(object $automation, string $status, string $action, User $actor): void
    {
        DB::table('mkt_automations')->where('id', $automation->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Automatización', $automation->code, $action, $automation->status, $status);
    }

    private function blockedTemplate(object $template): bool
    {
        return $template->channel === 'whatsapp' && $template->status !== 'aprobada';
    }

    private function find(string $code): object
    {
        return DB::table('mkt_automations')->where('code', $code)->first() ?? throw ApiException::notFound('La automatización no existe.');
    }
}
