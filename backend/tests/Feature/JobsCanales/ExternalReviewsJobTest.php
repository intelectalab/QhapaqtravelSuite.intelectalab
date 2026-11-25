<?php

use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\SyncExternalReviews;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/JobsCanalesHelpers.php';

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake(canalesSideJobs());
});

function reviewJobSources(): array
{
    return withinTenant(tenantA(), fn () => DB::table('integration_review_sources')->orderBy('provider')->get(['id', 'provider', 'status', 'last_sync_at'])->keyBy('provider')->all());
}

function reviewJobCount(string $sourceId): int
{
    return withinTenant(tenantA(), fn () => DB::table('channel_external_reviews')->where('source_id', $sourceId)->count());
}

it('JOB-RES-1 importa las reseñas de cada plataforma conectada sin duplicar por external_id', function () {
    $google = reviewJobSources()['google'] ?? null;
    expect($google)->not->toBeNull()->and($google->status)->toBe('conectado');

    withinTenant(tenantA(), fn () => DB::table('integration_review_sources')->where('status', 'conectado')->update(['last_sync_at' => null]));

    $first = canalesJobRun(new SyncExternalReviews);
    $after = reviewJobCount((string) $google->id);
    $second = canalesJobRun(new SyncExternalReviews);

    expect($first->status)->toBe('ok')
        ->and(mb_strtolower((string) $first->result))->toContain('reseña')
        ->and($after)->toBeGreaterThan(0)
        ->and(reviewJobCount((string) $google->id))->toBe($after)
        ->and($second->result)->not->toContain('nueva')
        ->and(reviewJobSources()['google']->last_sync_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Integración de reseñas')->where('entity_id', 'google')->where('action', 'sincronizar')->whereNull('actor_id')->exists()))->toBeTrue();
});

it('JOB-RES-1 marca en error la plataforma que rechaza la credencial y avisa a gerencia una vez al día', function () {
    app()->instance(ReviewsProvider::class, new class implements ReviewsProvider
    {
        public function fetch(array $sourceConfig, ?string $sinceDate = null): iterable
        {
            return [];
        }

        public function reply(array $sourceConfig, string $externalId, string $text): AdapterResult
        {
            return AdapterResult::permanent('No autorizado.');
        }

        public function healthcheck(): AdapterResult
        {
            return AdapterResult::permanent('La plataforma respondió 401: credencial vencida.');
        }
    });
    $google = reviewJobSources()['google'];

    $run = canalesJobRun(new SyncExternalReviews);
    $notices = canalesNotices('resenas.fuente_error', (string) $google->id);
    canalesJobRun(new SyncExternalReviews);

    expect($run->status)->toBe('advertencia')
        ->and($run->result)->toContain('credencial rechazada')
        ->and(reviewJobSources()['google']->status)->toBe('error')
        ->and($notices)->toBeGreaterThan(0)
        ->and(canalesNotices('resenas.fuente_error', (string) $google->id))->toBe($notices);
});

it('JOB-RES-1 en producción con el adaptador simulado no importa reseñas inventadas', function () {
    config(['integrations.require_real' => true, 'integrations.drivers.reviews' => 'fake']);
    $google = reviewJobSources()['google'];
    $before = reviewJobCount((string) $google->id);

    $run = canalesJobRun(new SyncExternalReviews);

    expect($run->status)->toBe('advertencia')
        ->and($run->result)->toContain('Sin proveedor real')
        ->and(reviewJobCount((string) $google->id))->toBe($before)
        ->and(reviewJobSources()['google']->status)->toBe('conectado');
});

it('JOB-RES-1 queda en el catálogo cada 6 h en la cola de integraciones', function () {
    expect(JobCatalog::TENANT['JOB-RES-1'])->toMatchArray(['class' => SyncExternalReviews::class, 'cron' => '0 */6 * * *', 'queue' => 'integrations']);
});
