<?php

use App\Domain\Integrations\Contracts\SiteContentAi;
use App\Domain\Integrations\Data\AdapterResult;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => lockPlatformBilling());

function plantillasCredits(): array
{
    return test()->getJson('/api/v1/cms/ai/credits')->assertOk()->json('data.balances');
}

function plantillasProduct(string $code): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->first());
}

function plantillasAdjust(string $kind, int $credits): void
{
    withinTenant(tenantA(), function () use ($kind, $credits): void {
        $balance = (int) DB::table('fin_ai_credit_ledger')->where('kind', $kind)->orderByDesc('occurred_at')->orderByDesc('id')->value('balance_after');
        DB::table('fin_ai_credit_ledger')->insert(['kind' => $kind, 'movement' => 'ajuste', 'credits' => $credits, 'balance_after' => $balance + $credits, 'note' => 'Prueba', 'occurred_at' => now()->addMinute()]);
    });
}

it('muestra saldos, costos, plan de IA y movimientos de créditos', function () {
    actingAsSeed('U01');

    $credits = $this->getJson('/api/v1/cms/ai/credits')->assertOk()->json('data');

    expect($credits['balances']['contenido']['balance'])->toBe(394)
        ->and($credits['balances']['imagenes']['balance'])->toBe(14)
        ->and($credits['plan_included']['contenido'])->toBe(100)
        ->and($credits['ai_plan']['code'])->toBe('IA-BASICO')
        ->and($credits['costs'])->toMatchArray(['meta_seo' => 1, 'articulo' => 8, 'imagen_hd' => 2]);

    $ledger = $this->getJson('/api/v1/cms/ai/credits/ledger')->assertOk()->json('data');
    expect($ledger[0])->toMatchArray(['kind' => 'imagenes', 'movement' => 'consumo', 'credits' => -6, 'job' => 'IAC-0043']);

    $packs = $this->getJson('/api/v1/cms/ai/packs')->assertOk()->json('data');
    expect(array_column($packs['plans'], 'code'))->toBe(['IA-BASICO', 'IA-PRO'])
        ->and($packs['contracted'])->toBe('IA-BASICO')
        ->and(array_column($packs['packs'], 'code'))->toContain('IA-IMG-20', 'IA-CONT-EXTRA-200');

    $jobs = $this->getJson('/api/v1/cms/ai/jobs?status=listo')->assertOk()->json();
    expect(array_column($jobs['data'], 'code'))->toContain('IAC-0041', 'IAC-0042')
        ->and($jobs['meta']['options']['kinds'])->toHaveKey('relato_aventura');
});

it('IA-03: mejora una descripción con costo previo, muestra antes y después y solo cambia el tour al aplicarla', function () {
    actingAsSeed('U02');
    $product = plantillasProduct('CUS-MAPI-FD');

    $job = $this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'mejorar_texto', 'target_type' => 'producto', 'target_id' => 'CUS-MAPI-FD', 'tone' => 'cercano', 'notes' => 'Mencionar el recojo desde el hotel'], critical())->assertStatus(202)->json('data');

    expect($job)->toMatchArray(['status' => 'listo', 'credits_used' => 2, 'kind' => 'mejorar_texto'])
        ->and($job['before']['text'])->toBe($product->short_description)
        ->and($job['after']['text'])->toContain('Mencionar el recojo desde el hotel')
        ->and($job['warning'])->toBe('Revise cifras, horarios y precios antes de aplicar.')
        ->and(plantillasCredits()['contenido']['balance'])->toBe(392)
        ->and(plantillasProduct('CUS-MAPI-FD')->short_description)->toBe($product->short_description);

    $applied = $this->postJson("/api/v1/cms/ai/jobs/{$job['code']}/apply", [], critical())->assertOk()->json('data');

    expect($applied['status'])->toBe('aplicado')
        ->and($applied['applied_ref'])->toBe('CUS-MAPI-FD')
        ->and(plantillasProduct('CUS-MAPI-FD')->short_description)->toBe($job['after']['text'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Contenido con IA', 'entity_id' => $job['code'], 'action' => 'aplicar'])->value('before_value')))->toBe($product->short_description);
    expect($this->postJson("/api/v1/cms/ai/jobs/{$job['code']}/apply", [], critical()))->toBeApiError(422, 'AI_JOB_STATE');
});

it('descarta un resultado y pide otra versión cobrando de nuevo', function () {
    actingAsSeed('U01');

    $regenerated = $this->postJson('/api/v1/cms/ai/jobs/IAC-0042/regenerate', [], critical())->assertStatus(202)->json('data');

    expect($regenerated['status'])->toBe('listo')
        ->and($regenerated['code'])->not->toBe('IAC-0042')
        ->and($this->getJson('/api/v1/cms/ai/jobs/IAC-0042')->json('data.status'))->toBe('descartado')
        ->and(plantillasCredits()['contenido']['balance'])->toBe(393);

    $this->postJson('/api/v1/cms/ai/jobs/IAC-0041/discard')->assertOk()->assertJsonPath('data.status', 'descartado');
    expect($this->postJson('/api/v1/cms/ai/jobs/IAC-0041/discard'))->toBeApiError(422, 'AI_JOB_STATE');

    $applied = $this->postJson("/api/v1/cms/ai/jobs/{$regenerated['code']}/apply", [], critical())->assertOk()->json('data');
    expect(plantillasProduct('CUS-HUM-FD')->seo_title)->toBe($applied['after']['title']);
});

it('traduce al inglés y crea artículos como borrador del CMS', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'traducir', 'target_type' => 'producto', 'target_id' => 'CUS-HUM-FD', 'locale' => 'es'], critical()))->toBeApiError(422, 'AI_TARGET_INVALID');
    expect($this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'articulo', 'target_type' => 'producto', 'target_id' => 'CUS-HUM-FD'], critical()))->toBeApiError(422, 'AI_TARGET_INVALID');

    $translation = $this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'traducir', 'target_type' => 'producto', 'target_id' => 'CUS-HUM-FD', 'locale' => 'en'], critical())->assertStatus(202)->json('data');
    $this->postJson("/api/v1/cms/ai/jobs/{$translation['code']}/apply", [], critical())->assertOk();
    $product = plantillasProduct('CUS-HUM-FD');

    expect(withinTenant(tenantA(), fn () => DB::table('catalog_product_translations')->where('product_id', $product->id)->where('locale', 'en')->value('short')))->toBe($translation['after']['text']);

    $article = $this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'articulo', 'target_type' => 'libre', 'tone' => 'aventurero', 'notes' => 'Qué llevar a la laguna Humantay'], critical())->assertStatus(202)->json('data');
    expect($article['credits_used'])->toBe(8);
    $reference = $this->postJson("/api/v1/cms/ai/jobs/{$article['code']}/apply", [], critical())->assertOk()->json('data.applied_ref');

    expect(withinTenant(tenantA(), fn () => DB::table('cms_contents')->where('code', $reference)->first(['type', 'status', 'title'])))->toMatchArray(['type' => 'Artículo', 'status' => 'borrador', 'title' => 'Qué llevar a la laguna Humantay']);
});

it('IA-01: sin saldo suficiente responde 429 con la oferta de paquetes', function () {
    plantillasAdjust('imagenes', -8);
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/cms/ai/images', ['prompt' => 'Cañón del Colca al amanecer con cóndores', 'style' => 'fotografico', 'count' => 4, 'quality' => 'hd'], critical());

    expect($response)->toBeApiError(429, 'AI_CREDITS_EXHAUSTED');
    expect($response->json('details.packs'))->toContain('IA-IMG-20')
        ->and(plantillasCredits()['imagenes']['balance'])->toBe(6);
});

it('IA-02: un pedido fallido no descuenta créditos', function () {
    app()->instance(SiteContentAi::class, new class implements SiteContentAi
    {
        public function write(string $kind, array $source, array $options): array
        {
            throw new RuntimeException('Proveedor caído');
        }

        public function draw(string $prompt, string $style, int $width, int $height, int $variant): string
        {
            return '';
        }

        public function imageMime(): string
        {
            return 'image/png';
        }

        public function provider(): string
        {
            return 'roto';
        }

        public function healthcheck(): AdapterResult
        {
            return AdapterResult::transient('caído');
        }
    });
    actingAsSeed('U01');

    $job = $this->postJson('/api/v1/cms/ai/jobs', ['kind' => 'meta_seo', 'target_type' => 'producto', 'target_id' => 'CUS-MAPI-FD'], critical())->assertStatus(202)->json('data');

    expect($job)->toMatchArray(['status' => 'fallido', 'credits_used' => 0])
        ->and($job['error'])->toContain('No se descontaron créditos')
        ->and(plantillasCredits()['contenido']['balance'])->toBe(394);
});

it('IA-05: crea imágenes con texto alternativo y etiqueta de IA, las usa o descarta, y rechaza marcas o personas reales', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/cms/ai/images', ['prompt' => 'El logo de una aerolínea sobre Machu Picchu', 'style' => 'fotografico', 'count' => 1, 'quality' => 'std'], critical()))->toBeApiError(422, 'AI_IMAGE_REJECTED');
    $this->postJson('/api/v1/cms/ai/images', ['prompt' => 'corto', 'style' => 'fotografico', 'count' => 3, 'quality' => 'std'], critical())->assertStatus(422)->assertJsonValidationErrors(['prompt', 'count']);

    $created = $this->postJson('/api/v1/cms/ai/images', ['prompt' => 'Mapa ilustrado del Valle Sagrado con sus pueblos', 'style' => 'mapa', 'count' => 2, 'quality' => 'std'], critical())->assertStatus(202)->json('data');

    expect($created['credits_used'])->toBe(2)
        ->and($created['balance'])->toBe(12)
        ->and($created['images'])->toHaveCount(2)
        ->and($created['images'][0])->toMatchArray(['ai_label' => true, 'status' => 'generada', 'style' => 'mapa']);

    $image = $created['images'][0];
    $id = $image['id'];
    $other = $created['images'][1]['id'];
    $path = withinTenant(tenantA(), fn () => DB::table('cms_ai_images')->where('id', $id)->value('file_path'));
    expect(Storage::disk((string) config('filesystems.default'))->exists($path))->toBeTrue();
    $this->get("/api/v1/cms/ai/images/{$id}/file")->assertOk()->assertHeader('Content-Type', 'image/svg+xml');

    $this->patchJson("/api/v1/cms/ai/images/{$id}", ['alt_text' => 'abc'])->assertStatus(422)->assertJsonValidationErrors('alt_text');
    $this->patchJson("/api/v1/cms/ai/images/{$id}", ['alt_text' => 'Mapa del Valle Sagrado con Pisac y Ollantaytambo'])->assertOk()->assertJsonPath('data.alt_text', 'Mapa del Valle Sagrado con Pisac y Ollantaytambo');
    $this->patchJson("/api/v1/cms/ai/images/{$id}", ['action' => 'usar', 'used_in' => 'Banner de inicio'])->assertOk()->assertJsonPath('data.status', 'en_uso')->assertJsonPath('data.used_in', ['Banner de inicio']);
    expect($this->patchJson("/api/v1/cms/ai/images/{$id}", ['action' => 'descartar']))->toBeApiError(422, 'AI_IMAGE_STATE');
    $this->patchJson("/api/v1/cms/ai/images/{$other}", ['action' => 'descartar'])->assertOk()->assertJsonPath('data.status', 'descartada');

    expect(collect($this->getJson('/api/v1/cms/ai/images')->assertOk()->json('data'))->pluck('id'))->toContain($image['id']);
});

it('compra paquetes y contrata planes de IA sumando créditos en el libro', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/cms/ai/packs/IA-IMG-20/purchase', [], critical())->assertOk();
    expect(plantillasCredits()['imagenes']['balance'])->toBe(34);

    expect($this->postJson('/api/v1/cms/ai/packs/IA-BASICO/purchase', [], critical()))->toBeApiError(409, 'AI_PLAN_ACTIVE');

    $result = $this->postJson('/api/v1/cms/ai/packs/IA-PRO/purchase', [], critical())->assertOk()->json('data');
    expect($result['summary']['ai_plan']['code'])->toBe('IA-PRO')
        ->and($result['summary']['balances']['contenido']['balance'])->toBe(1394)
        ->and($result['summary']['balances']['imagenes']['balance'])->toBe(64)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Créditos de IA', 'entity_id' => 'IA-PRO', 'action' => 'contratar'])->exists()))->toBeTrue();
    expect($this->postJson('/api/v1/cms/ai/packs/NO-EXISTE/purchase', [], critical()))->toBeApiError(404);
});

it('IA-07: el libro de créditos no admite cambios', function () {
    $update = fn () => withinTenant(tenantA(), fn () => DB::table('fin_ai_credit_ledger')->update(['note' => 'cambio']));

    expect($update)->toThrow(QueryException::class);
});

it('Ventas no usa el contenido con IA', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/cms/ai/jobs'))->toBeApiError(403);
    expect($this->getJson('/api/v1/cms/ai/credits')->json('required_permissions'))->toContain('ai.content.use');
});
