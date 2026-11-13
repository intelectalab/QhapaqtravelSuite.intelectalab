<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

if (! function_exists('vitrinaTenantAudit')) {
    function vitrinaTenantAudit(array $where): bool
    {
        return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function vitrinaStory(string $slug): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('cms_travel_stories')->where('slug', $slug)->first());
}

function vitrinaNewStory(): array
{
    actingAsSeed('U02');
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', idOf('crm_clients', 'CLI-0001'))->whereNull('deleted_at')->value('code'));

    return test()->postJson('/api/v1/cms/stories', ['reservation' => $reservation, 'title' => 'Gabriela y el cañón del Colca', 'city' => 'Arequipa', 'quote' => 'Ver volar al cóndor fue inolvidable.', 'photo_count' => 3])->assertCreated()->json('data');
}

it('lista las historias con su consentimiento y opciones para crear', function () {
    actingAsSeed('U02');
    $data = $this->getJson('/api/v1/cms/stories')->assertOk()->json('data');

    expect(collect($data['items'])->firstWhere('slug', 'familia-rios-peru-clasico')['consent']['valid'])->toBeTrue()
        ->and($data['can_publish'])->toBeTrue()
        ->and($data['options']['reservations'])->not->toBeEmpty();
});

it('VT-12: no se publica sin consentimiento; el cliente lo da desde su portal y luego se publica', function () {
    $story = vitrinaNewStory();

    expect($this->postJson("/api/v1/cms/stories/{$story['id']}/publish"))->toBeApiError(422, 'VT-12');

    $this->postJson("/api/v1/cms/stories/{$story['id']}/consent-request")->assertOk()->assertJsonPath('data.status', 'pendiente_consentimiento');
    expect(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('source_id', $story['id'])->where('event_code', 'aventura.consentimiento')->exists()))->toBeTrue();

    actingAsSeed('U14');
    $this->postJson("/api/v1/portal/client/stories/{$story['id']}/consent", ['granted' => true, 'name_mode' => 'solo_nombre', 'photos' => true])->assertOk()->assertJsonPath('data.consent', 'otorgado');

    actingAsSeed('U02');
    $this->postJson("/api/v1/cms/stories/{$story['id']}/publish")->assertOk()->assertJsonPath('data.status', 'publicado');
    expect(vitrinaTenantAudit(['entity' => 'Aventura', 'entity_id' => $story['slug'], 'action' => 'publicar']))->toBeTrue();

    $public = collect($this->withHeaders(siteOf())->getJson('/api/v1/public/stories')->assertOk()->json('data'))->firstWhere('slug', $story['slug']);
    expect($public['traveler'])->toBe('Gabriela');
});

it('VT-12: si el cliente retira el consentimiento la historia se despublica en el momento', function () {
    actingAsSeed('U14');
    $story = vitrinaStory('familia-rios-peru-clasico');

    $this->postJson("/api/v1/portal/client/stories/{$story->id}/consent", ['granted' => false])->assertOk()->assertJsonPath('data.status', 'despublicado');
    expect(vitrinaStory('familia-rios-peru-clasico')->status)->toBe('despublicado')
        ->and(vitrinaStory('familia-rios-peru-clasico')->consent_revoked_at)->not->toBeNull();

    $this->withHeaders(siteOf())->getJson('/api/v1/public/stories/familia-rios-peru-clasico')->assertNotFound();

    $other = vitrinaStory('sophie-humantay');
    $this->postJson("/api/v1/portal/client/stories/{$other->id}/consent", ['granted' => true])->assertNotFound();
});

it('VT-12: la base rechaza publicar una historia sin consentimiento', function () {
    $story = vitrinaStory('sophie-humantay');

    expect(fn () => withinTenant(tenantA(), fn () => DB::table('cms_travel_stories')->where('id', $story->id)->update(['status' => 'publicado', 'published_at' => now()])))
        ->toThrow(QueryException::class);
});

it('despublicar, editar y eliminar una historia', function () {
    actingAsSeed('U02');
    $published = vitrinaStory('familia-rios-peru-clasico');

    $this->postJson("/api/v1/cms/stories/{$published->id}/unpublish", ['reason' => 'Actualizamos las fotos'])->assertOk()->assertJsonPath('data.status', 'despublicado');
    expect($this->postJson("/api/v1/cms/stories/{$published->id}/unpublish"))->toBeApiError(409, 'VT-12');

    $story = vitrinaNewStory();
    $this->patchJson("/api/v1/cms/stories/{$story['id']}", ['title' => 'Gabriela y los cóndores del Colca'])->assertOk();
    expect(vitrinaStory($story['slug'])->title)->toBe('Gabriela y los cóndores del Colca');

    $this->deleteJson("/api/v1/cms/stories/{$story['id']}")->assertNoContent();
    expect(vitrinaStory($story['slug']))->toBeNull()
        ->and(vitrinaTenantAudit(['entity' => 'Aventura', 'entity_id' => $story['slug'], 'action' => 'eliminar']))->toBeTrue();
});

it('el sitio público de la agencia muestra solo historias con consentimiento vigente', function () {
    $stories = collect($this->withHeaders(siteOf())->getJson('/api/v1/public/stories')->assertOk()->json('data'));

    expect($stories->pluck('slug')->all())->toContain('familia-rios-peru-clasico')->not->toContain('sophie-humantay');
    $detail = $this->withHeaders(siteOf())->getJson('/api/v1/public/stories/familia-rios-peru-clasico')->assertOk()->json('data');
    expect($detail['traveler'])->toBe('Gabriela');
});

it('publicar exige channels.cms.publish', function () {
    actingAsSeed('U07');
    $story = vitrinaStory('incentivo-mineros-cusco');

    expect($this->postJson("/api/v1/cms/stories/{$story->id}/publish"))->toBeApiError(403)
        ->and($this->postJson("/api/v1/cms/stories/{$story->id}/publish")->json('required_permissions'))->toContain('channels.cms.publish');
});
