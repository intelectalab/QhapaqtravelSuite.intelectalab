<?php

function translateHumantay(): void
{
    actingAsSeed('U01');
    test()->putJson('/api/v1/catalog/products/CUS-HUM-FD/translations/en', [
        'name' => 'Humantay Lake Full Day',
        'short' => 'Hike to the turquoise lake at the foot of Salkantay.',
        'inclusions' => "Round-trip transport\nBilingual guide\nBreakfast and lunch",
        'exclusions' => "Horse rental\nTips",
    ])->assertOk();
}

beforeEach(fn () => freezeBusinessToday());

it('el editor guarda la traducción al inglés con el español como referencia', function () {
    translateHumantay();

    $data = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/translations')->assertOk()->json('data');
    $en = collect($data['translations'])->firstWhere('locale', 'en');

    expect($data['base']['name'])->toBe('Laguna Humantay Full Day')
        ->and($en['exists'])->toBeTrue()
        ->and($en['name'])->toBe('Humantay Lake Full Day')
        ->and($en['inclusions'])->toBe(['Round-trip transport', 'Bilingual guide', 'Breakfast and lunch'])
        ->and($en['slug'])->toBe('humantay-lake-full-day');
    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/translations/fr', ['name' => 'Lac Humantay']))->toBeApiError(422, 'LOCALE_INVALID');
});

it('el sitio en inglés usa la traducción y marca el respaldo en español donde falta', function () {
    translateHumantay();

    $translated = $this->getJson('/api/v1/public/products/laguna-humantay-full-day?locale=en', siteOf())->assertOk()->json('data');
    $fallback = $this->getJson('/api/v1/public/products/paracas-e-islas-ballestas-desde-lima', siteOf(extra: ['X-Site-Locale' => 'en']))->assertOk()->json('data');
    $spanish = $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertOk()->json('data');

    expect($translated['product']['name'])->toBe('Humantay Lake Full Day')
        ->and($translated['product']['content_locale'])->toBe('en')
        ->and($translated['inclusions'])->toBe(['Round-trip transport', 'Bilingual guide', 'Breakfast and lunch'])
        ->and($fallback['product']['content_locale'])->toBe('es')
        ->and($spanish['product']['name'])->toBe('Laguna Humantay Full Day')
        ->and($spanish['product']['content_locale'])->toBe('es');
    expect($this->getJson('/api/v1/public/site', siteOf())->json('data.locales'))->toBe(['es', 'en']);
});

it('quitar la traducción devuelve el producto al español y solo Catálogo puede editarla', function () {
    translateHumantay();

    $this->deleteJson('/api/v1/catalog/products/CUS-HUM-FD/translations/en')->assertNoContent();
    expect($this->getJson('/api/v1/public/products/laguna-humantay-full-day?locale=en', siteOf())->json('data.product.content_locale'))->toBe('es');

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/translations/en', ['name' => 'Humantay']))->toBeApiError(403);
});
