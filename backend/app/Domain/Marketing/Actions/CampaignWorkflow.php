<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CampaignWorkflow
{
    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly ContactBook $contacts,
        private readonly TenantContext $context,
    ) {}

    public function create(array $data, User $actor): string
    {
        [$segment, $template] = $this->references($data);

        return DB::transaction(function () use ($data, $actor, $segment, $template): string {
            $code = $this->codes->next('mkt_campaigns', 'CMP-');
            DB::table('mkt_campaigns')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                ...$this->content($data, $segment, $template, $code),
                'status' => 'borrador',
                'owner_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Campaña', $code, 'crear', null, $data['name']);

            return $code;
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $campaign = $this->find($code);

        if ($campaign->status !== 'borrador') {
            throw ApiException::conflict('MKT-BR-08', 'Solo se editan campañas en borrador. Si está programada, desprográmala primero.');
        }

        [$segment, $template] = $this->references($data);
        DB::transaction(function () use ($campaign, $data, $actor, $segment, $template): void {
            DB::table('mkt_campaigns')->where('id', $campaign->id)->update([...$this->content($data, $segment, $template, $campaign->code), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            DB::table('mkt_campaign_tests')->where('campaign_id', $campaign->id)->whereNull('invalidated_at')->update(['invalidated_at' => now()]);
            $this->audit->log('Campaña', $campaign->code, 'editar', $campaign->name, $data['name']);
        });
    }

    public function test(string $code, User $actor): void
    {
        $campaign = $this->find($code);
        $template = DB::table('mkt_templates')->where('id', $campaign->template_id)->first(['channel', 'status']);

        if (! in_array($campaign->status, ['borrador', 'programada'], true)) {
            throw ApiException::conflict('MKT-BR-08', 'La campaña ya se envió o se canceló.');
        }

        if ($template && $template->channel === 'whatsapp' && $template->status !== 'aprobada') {
            throw ApiException::unprocessable('MKT-BR-03', 'La plantilla de WhatsApp aún no está aprobada por Meta.');
        }

        DB::table('mkt_campaign_tests')->insert([
            'id' => (string) Str::uuid7(),
            'campaign_id' => $campaign->id,
            'to_user_id' => $actor->getKey(),
            'to_address' => $campaign->channel === 'email' ? $actor->email : ($actor->phone ?? $actor->email),
            'sent_at' => now(),
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Campaña', $campaign->code, 'envio_prueba', null, $actor->email);
    }

    public function schedule(string $code, string $when, User $actor): void
    {
        $campaign = $this->find($code);
        $at = Carbon::parse($when, $this->context->timezone());

        if ($campaign->status !== 'borrador') {
            throw ApiException::conflict('MKT-BR-08', 'Solo se programan campañas en borrador.');
        }

        if ($at->lt(Carbon::now()->addMinutes(15))) {
            throw ApiException::unprocessable('MKT-BR-05', 'Programa el envío con al menos 15 minutos de anticipación.');
        }

        if ($campaign->channel === 'whatsapp' && ($at->hour < 8 || $at->hour >= 20)) {
            throw ApiException::unprocessable('MKT-BR-05', 'Por WhatsApp solo se envían promociones entre las 08:00 y las 20:00.');
        }

        if (DB::table('mkt_campaign_tests')->where('campaign_id', $campaign->id)->whereNull('invalidated_at')->doesntExist()) {
            throw ApiException::unprocessable('MKT-BR-04', 'Antes de programar, envía una prueba con el contenido actual.');
        }

        $segment = DB::table('mkt_segments')->where('id', $campaign->segment_id)->first(['match', 'rules']);
        $audience = $segment ? $this->contacts->audience($segment->match, json_decode((string) $segment->rules, true) ?: [], $campaign->channel) : ['eligible' => 0];

        if ($audience['eligible'] === 0) {
            throw ApiException::unprocessable('MKT-BR-07', 'El segmento no tiene destinatarios con consentimiento para este canal.');
        }

        DB::table('mkt_campaigns')->where('id', $campaign->id)->update(['status' => 'programada', 'scheduled_at' => $at->utc(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Campaña', $campaign->code, 'programar', 'borrador', $at->format('Y-m-d H:i')." · {$audience['eligible']} destinatarios");
    }

    public function unschedule(string $code, User $actor): void
    {
        $campaign = $this->find($code);

        if ($campaign->status !== 'programada') {
            throw ApiException::conflict('MKT-BR-08', 'La campaña no está programada.');
        }

        DB::table('mkt_campaigns')->where('id', $campaign->id)->update(['status' => 'borrador', 'scheduled_at' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Campaña', $campaign->code, 'desprogramar', 'programada', 'borrador');
    }

    public function cancel(string $code, string $reason, User $actor): void
    {
        $campaign = $this->find($code);

        if (! in_array($campaign->status, ['borrador', 'programada'], true)) {
            throw ApiException::conflict('MKT-BR-08', 'Las campañas enviadas no se cancelan.');
        }

        DB::table('mkt_campaigns')->where('id', $campaign->id)->update(['status' => 'cancelada', 'cancel_reason' => $reason, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Campaña', $campaign->code, 'cancelar', $campaign->status, "cancelada · {$reason}");
    }

    private function references(array $data): array
    {
        $segment = DB::table('mkt_segments')->whereNull('deleted_at')->where('code', $data['segment'])->first(['id']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige un segmento.');
        $template = DB::table('mkt_templates')->where('code', $data['template'])->first(['id', 'channel', 'status', 'body', 'subject']) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una plantilla.');

        if ($template->channel !== $data['channel']) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La plantilla no corresponde al canal elegido.');
        }

        if ($data['channel'] === 'email' && ! str_contains((string) ($data['body'] ?? $template->body), '{{enlace_baja}}')) {
            throw ApiException::unprocessable('MKT-BR-02', 'El correo debe incluir {{enlace_baja}} para que el contacto pueda darse de baja.');
        }

        return [$segment, $template];
    }

    private function content(array $data, object $segment, object $template, string $code): array
    {
        $whatsapp = $data['channel'] === 'whatsapp';
        $source = $whatsapp ? 'whatsapp' : 'newsletter';

        return [
            'name' => $data['name'],
            'channel' => $data['channel'],
            'segment_id' => $segment->id,
            'template_id' => $template->id,
            'subject' => $whatsapp ? null : ($data['subject'] ?? $template->subject),
            'body' => $whatsapp ? $template->body : ($data['body'] ?? $template->body),
            'promo_code' => isset($data['promo_code']) ? Str::upper($data['promo_code']) : null,
            'utm' => "utm_source={$source}&utm_medium={$data['channel']}&utm_campaign=".Str::lower($code),
        ];
    }

    private function find(string $code): object
    {
        return DB::table('mkt_campaigns')->where('code', $code)->first() ?? throw ApiException::notFound('La campaña no existe.');
    }
}
