<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\ExternalReview;

final class FakeReviewsProvider implements ReviewsProvider
{
    public function fetch(array $sourceConfig, ?string $sinceDate = null): iterable
    {
        $file = database_path('seeders/data/externalReviews.json');
        $rows = is_file($file) ? (array) json_decode((string) file_get_contents($file), true) : [];

        foreach ($rows as $r) {
            if (isset($sourceConfig['code']) && ($r['source'] ?? null) !== $sourceConfig['code']) {
                continue;
            }
            $date = (string) ($r['date'] ?? '2026-01-01');
            if ($sinceDate !== null && $date < $sinceDate) {
                continue;
            }
            yield new ExternalReview(
                externalId: (string) ($r['id'] ?? md5(json_encode($r))),
                authorDisplay: (string) ($r['author'] ?? 'Viajero'),
                rating: max(1, min(5, (int) ($r['rating'] ?? 5))),
                title: $r['title'] ?? null,
                body: $r['text'] ?? null,
                reviewDate: substr($date, 0, 10),
                url: $r['url'] ?? null,
                lang: isset($r['lang']) ? strtolower(substr((string) $r['lang'], 0, 2)) : null,
            );
        }
    }

    public function reply(array $sourceConfig, string $externalId, string $text): AdapterResult
    {
        return AdapterResult::permanent('API de solo lectura (simulado): copie la respuesta y publíquela en el sitio de reseñas.');
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
