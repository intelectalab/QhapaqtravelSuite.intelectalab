<?php

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function crmNotices(string $event, ?string $sourceId = null): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)->when($sourceId, fn ($query) => $query->where('source_id', $sourceId))->get(['recipient_user_id', 'recipient_address', 'channel']));
}

it('asignar un lead avisa al asesor (01 §8.3)', function () {
    Queue::fake();
    actingAsSeed('U02');
    $lead = withinTenant(tenantA(), fn () => DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado'])->where(fn ($q) => $q->whereNull('owner_id')->orWhere('owner_id', '<>', seedUser('U03')->id))->first(['id', 'code', 'lock_version']));

    $this->postJson("/api/v1/crm/leads/{$lead->code}/assign", ['owner_id' => seedUser('U03')->id], critical((int) $lead->lock_version))->assertOk();

    expect(crmNotices('lead.asignado', $lead->id)->pluck('recipient_user_id')->map(fn ($id) => (string) $id)->all())->toBe([(string) seedUser('U03')->id]);
});

it('un detractor de NPS avisa al responsable por la campana y por correo (CRM-BR-39)', function () {
    Queue::fake();
    actingAsSeed('U02');

    $this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0002', 'reservation' => 'RES-2026-000348', 'score' => 3, 'channel' => 'llamada', 'comment' => 'El hotel no tenía agua caliente'], critical())->assertCreated();

    $owner = (string) rowOf('crm_clients', 'CLI-0002')->owner_id;
    $sent = crmNotices('nps.detractor');
    expect($sent->where('channel', 'portal')->pluck('recipient_user_id')->map(fn ($id) => (string) $id)->all())->toContain($owner)
        ->and($sent->where('channel', 'email')->pluck('recipient_address')->all())->toContain(withinTenant(tenantA(), fn () => DB::table('iam_users')->where('id', $owner)->value('email')));
});
