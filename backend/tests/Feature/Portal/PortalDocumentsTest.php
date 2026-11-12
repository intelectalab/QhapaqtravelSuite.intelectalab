<?php

use App\Domain\Documents\Actions\ClientDocuments;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Storage::fake(config('filesystems.default'));
});

it('el portal lista vouchers, comprobantes, propuestas e itinerarios del cliente con su tipo', function () {
    Queue::fake();
    actingAsSeed('U14');

    $data = $this->getJson('/api/v1/portal/client/documents')->assertOk()->json('data');
    $kinds = collect($data['items'])->pluck('kind')->unique();

    expect($data)->toHaveKeys(['items', 'kinds'])
        ->and($kinds)->toContain('itinerary')
        ->and(collect($data['kinds'])->sum('count'))->toBe(count($data['items']))
        ->and(collect($data['items'])->firstWhere('kind', 'itinerary')['href'])->toStartWith('/portal/viajes/');
});

it('los contenidos del CMS llegan solo al portal de su canal y dentro de su vigencia', function () {
    Queue::fake();
    withinTenant(tenantA(), function (): void {
        $author = idOf('iam_users', 'U01');
        $base = ['type' => 'Página legal', 'body' => 'Texto de prueba del CMS.', 'seo_title' => 'Prueba', 'status' => 'publicado', 'author_id' => $author, 'published_at' => now()];
        DB::table('cms_contents')->insert([...$base, 'code' => 'CMS-PC1', 'title' => 'Solo portal cliente', 'channel' => 'Portal cliente', 'slug' => 'solo-cliente']);
        DB::table('cms_contents')->insert([...$base, 'code' => 'CMS-PP1', 'title' => 'Solo portal pasajero', 'channel' => 'Portal pasajero', 'slug' => 'solo-pasajero']);
        DB::table('cms_contents')->insert([...$base, 'code' => 'CMS-PC2', 'title' => 'Vencido', 'channel' => 'Portal cliente', 'slug' => 'vencido', 'valid_to' => '2020-01-01']);
        DB::table('cms_contents')->insert([...$base, 'code' => 'CMS-BN1', 'title' => 'Banner del portal', 'type' => 'Banner', 'channel' => 'Web / Portal', 'slug' => 'banner-portal']);
    });

    actingAsSeed('U14');
    $client = collect($this->getJson('/api/v1/portal/client/documents')->json('data.contents'))->pluck('code');
    $banners = collect($this->getJson('/api/v1/portal/client/home')->json('data.banners'))->pluck('code');

    actingAsSeed('U15');
    $passenger = collect($this->getJson('/api/v1/portal/client/documents')->json('data.contents'))->pluck('code');

    expect($client)->toContain('CMS-PC1')->not->toContain('CMS-PP1')->not->toContain('CMS-PC2')->not->toContain('CMS-BN1')
        ->and($banners)->toContain('CMS-BN1')
        ->and($passenger)->toContain('CMS-PP1')->not->toContain('CMS-PC1');
});

it('el cliente descarga solo sus vouchers ya generados y no los de otro cliente', function () {
    $clientId = withinTenant(tenantA(), fn () => (string) DB::table('iam_users')->where('code', 'U14')->value('client_id'));
    [$own, $foreign] = withinTenant(tenantA(), function () use ($clientId): array {
        $vouchers = DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->where('v.status', '<>', 'anulado')->where('r.status', '<>', 'borrador')
            ->orderBy('v.code')->get(['v.id', 'v.reservation_id']);
        $own = $vouchers->first();
        $foreign = $vouchers->first(fn (object $row): bool => $row->reservation_id !== $own->reservation_id);
        DB::table('booking_reservations')->where('id', $own->reservation_id)->update(['client_id' => $clientId]);
        DB::table('booking_reservations')->where('id', $foreign->reservation_id)->where('client_id', $clientId)->update(['client_id' => DB::table('crm_clients')->where('id', '<>', $clientId)->value('id')]);

        return [(string) $own->id, (string) $foreign->id];
    });

    [$ownDoc, $foreignDoc] = withinTenant(tenantA(), fn () => [
        app(ClientDocuments::class)->generate(ClientDocuments::VOUCHER, $own)->id,
        app(ClientDocuments::class)->generate(ClientDocuments::VOUCHER, $foreign)->id,
    ]);

    actingAsSeed('U14');
    $listed = collect($this->getJson('/api/v1/portal/client/documents')->json('data.items'))->firstWhere('href', "/portal/documentos/{$ownDoc}");

    expect($listed)->not->toBeNull()->and($listed['ready'])->toBeTrue();
    $this->get("/api/v1/documents/{$ownDoc}/download")->assertRedirect();
    expect($this->getJson("/api/v1/documents/{$foreignDoc}/download"))->toBeApiError(404);
});
