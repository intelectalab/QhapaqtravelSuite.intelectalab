<?php

use Illuminate\Support\Facades\DB;

it('help:actualizar reemplaza el artículo de KipuControl con el texto del seeder y no toca la versión de la agencia', function () {
    $platform = DB::connection('pgsql_platform');
    $platform->table('help_articles')->whereNull('tenant_id')->where('slug', 'crm-metas')->update(['title' => 'Título viejo', 'summary' => 'Resumen que quedó desactualizado.']);
    $agencyCopy = $platform->table('help_articles')->whereNotNull('tenant_id')->where('slug', 'crm-metas')->value('title');

    $this->artisan('help:actualizar', ['slugs' => ['crm-metas']])->expectsOutputToContain('crm-metas: actualizado')->assertSuccessful();

    $article = $platform->table('help_articles')->whereNull('tenant_id')->where('slug', 'crm-metas')->first(['title', 'steps']);
    expect($article->title)->toBe('Metas comerciales')
        ->and($article->steps)->toContain('Una meta vigente no se anula')
        ->and($platform->table('help_articles')->whereNotNull('tenant_id')->where('slug', 'crm-metas')->value('title'))->toBe($agencyCopy);
});

it('help:actualizar rechaza un artículo que no existe en los seeders', function () {
    $this->artisan('help:actualizar', ['slugs' => ['no-existe']])->expectsOutputToContain('no-existe')->assertFailed();
});
