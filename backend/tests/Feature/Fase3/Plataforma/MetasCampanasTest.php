<?php

use App\Domain\Site\Actions\NewsletterLifecycle;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/PlataformaHelpers.php';

function p3Recipient(string $campaign): object
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')
        ->join('mkt_consents as k', fn ($join) => $join->on('k.subject_id', '=', 'r.subject_id')->on('k.subject_type', '=', 'r.subject_type')->where('k.channel', 'email')->where('k.status', 'otorgado'))
        ->where('c.code', $campaign)->whereNull('r.unsubscribed_at')->orderBy('r.address')->first(['r.*', 'k.code as consent']));
}

it('el ranking del período muestra montos solo a quien gestiona metas', function () {
    actingAsSeed('U01');
    $ranking = $this->getJson('/api/v1/crm/sales-targets/ranking')->assertOk()->json('data');
    expect($ranking['period'])->toBe('2026-09')->and($ranking['items'])->not->toBeEmpty()->and($ranking['items'][0]['sales'])->not->toBeNull();

    $other = collect($ranking['periods'])->pluck('value')->first(fn (string $key) => $key !== $ranking['period']);
    $expected = (int) withinTenant(tenantA(), fn () => DB::table('crm_sales_targets')->where('scope_type', 'asesor')->where('period_key', $other)->whereIn('status', ['vigente', 'cerrada'])->count());
    $chosen = $this->getJson("/api/v1/crm/sales-targets/ranking?period={$other}")->assertOk()->json('data');
    expect($chosen['period'])->toBe($other)->and(count($chosen['items']))->toBe($expected)->and($expected)->toBeGreaterThan(0);
    expect($this->getJson('/api/v1/crm/sales-targets/ranking?period=noviembre'))->toBeApiError(422, 'VALIDATION_ERROR');

    actingAsSeed('U03');
    $mine = $this->getJson('/api/v1/crm/sales-targets/ranking')->assertOk()->json('data');
    expect(collect($mine['items'])->pluck('sales')->filter()->all())->toBe([])->and($mine['amounts'])->toBeFalse();
});

it('ajusta una meta vigente con motivo e If-Match y deja el historial', function () {
    actingAsSeed('U01');
    $target = p3Row('crm_sales_targets', ['code' => 'MET-0005']);
    $payload = ['goal_sales' => (float) $target->goal_sales_pen + 5000, 'bonus_amount' => 600, 'reason' => 'Se suma la cartera del asesor que salió de vacaciones'];

    $this->postJson('/api/v1/crm/sales-targets/MET-0005/adjust', $payload)->assertStatus(428);
    $this->postJson('/api/v1/crm/sales-targets/MET-0005/adjust', $payload, critical((int) $target->lock_version))->assertOk();

    expect((float) p3Row('crm_sales_targets', ['code' => 'MET-0005'])->goal_sales_pen)->toBe((float) $target->goal_sales_pen + 5000)
        ->and(p3Row('crm_sales_target_adjustments', ['target_id' => $target->id, 'action' => 'ajustar']))->not->toBeNull();
    $this->postJson('/api/v1/crm/sales-targets/MET-0005/adjust', $payload, critical((int) $target->lock_version))->assertStatus(409);

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/crm/sales-targets/MET-0005/adjust', $payload, critical(0)))->toBeApiError(403);
});

it('administra los equipos comerciales y protege los que tienen metas', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/crm/sales-teams')->assertOk()->json('data');
    $advisors = collect($data['advisors'])->pluck('value');
    $teams = collect($data['teams'])->map(fn (array $team): array => ['code' => $team['code'], 'name' => $team['name'], 'leader_id' => $team['leader']['id'] ?? null, 'members' => collect($team['members'])->pluck('id')->all()])->all();
    $taken = collect($teams)->flatMap(fn (array $team) => $team['members']);
    $free = $advisors->reject(fn (string $id) => $taken->contains($id))->first() ?? $advisors->first();
    $teams = collect($teams)->map(fn (array $team) => [...$team, 'members' => array_values(array_diff($team['members'], [$free]))])->all();

    $saved = $this->putJson('/api/v1/crm/sales-teams', ['teams' => [...$teams, ['name' => 'Agencias aliadas del sur', 'leader_id' => $free, 'members' => [$free]]]])->assertOk()->json('data');
    $new = collect($saved['teams'])->firstWhere('name', 'Agencias aliadas del sur');
    expect($new['code'])->toStartWith('EQ-')->and(collect($new['members'])->pluck('id')->all())->toBe([$free]);

    $withTargets = collect($teams)->first(fn (array $team) => p3Row('crm_sales_targets', ['scope_type' => 'equipo', 'scope_id' => p3Row('crm_sales_teams', ['code' => $team['code']])->id]) !== null);
    $without = collect($saved['teams'])->reject(fn (array $team) => $team['code'] === $withTargets['code'])->map(fn (array $team) => ['code' => $team['code'], 'name' => $team['name'], 'members' => collect($team['members'])->pluck('id')->all()])->values()->all();
    expect($this->putJson('/api/v1/crm/sales-teams', ['teams' => $without]))->toBeApiError(409, 'MET-TEAM-IN-USE');

    $this->putJson('/api/v1/crm/sales-teams', ['teams' => [...$teams, ['name' => 'Duplicado', 'members' => [$free, $free]]]])->assertUnprocessable();
    expect(p3Audited(['entity' => 'Equipo comercial', 'entity_id' => $new['code'], 'action' => 'crear']))->toBeTrue();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/crm/sales-teams'))->toBeApiError(403);
});

it('la política de bonos la define solo la administración y valida los tramos', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/crm/sales-target-policy')->assertOk()->json('data.tiers'))->not->toBeEmpty();

    $saved = $this->putJson('/api/v1/crm/sales-target-policy', ['tiers' => [['min' => 85, 'pay' => 40], ['min' => 100, 'pay' => 100], ['min' => 115, 'pay' => 125]], 'lock_decrease_after_pct' => 40])->assertOk()->json('data');
    expect($saved['tiers'][0])->toBe(['min' => 85, 'pay' => 40])->and($saved['lock_decrease_after_pct'])->toBe(40);
    expect($this->putJson('/api/v1/crm/sales-target-policy', ['tiers' => [['min' => 90, 'pay' => 80], ['min' => 110, 'pay' => 50]]]))->toBeApiError(422, 'MET-BR-08');
    expect(p3Audited(['entity' => 'Política de metas', 'action' => 'editar']))->toBeTrue();

    actingAsSeed('U02');
    $denied = $this->putJson('/api/v1/crm/sales-target-policy', ['tiers' => [['min' => 100, 'pay' => 100]]]);
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('admin.settings.manage');
});

it('muestra la campaña con su audiencia congelada, sus destinatarios y permite la baja manual', function () {
    actingAsSeed('U01');
    $detail = $this->getJson('/api/v1/marketing/campaigns/CMP-0008')->assertOk()->json('data');
    expect($detail['code'])->toBe('CMP-0008')->and($detail['recipient_statuses'])->not->toBeEmpty()->and($detail['history'])->toBeArray();

    $audience = $this->getJson('/api/v1/marketing/campaigns/CMP-0008/audience')->assertOk()->json('data');
    expect($audience['snapshot'])->toBeTrue()->and($audience['summary']['eligible'])->toBeGreaterThan(0);

    $page = $this->getJson('/api/v1/marketing/campaigns/CMP-0008/recipients?page[size]=5')->assertOk()->json();
    expect(count($page['data']))->toBe(5)->and($page['meta']['next_cursor'])->not->toBeNull();
    expect($this->getJson('/api/v1/marketing/campaigns/CMP-0008/recipients?filter[status]=perdido'))->toBeApiError(422, 'FILTER_INVALID');

    $recipient = p3Recipient('CMP-0008');
    $done = $this->postJson("/api/v1/marketing/campaigns/CMP-0008/recipients/{$recipient->id}/unsubscribe")->assertOk()->json('data');
    expect($done['unsubscribed_at'])->not->toBeNull()
        ->and(p3Row('mkt_consents', ['code' => $recipient->consent])->status)->toBe('revocado');
    $this->postJson("/api/v1/marketing/campaigns/CMP-0008/recipients/{$recipient->id}/unsubscribe")->assertOk();
    $this->postJson('/api/v1/marketing/campaigns/CMP-0008/recipients/'.str_repeat('0', 8).'-0000-0000-0000-000000000000/unsubscribe')->assertNotFound();
    expect($this->getJson('/api/v1/marketing/campaigns/CMP-0008/recipients?filter[status]=baja')->json('data.0.id'))->toBe($recipient->id);
});

it('estima la audiencia de un borrador y lo reemplaza con If-Match', function () {
    actingAsSeed('U01');
    $audience = $this->getJson('/api/v1/marketing/campaigns/CMP-0012/audience?at=2026-09-30T10:00:00-05:00')->assertOk()->json('data');
    expect($audience['snapshot'])->toBeFalse()->and($audience['summary']['reasons'])->not->toBeEmpty();

    $campaign = withinTenant(tenantA(), fn () => DB::table('mkt_campaigns as c')->join('mkt_segments as s', 's.id', '=', 'c.segment_id')->join('mkt_templates as t', 't.id', '=', 'c.template_id')
        ->where('c.code', 'CMP-0012')->first(['c.*', 's.code as segment', 't.code as template']));
    $payload = ['name' => 'Boletín de temporada baja', 'channel' => 'email', 'segment' => $campaign->segment, 'template' => $campaign->template, 'subject' => 'Viaja en temporada baja', 'body' => "Hola {{nombre}}, tenemos tarifas especiales.\n\n{{enlace_baja}}"];

    $this->putJson('/api/v1/marketing/campaigns/CMP-0012', $payload)->assertStatus(428);
    $this->putJson('/api/v1/marketing/campaigns/CMP-0012', $payload, critical((int) $campaign->lock_version))->assertOk();
    expect(p3Row('mkt_campaigns', ['code' => 'CMP-0012'])->name)->toBe('Boletín de temporada baja');
    $this->getJson('/api/v1/marketing/campaigns/CMP-9999')->assertNotFound();
});

it('la página pública de baja describe el enlace firmado y registra la baja', function () {
    $recipient = p3Recipient('CMP-0009');
    $token = NewsletterLifecycle::campaignToken((string) $recipient->id);

    $shown = $this->getJson("/api/v1/public/unsubscribe/{$token}", siteOf())->assertOk()->json('data');
    expect($shown['status'])->toBe('suscrito')->and($shown['email'])->toContain('•')->and($shown['email'])->not->toBe($recipient->address);

    $done = $this->postJson("/api/v1/public/unsubscribe/{$token}", [], siteOf())->assertOk()->json('data');
    expect($done['status'])->toBe('baja')
        ->and(p3Row('mkt_consents', ['code' => $recipient->consent])->status)->toBe('revocado')
        ->and(p3Row('mkt_campaign_recipients', ['id' => $recipient->id])->unsubscribed_at)->not->toBeNull();
    expect($this->getJson("/api/v1/public/unsubscribe/{$token}", siteOf())->json('data.status'))->toBe('baja');

    $this->getJson('/api/v1/public/unsubscribe/c'.$recipient->id.'.firma-falsa', siteOf())->assertNotFound();
});
