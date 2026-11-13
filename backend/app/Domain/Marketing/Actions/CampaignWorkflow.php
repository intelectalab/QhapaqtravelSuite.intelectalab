<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Actions;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Support\ContactBook;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendCampaign;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CampaignWorkflow
{
    public const TEST_ROLES = ['tenant_admin', 'manager', 'sales', 'operations', 'finance', 'accounting'];

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

    public function test(string $code, User $actor, ?string $toUserId = null, ?string $sample = null): string
    {
        $campaign = $this->find($code);
        $recipient = DB::table('iam_users')->where('id', $toUserId ?? $actor->getKey())->where('status', 'activo')->whereNull('deleted_at')->first(['id', 'name', 'email', 'phone']);

        if ($recipient === null || ($toUserId !== null && ! app(Advisors::class)->has($toUserId, self::TEST_ROLES))) {
            throw ValidationException::withMessages(['to_user_id' => 'La prueba solo se envía a una persona activa del equipo interno.']);
        }

        $address = $campaign->channel === 'email' ? $recipient->email : ($recipient->phone ?: null);

        if ($address === null || $address === '') {
            throw ValidationException::withMessages(['to_user_id' => "{$recipient->name} no tiene teléfono registrado para recibir la prueba por WhatsApp."]);
        }

        $subject = null;

        if ($sample !== null) {
            $subject = ($client = DB::table('crm_clients')->whereNull('deleted_at')->where('code', $sample)->value('id')) !== null
                ? ['client', $client]
                : (($lead = DB::table('crm_leads')->whereNull('deleted_at')->where('code', $sample)->value('id')) !== null ? ['lead', $lead] : null);

            if ($subject === null) {
                throw ValidationException::withMessages(['sample' => 'El contacto de ejemplo no existe.']);
            }
        }
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
            'to_user_id' => $recipient->id,
            'to_address' => mb_substr((string) $address, 0, 160),
            'sample_subject_type' => $subject[0] ?? null,
            'sample_subject_id' => $subject[1] ?? null,
            'sent_at' => now(),
            'created_by' => $actor->getKey(),
        ]);
        $this->audit->log('Campaña', $campaign->code, 'envio_prueba', null, trim($address.($sample !== null ? " · ejemplo {$sample}" : '')));

        return (string) $address;
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

        $this->ensurePromotion($campaign->promo_code, $at);

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

    public function send(string $code, User $actor): array
    {
        $campaign = $this->find($code);

        if (! in_array($campaign->status, ['borrador', 'programada'], true)) {
            throw ApiException::conflict('MKT-BR-08', 'La campaña ya se envió o se canceló.');
        }

        $template = DB::table('mkt_templates')->where('id', $campaign->template_id)->first(['channel', 'status']);

        if ($campaign->channel === 'whatsapp' && ($template === null || $template->status !== 'aprobada')) {
            throw ApiException::unprocessable('MKT-BR-03', 'La plantilla de WhatsApp aún no está aprobada por Meta.');
        }

        if (DB::table('mkt_campaign_tests')->where('campaign_id', $campaign->id)->whereNull('invalidated_at')->doesntExist()) {
            throw ApiException::unprocessable('MKT-BR-04', 'Antes de enviar, envía una prueba con el contenido actual.');
        }

        $this->ensurePromotion($campaign->promo_code);
        $segment = DB::table('mkt_segments')->where('id', $campaign->segment_id)->first(['match', 'rules']) ?? throw ApiException::unprocessable('MKT-BR-07', 'La campaña no tiene segmento.');
        $split = $this->contacts->split($segment->match, json_decode((string) $segment->rules, true) ?: [], $campaign->channel, $this->fatigued($campaign->id));

        if ($split['eligible'] === []) {
            throw ApiException::unprocessable('MKT-BR-07', 'El segmento no tiene destinatarios con consentimiento para este canal.');
        }

        $snapshot = ['matched' => $split['matched'], 'eligible' => count($split['eligible']), ...array_map('count', $split['suppressed']), 'at' => now()->toIso8601String()];

        DB::transaction(function () use ($campaign, $split, $snapshot, $actor): void {
            $now = now();
            DB::table('mkt_campaign_recipients')->insert(array_map(fn (array $contact): array => [
                'id' => (string) Str::uuid7(),
                'campaign_id' => $campaign->id,
                'subject_type' => $contact['type'],
                'subject_id' => $contact['id'],
                'address' => mb_substr((string) $contact['to'], 0, 160),
                'status' => 'pendiente',
                'created_by' => $actor->getKey(),
                'created_at' => $now,
                'updated_at' => $now,
            ], $split['eligible']));

            $suppressions = [];
            foreach ($split['suppressed'] as $reason => $contacts) {
                foreach ($contacts as $contact) {
                    $suppressions[] = ['id' => (string) Str::uuid7(), 'campaign_id' => $campaign->id, 'subject_type' => $contact['type'], 'subject_id' => $contact['id'], 'reason' => $reason, 'created_by' => $actor->getKey(), 'created_at' => $now];
                }
            }

            if ($suppressions !== []) {
                DB::table('mkt_campaign_suppressions')->insert($suppressions);
            }

            DB::table('mkt_campaigns')->where('id', $campaign->id)->update(['status' => 'enviando', 'sent_at' => $now, 'audience_snapshot' => json_encode($snapshot), 'updated_by' => $actor->getKey(), 'updated_at' => $now]);
            $this->audit->log('Campaña', $campaign->code, 'enviar', $campaign->status, "{$snapshot['eligible']} destinatarios · ".count($suppressions).' suprimidos');
            dispatch((new SendCampaign((string) $campaign->id))->forTenant($this->context->idOrFail()))->afterCommit();
        });

        return $snapshot;
    }

    public function duplicate(string $code, User $actor): string
    {
        $source = $this->find($code);

        return DB::transaction(function () use ($source, $actor): string {
            $copy = $this->codes->next('mkt_campaigns', 'CMP-');
            $source->utm = (string) preg_replace('/utm_campaign=[^&]*/', 'utm_campaign='.Str::lower($copy), (string) $source->utm);
            DB::table('mkt_campaigns')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $copy,
                'name' => Str::limit($source->name, 150, '').' (copia)',
                'channel' => $source->channel,
                'segment_id' => $source->segment_id,
                'template_id' => $source->template_id,
                'subject' => $source->subject,
                'body' => $source->body,
                'promotion_id' => $source->promotion_id,
                'promo_code' => $source->promo_code,
                'utm' => $source->utm,
                'status' => 'borrador',
                'owner_id' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Campaña', $copy, 'duplicar', $source->code, $source->name);

            return $copy;
        });
    }

    private function fatigued(string $except): array
    {
        return DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')
            ->where('c.id', '!=', $except)->whereIn('c.status', ['enviando', 'enviada'])->where('c.sent_at', '>=', now()->subHours(72))
            ->get(['r.subject_type', 'r.subject_id'])->mapWithKeys(fn (object $row): array => ["{$row->subject_type}:{$row->subject_id}" => true])->all();
    }

    private function ensurePromotion(?string $code, ?Carbon $at = null): void
    {
        if ($code === null) {
            return;
        }

        $promotions = DB::table('catalog_product_promotions')->whereNull('deleted_at')->where('promo_code', $code)->get(['status', 'date_from', 'date_to']);

        if ($promotions->isEmpty()) {
            throw ApiException::unprocessable('MKT-BR-09', "El código {$code} no existe en Catálogo. Pide que creen la promoción o quita el código.");
        }

        $day = ($at ?? Carbon::now())->copy()->setTimezone($this->context->timezone())->toDateString();
        $valid = $promotions->contains(fn (object $row): bool => $row->status === 'activa' && $row->date_from <= $day && $row->date_to >= $day);

        if (! $valid) {
            throw ApiException::unprocessable('MKT-BR-09', $at === null
                ? "El código {$code} no está activo o ya venció. Actualiza la promoción o quita el código."
                : "El código {$code} no estará vigente el {$day}. Actualiza la promoción, cambia la fecha o quita el código.");
        }
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
