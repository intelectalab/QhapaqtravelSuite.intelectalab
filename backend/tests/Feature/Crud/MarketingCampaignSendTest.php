<?php

use App\Jobs\DispatchScheduledCampaigns;
use App\Jobs\SendCampaign;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function mktEnvioBorrador(object $test, array $extra = []): string
{
    return $test->postJson('/api/v1/marketing/campaigns', [
        'name' => 'Novedades de diciembre',
        'channel' => 'email',
        'segment' => 'SEG-001',
        'template' => 'TPL-01',
        'subject' => 'Novedades de diciembre',
        'body' => "Hola {{nombre}}:\nTe contamos lo nuevo.\n{{enlace_baja}}",
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function mktEnvioAuditado(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Campaña')->where('entity_id', $code)->where('action', $action)->exists());
}

function mktDestinatarios(string $code): Collection
{
    $id = rowOf('mkt_campaigns', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('campaign_id', $id)->get());
}

it('Enviar ahora pasa la campaña a enviando, congela la audiencia con supresiones y despacha SendCampaign', function () {
    Queue::fake();
    actingAsSeed('U01');
    $code = mktEnvioBorrador($this);
    $this->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();

    $audience = $this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical((int) rowOf('mkt_campaigns', $code)->lock_version))->assertStatus(202)->json('data.audience');

    $campaign = rowOf('mkt_campaigns', $code);
    $recipients = mktDestinatarios($code);
    expect($campaign->status)->toBe('enviando')
        ->and($campaign->sent_at)->not->toBeNull()
        ->and(json_decode($campaign->audience_snapshot, true)['eligible'])->toBe($audience['eligible'])
        ->and($recipients)->toHaveCount($audience['eligible'])
        ->and($recipients->pluck('status')->unique()->all())->toBe(['pendiente'])
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_campaign_suppressions')->where('campaign_id', $campaign->id)->count()))->toBe($audience['matched'] - $audience['eligible'])
        ->and(mktEnvioAuditado($code, 'enviar'))->toBeTrue();
    Queue::assertPushed(SendCampaign::class, fn (SendCampaign $job) => $job->campaignId === $campaign->id && $job->tenantId === tenantA()->getKey());

    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical((int) rowOf('mkt_campaigns', $code)->lock_version)))->toBeApiError(409, 'MKT-BR-08');
});

it('el job envía por el adaptador, suprime a quien se dio de baja antes del envío y cierra la campaña', function () {
    Queue::fake();
    actingAsSeed('U01');
    $code = mktEnvioBorrador($this);
    $this->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();
    $this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical((int) rowOf('mkt_campaigns', $code)->lock_version))->assertStatus(202);
    $first = mktDestinatarios($code)->first();
    withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('subject_type', $first->subject_type)->where('subject_id', $first->subject_id)->where('channel', 'email')->update(['status' => 'revocado', 'revoked_at' => now(), 'revoke_source' => 'Enlace de baja']));
    $total = mktDestinatarios($code)->count();

    withinTenant(tenantA(), fn () => app()->call([new SendCampaign((string) rowOf('mkt_campaigns', $code)->id), 'handle']));

    $campaign = rowOf('mkt_campaigns', $code);
    $recipients = mktDestinatarios($code);
    expect($campaign->status)->toBe('enviada')
        ->and($campaign->completed_at)->not->toBeNull()
        ->and($recipients)->toHaveCount($total - 1)
        ->and($recipients->pluck('status')->unique()->all())->toBe(['enviado'])
        ->and($recipients->pluck('provider_message_id')->filter()->count())->toBe($total - 1)
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_campaign_suppressions')->where('campaign_id', $campaign->id)->where('subject_id', $first->subject_id)->value('reason')))->toBe('optout')
        ->and(mktEnvioAuditado($code, 'envio_completado'))->toBeTrue();
});

it('Enviar ahora exige prueba previa, plantilla aprobada, versión vigente e Idempotency-Key', function () {
    Queue::fake();
    actingAsSeed('U01');
    $code = mktEnvioBorrador($this);
    $version = (int) rowOf('mkt_campaigns', $code)->lock_version;

    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical($version)))->toBeApiError(422, 'MKT-BR-04');
    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], ['Accept' => 'application/json', 'If-Match' => (string) $version]))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    expect($this->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical($version + 5)))->toBeApiError(409, 'STALE_VERSION');

    $whatsapp = mktEnvioBorrador($this, ['channel' => 'whatsapp', 'segment' => 'SEG-002', 'template' => 'TPL-05', 'subject' => null]);
    expect($this->postJson("/api/v1/marketing/campaigns/{$whatsapp}/send", [], critical((int) rowOf('mkt_campaigns', $whatsapp)->lock_version)))->toBeApiError(422, 'MKT-BR-03');
    Queue::assertNotPushed(SendCampaign::class);
});

it('duplicar copia la campaña en borrador sin pruebas ni destinatarios', function () {
    actingAsSeed('U01');
    $sent = (string) withinTenant(tenantA(), fn () => DB::table('mkt_campaigns')->where('status', 'enviada')->orderBy('code')->value('code'));

    $copy = $this->postJson("/api/v1/marketing/campaigns/{$sent}/duplicate")->assertCreated()->json('data.code');

    $row = rowOf('mkt_campaigns', $copy);
    expect($row->status)->toBe('borrador')
        ->and($row->segment_id)->toBe(rowOf('mkt_campaigns', $sent)->segment_id)
        ->and($row->name)->toEndWith('(copia)')
        ->and($row->utm)->toContain('utm_campaign='.strtolower($copy))
        ->and($row->sent_at)->toBeNull()
        ->and(mktDestinatarios($copy))->toHaveCount(0)
        ->and(mktEnvioAuditado($copy, 'duplicar'))->toBeTrue();
});

it('Ventas no envía ni duplica campañas', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/send', [], critical(0)))->toBeApiError(403);
    expect($this->postJson('/api/v1/marketing/campaigns/CMP-0012/duplicate'))->toBeApiError(403);
});

it('el proceso programado envía la campaña cuya hora ya llegó y deja las futuras programadas', function () {
    lockScheduledJobs();
    lockScheduledCampaigns();
    Queue::fake([SendCampaign::class]);
    actingAsSeed('U01');
    $due = mktEnvioBorrador($this);
    $later = mktEnvioBorrador($this, ['name' => 'Para la próxima semana']);
    foreach ([$due, $later] as $code) {
        $this->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();
        $this->postJson("/api/v1/marketing/campaigns/{$code}/schedule", ['scheduled_at' => now()->addDays(2)->setTime(10, 0)->toIso8601String()], critical((int) rowOf('mkt_campaigns', $code)->lock_version))->assertSuccessful();
    }
    withinTenant(tenantA(), function () use ($due): void {
        DB::table('mkt_campaigns')->where('status', 'programada')->where('code', '<>', $due)->where('scheduled_at', '<=', now())->update(['scheduled_at' => now()->addDays(3)]);
        DB::table('mkt_campaigns')->where('code', $due)->update(['scheduled_at' => now()->subMinute()]);
    });

    dispatch_sync((new DispatchScheduledCampaigns)->forTenant((string) tenantA()->getKey()));

    $campaign = rowOf('mkt_campaigns', $due);
    expect($campaign->status)->toBe('enviando')
        ->and(mktDestinatarios($due))->not->toBeEmpty()
        ->and(mktEnvioAuditado($due, 'enviar'))->toBeTrue()
        ->and(rowOf('mkt_campaigns', $later)->status)->toBe('programada');
    Queue::assertPushed(SendCampaign::class, fn (SendCampaign $job) => $job->campaignId === $campaign->id);
});
