<?php

use Illuminate\Support\Facades\DB;

function publishCms(string $code, array $extra = []): void
{
    withinTenant(tenantA(), fn () => DB::table('cms_contents')->where('code', $code)->update(['status' => 'publicado', 'seo_title' => 'Título SEO', 'published_at' => now(), 'valid_from' => null, 'valid_to' => null, ...$extra]));
}

it('el blog muestra solo artículos publicados del canal web, con resumen y tiempo de lectura', function () {
    expect($this->getJson('/api/v1/public/posts', siteOf())->assertOk()->json('data'))->toBe([]);

    publishCms('CMS-03');
    $posts = $this->getJson('/api/v1/public/posts', siteOf())->assertOk()->json('data');
    $slug = $posts[0]['slug'];
    $post = $this->getJson("/api/v1/public/posts/{$slug}", siteOf())->assertOk()->json('data');

    expect($posts)->toHaveCount(1)
        ->and($posts[0]['title'])->toBe('10 consejos para el mal de altura')
        ->and($posts[0]['minutes'])->toBeGreaterThanOrEqual(1)
        ->and($post['body'])->toContain('## 10 consejos')
        ->and($this->getJson('/api/v1/public/posts/no-existe', siteOf())->status())->toBe(404);
});

it('las páginas legales usan el texto publicado en el CMS o, si no hay, el de las políticas de la agencia', function () {
    $cancel = $this->getJson('/api/v1/public/pages/cancelacion', siteOf())->assertOk()->json('data');
    $terms = $this->getJson('/api/v1/public/pages/terminos', siteOf())->assertOk()->json('data');
    $cookies = $this->getJson('/api/v1/public/pages/cookies', siteOf())->assertOk()->json('data');
    $privacy = $this->getJson('/api/v1/public/pages/privacidad', siteOf())->assertOk()->json('data');
    $policies = withinTenant(tenantA(), fn () => json_decode((string) DB::table('sys_settings')->where('section', 'policies')->value('values'), true));

    expect($cancel['source'])->toBe('cms')
        ->and($cancel['title'])->toBe('Política de cancelaciones')
        ->and($terms['source'])->toBe('agency')
        ->and($terms['body'])->toContain($policies['cancel_text'])
        ->and($terms['body'])->toContain("{$policies['advance_pct']} %")
        ->and($privacy['body'])->toContain('Ley N.° 29733')
        ->and($cookies['body'])->toContain('cookies técnicas')
        ->and($this->getJson('/api/v1/public/pages/no-existe', siteOf())->status())->toBe(404);
});

it('nosotros trae cifras reales de la agencia y los contenidos por ubicación respetan la publicación', function () {
    $about = $this->getJson('/api/v1/public/pages/nosotros', siteOf())->assertOk()->json('data');
    expect($about['stats']['products'])->toBeGreaterThan(0)
        ->and($about['stats'])->toHaveKeys(['destinations', 'trips', 'rating']);

    publishCms('CMS-04', ['placement' => 'home_hero']);
    expect(collect($this->getJson('/api/v1/public/cms/placements/home_hero', siteOf())->assertOk()->json('data'))->pluck('title'))->toContain('Año Nuevo en Cusco 2027')
        ->and($this->getJson('/api/v1/public/cms/contents/banner-fiestas-patrias', siteOf())->status())->toBe(404);
});
