<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\ExternalReview;

/**
 * Reseñas externas por API oficial (spec 17 §3.7, RV-01..03; D-15: Google Business Profile, TripAdvisor y
 * Trustpilot en fase 1). Sin scraping. Algunas APIs son solo lectura: `reply()` devuelve ok=false permanente
 * y la respuesta se guarda para publicarla manualmente (RV-02).
 */
interface ReviewsProvider extends HealthCheckable
{
    /**
     * @param  array<string, mixed>  $sourceConfig  fila de integration_review_sources (sin secretos; el secreto va por secret_ref)
     * @return iterable<ExternalReview>
     */
    public function fetch(array $sourceConfig, ?string $sinceDate = null): iterable;

    public function reply(array $sourceConfig, string $externalId, string $text): AdapterResult;
}
