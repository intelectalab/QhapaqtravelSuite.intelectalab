<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Channels\Actions\ManageReviewSources;
use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Facades\DB;

final class SyncExternalReviews extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'integrations';

    protected function run(): string
    {
        $sources = DB::table('integration_review_sources')->where('status', 'conectado')->orderBy('provider')->get(['id', 'provider']);

        if ($sources->isEmpty()) {
            return 'Sin plataformas de reseñas conectadas';
        }

        if (! IntegrationReadiness::usable('reviews')) {
            return $this->warn('Sin proveedor real de reseñas: no se sincronizó ninguna plataforma');
        }

        $health = app(ReviewsProvider::class)->healthcheck();
        $actions = app(ManageReviewSources::class);
        $created = 0;
        $updated = 0;
        $failed = 0;
        $waiting = 0;

        foreach ($sources as $source) {
            if (! $health->ok) {
                if ($health->errorClass === 'permanente' && $this->reject($actions, $source, (string) $health->message)) {
                    $failed++;
                } else {
                    $waiting++;
                }

                continue;
            }

            try {
                $result = $actions->sync((string) $source->provider, null);
                $created += (int) $result['created'];
                $updated += (int) $result['updated'];
            } catch (ApiException) {
                $waiting++;
            }
        }

        $summary = self::summary([
            $created > 0 ? self::plural($created, 'reseña nueva', 'reseñas nuevas') : null,
            $updated > 0 ? self::plural($updated, 'reseña actualizada', 'reseñas actualizadas') : null,
            $failed > 0 ? self::plural($failed, 'plataforma con credencial rechazada', 'plataformas con credencial rechazada') : null,
            $waiting > 0 ? self::plural($waiting, 'plataforma sin respuesta, se reintenta en 6 h', 'plataformas sin respuesta, se reintentan en 6 h') : null,
        ], 'Reseñas al día, sin novedades');

        return $failed > 0 || $waiting > 0 ? $this->warn($summary) : $summary;
    }

    private function reject(ManageReviewSources $actions, object $source, string $message): bool
    {
        if (! $actions->fail((string) $source->provider, $message)) {
            return false;
        }

        $label = ExternalReviewDirectory::PROVIDERS[$source->provider] ?? (string) $source->provider;

        foreach ($this->managers() as $userId) {
            $this->notifyOnce('resenas.fuente_error', $userId, 'integration_review_source', (string) $source->id, "{$label} rechazó la conexión de reseñas",
                "No pudimos leer las reseñas de {$label}: {$message} Vuelve a conectar la cuenta en Canales › Reseñas externas.", true);
        }

        return true;
    }
}
