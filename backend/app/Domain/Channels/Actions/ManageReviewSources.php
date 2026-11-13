<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Integrations\Data\ExternalReview;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class ManageReviewSources
{
    public const PRIORITY = ['google', 'tripadvisor', 'trustpilot'];

    public const SCOPES = [
        'google' => ['reviews.read', 'reviews.reply'],
        'tripadvisor' => ['content.read', 'review_express'],
        'trustpilot' => ['reviews.read', 'reviews.reply', 'invitations'],
        'facebook' => ['pages_read_user_content', 'pages_manage_engagement'],
        'getyourguide' => ['reviews.read'],
        'viator' => ['reviews.read'],
    ];

    private const REPLY = ['google' => 'reviews.reply', 'trustpilot' => 'reviews.reply', 'facebook' => 'pages_manage_engagement'];

    private const INVITES = ['tripadvisor', 'trustpilot'];

    private const ENTITY = 'Integración de reseñas';

    public function __construct(
        private readonly ReviewsProvider $provider,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function list(): array
    {
        $rows = DB::table('integration_review_sources as s')->leftJoin('iam_users as u', 'u.id', '=', 's.connected_by')->get(['s.*', 'u.name as connected_by_name'])->keyBy('provider');
        $inbox = DB::table('channel_external_reviews')->selectRaw('source_id, count(*) as total')->groupBy('source_id')->pluck('total', 'source_id');

        return collect(ExternalReviewDirectory::PROVIDERS)->map(function (string $label, string $provider) use ($rows, $inbox): array {
            $row = $rows->get($provider);

            return [
                'provider' => $provider,
                'label' => $label,
                'priority' => in_array($provider, self::PRIORITY, true),
                'status' => $row->status ?? 'no_conectado',
                'account' => $row->account_ref ?? null,
                'key_last4' => $row->secret_last4 ?? null,
                'scopes' => $row ? array_values(array_filter(explode(',', trim((string) $row->scopes, '{}')), fn (string $scope): bool => $scope !== '')) : [],
                'available_scopes' => self::SCOPES[$provider],
                'can_reply' => (bool) ($row->can_reply ?? false),
                'invites' => (bool) ($row->supports_invites ?? false),
                'rating' => $row && $row->rating !== null ? (float) $row->rating : null,
                'count' => (int) ($row->review_count ?? 0),
                'inbox' => $row ? (int) ($inbox[$row->id] ?? 0) : 0,
                'last_sync_at' => $row->last_sync_at ?? null,
                'connected_at' => $row->connected_at ?? null,
                'connected_by' => $row->connected_by_name ?? null,
                'contract_ack_at' => $row->contract_ack_at ?? null,
            ];
        })->values()->all();
    }

    public function connect(array $data, User $actor): array
    {
        $provider = $data['provider'];
        $scopes = array_values(array_intersect(self::SCOPES[$provider], $data['scopes'] ?? self::SCOPES[$provider]));

        if ($scopes === []) {
            throw ApiException::unprocessable('RV-02', 'Elige al menos un alcance que la plataforma permita.');
        }

        DB::transaction(function () use ($provider, $data, $scopes, $actor): void {
            $row = DB::table('integration_review_sources')->where('provider', $provider)->lock('for no key update')->first(['id', 'status']);

            if ($row !== null && $row->status === 'conectado') {
                throw ApiException::conflict('RV-03', 'Esta plataforma ya está conectada. Desconéctala para cambiar la cuenta o la credencial.');
            }

            $health = $this->provider->healthcheck();
            $status = ! $health->ok ? 'error' : (in_array($provider, self::PRIORITY, true) ? 'conectado' : 'pendiente');
            $credential = trim((string) $data['credential']);
            $values = [
                'status' => $status,
                'account_ref' => trim($data['account']),
                'secret_ref' => 'vault://tenants/'.$this->context->tenant()->code.'/reviews/'.$provider,
                'secret_last4' => mb_substr($credential, -4),
                'scopes' => '{'.implode(',', $scopes).'}',
                'can_reply' => isset(self::REPLY[$provider]) && in_array(self::REPLY[$provider], $scopes, true),
                'supports_invites' => in_array($provider, self::INVITES, true),
                'connected_at' => now(),
                'connected_by' => $actor->getKey(),
                'contract_ack_at' => now(),
                'contract_ack_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];

            if ($row === null) {
                DB::table('integration_review_sources')->insert(['id' => (string) Str::uuid7(), 'provider' => $provider, ...$values, 'created_by' => $actor->getKey()]);
            } else {
                DB::table('integration_review_sources')->where('id', $row->id)->update($values);
            }

            $this->audit->log(self::ENTITY, $provider, 'conectar', $row->status ?? 'no_conectado', $status.' · '.implode(', ', $scopes));
        });

        return $this->one($provider);
    }

    public function disconnect(string $provider, User $actor): void
    {
        DB::transaction(function () use ($provider, $actor): void {
            $row = $this->source($provider, true);

            if ($row->status === 'no_conectado') {
                throw ApiException::conflict('RV-03', 'La plataforma ya está desconectada.');
            }

            DB::table('integration_review_sources')->where('id', $row->id)->update([
                'status' => 'no_conectado',
                'secret_ref' => null,
                'secret_last4' => null,
                'scopes' => '{}',
                'can_reply' => false,
                'connected_at' => null,
                'connected_by' => null,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log(self::ENTITY, $provider, 'desconectar', $row->status, 'no_conectado · credencial eliminada');
        });
    }

    public function sync(string $provider, User $actor): array
    {
        $lock = Cache::lock("review-sync:{$this->context->idOrFail()}:{$provider}", 120);

        if (! $lock->get()) {
            throw ApiException::conflict('RV-04', 'Ya hay una sincronización en curso para esta plataforma.');
        }

        try {
            return DB::transaction(function () use ($provider, $actor): array {
                $row = $this->source($provider, true);

                if (! in_array($row->status, ['conectado', 'error'], true)) {
                    throw ApiException::conflict('RV-03', 'Conecta la plataforma antes de sincronizarla.');
                }

                $since = $row->last_sync_at ? Carbon::parse($row->last_sync_at)->subDays(7)->toDateString() : null;
                $today = Carbon::now($this->context->timezone())->toDateString();
                $created = 0;
                $updated = 0;

                foreach ($this->provider->fetch(['provider' => $provider, 'account' => $row->account_ref, 'today' => $today], $since) as $review) {
                    assert($review instanceof ExternalReview);
                    $existing = DB::table('channel_external_reviews')->where('source_id', $row->id)->where('external_id', $review->externalId)->value('id');
                    $values = ['author_display' => mb_substr($review->authorDisplay, 0, 120), 'review_date' => $review->reviewDate, 'rating' => $review->rating, 'title' => $review->title, 'body' => $review->body, 'lang' => $review->lang, 'url' => $review->url, 'updated_by' => $actor->getKey(), 'updated_at' => now()];

                    if ($existing === null) {
                        DB::table('channel_external_reviews')->insert(['id' => (string) Str::uuid7(), 'source_id' => $row->id, 'external_id' => $review->externalId, 'response_status' => $row->can_reply ? 'sin_responder' : 'no_admite', 'raw' => json_encode(['simulated' => true]), 'created_by' => $actor->getKey(), ...$values]);
                        $created++;
                    } else {
                        DB::table('channel_external_reviews')->where('id', $existing)->update($values);
                        $updated++;
                    }
                }

                $stats = DB::table('channel_external_reviews')->where('source_id', $row->id)->selectRaw('count(*) as total, avg(rating) as average')->first();
                DB::table('integration_review_sources')->where('id', $row->id)->update([
                    'status' => 'conectado',
                    'last_sync_at' => now(),
                    'review_count' => max((int) $row->review_count, (int) $stats->total),
                    'rating' => $row->rating ?? ($stats->average !== null ? round((float) $stats->average, 2) : null),
                    'updated_by' => $actor->getKey(),
                    'updated_at' => now(),
                ]);
                $this->audit->log(self::ENTITY, $provider, 'sincronizar', null, "{$created} nuevas · {$updated} actualizadas");

                return ['provider' => $provider, 'created' => $created, 'updated' => $updated, 'source' => $this->one($provider)];
            });
        } finally {
            $lock->release();
        }
    }

    private function one(string $provider): array
    {
        return collect($this->list())->firstWhere('provider', $provider) ?? throw ApiException::notFound('La plataforma no existe.');
    }

    private function source(string $provider, bool $lock = false): stdClass
    {
        if (! array_key_exists($provider, ExternalReviewDirectory::PROVIDERS)) {
            throw ApiException::notFound('La plataforma no existe.');
        }

        $query = DB::table('integration_review_sources')->where('provider', $provider);
        $row = $lock ? $query->lock('for no key update')->first() : $query->first();

        if (! $row instanceof stdClass) {
            throw ApiException::notFound('La plataforma no está conectada.');
        }

        return $row;
    }
}
