<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\ExternalReview;
use Illuminate\Support\Carbon;

final class FakeReviewsProvider implements ReviewsProvider
{
    public const REPLY_PROVIDERS = ['google', 'trustpilot', 'facebook'];

    private const SAMPLES = [
        [5, 'Experiencia impecable', 'La organización fue excelente de principio a fin. El guía conocía cada detalle y los traslados llegaron puntuales.', 'es'],
        [4, 'Muy recomendable', 'Buen servicio y buena comunicación. El hotel podría mejorar, pero la agencia respondió rápido a todo.', 'es'],
        [2, 'Problemas con el traslado', 'El recojo del aeropuerto llegó con una hora de retraso y nadie nos avisó. El resto del viaje estuvo bien.', 'es'],
        [5, 'Unforgettable trip', 'Everything was perfectly arranged. Our guide was friendly and very knowledgeable about the history.', 'en'],
    ];

    public function fetch(array $sourceConfig, ?string $sinceDate = null): iterable
    {
        $provider = (string) ($sourceConfig['provider'] ?? $sourceConfig['code'] ?? 'demo');
        $account = (string) ($sourceConfig['account'] ?? $provider);
        $today = Carbon::parse((string) ($sourceConfig['today'] ?? '2026-01-31'))->startOfDay();
        $seed = abs(crc32($provider.'|'.$account));

        foreach (self::SAMPLES as $index => [$rating, $title, $body, $lang]) {
            $date = $today->copy()->subDays(($seed + $index * 3) % 20 + $index)->toDateString();

            if ($sinceDate !== null && $date < $sinceDate) {
                continue;
            }

            yield new ExternalReview(
                externalId: sprintf('%s-%s-%d', substr($provider, 0, 3), substr(md5($account), 0, 6), $index + 1),
                authorDisplay: ['Lucía M.', 'Carlos R.', 'Andrea P.', 'John S.'][$index],
                rating: $rating,
                title: $title,
                body: $body,
                reviewDate: $date,
                url: null,
                lang: $lang,
            );
        }
    }

    public function reply(array $sourceConfig, string $externalId, string $text): AdapterResult
    {
        if (in_array($sourceConfig['provider'] ?? null, self::REPLY_PROVIDERS, true)) {
            return AdapterResult::success('publicada', $externalId, ['simulated' => true]);
        }

        return AdapterResult::permanent('API de solo lectura (simulado): copie la respuesta y publíquela en el sitio de reseñas.');
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }
}
