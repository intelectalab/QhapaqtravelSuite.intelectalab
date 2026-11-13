<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\ShowcaseDirectory;
use App\Domain\Showcase\Support\ShowcaseSequence;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageShowcaseListings
{
    public function __construct(
        private readonly ShowcaseDirectory $directory,
        private readonly ShowcaseSequence $sequence,
        private readonly ManageShowcaseAgencies $agencies,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
        private readonly PlatformSession $session,
    ) {}

    public function create(array $data): string
    {
        $this->assertContent($data);
        $tenantId = $this->context->idOrFail();
        $productRef = $this->productRef($data['product'] ?? null);

        $code = $this->db()->transaction(function () use ($data, $tenantId, $productRef): string {
            $agency = $this->agencies->forTenant($tenantId, (string) $data['city']);
            $code = $this->sequence->next(ShowcaseSequence::LISTING);
            $this->db()->table('platform_showcase_listings')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'agency_id' => $agency->id,
                'slug' => $this->slug((string) $data['title']),
                ...$this->fields($data),
                'tenant_product_ref' => $productRef,
                'status' => 'en_revision',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $code;
        });
        $this->audit->log('Vitrina', $code, 'enviar_revision', null, (string) $data['title']);

        return $code;
    }

    public function update(string $code, array $data): array
    {
        $listing = $this->owned($code);
        $action = $data['action'] ?? 'editar';

        [$status, $changes] = match ($action) {
            'pausar' => $listing->status === 'publicado' ? ['despublicado', []] : throw ApiException::conflict('VT-PAUSE', 'Solo se pausa una publicación que está publicada.'),
            'reanudar' => $listing->status === 'despublicado' ? [$listing->published_at !== null ? 'publicado' : 'en_revision', []] : throw ApiException::conflict('VT-RESUME', 'Solo se reanuda una publicación pausada.'),
            default => ['en_revision', $this->editable($data, $listing)],
        };

        $this->db()->table('platform_showcase_listings')->where('id', $listing->id)->update([...$changes, 'status' => $status, 'reject_reason' => null, 'updated_at' => now()]);
        $this->audit->log('Vitrina', $code, $action, $listing->status, $status);

        return ['code' => $code, 'status' => $status];
    }

    public function decide(string $code, string $decision, ?string $reason, PlatformUser $actor): array
    {
        return $this->db()->transaction(function () use ($code, $decision, $reason, $actor): array {
            $listing = $this->db()->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')
                ->where('l.code', $code)->lock('for no key update of l')->first(['l.id', 'l.status', 'l.title', 'a.status as agency_status', 'a.name as agency_name'])
                ?? throw ApiException::notFound('La publicación no existe.');

            if ($listing->status !== 'en_revision') {
                throw ApiException::conflict('VT-01', 'Solo se modera una publicación que está en revisión.');
            }

            if ($decision === 'aprobar' && $listing->agency_status !== 'activa') {
                throw ApiException::unprocessable('VT-01', "Verifica primero la agencia {$listing->agency_name}: sin RUC y licencia verificados no se publica.");
            }

            if ($decision === 'rechazar' && blank($reason)) {
                throw ApiException::unprocessable('VT-01', 'Indica el motivo del rechazo. Se envía a la agencia.', ['field' => 'reason']);
            }

            $status = $decision === 'aprobar' ? 'publicado' : 'rechazado';
            $this->db()->table('platform_showcase_listings')->where('id', $listing->id)->update([
                'status' => $status,
                'reject_reason' => $status === 'rechazado' ? mb_substr(trim((string) $reason), 0, 500) : null,
                'published_at' => $status === 'publicado' ? now() : null,
                'updated_at' => now(),
            ]);
            $this->session->log('Vitrina', $code, $decision, 'en_revision', $status === 'rechazado' ? "rechazado · {$reason}" : 'publicado', $actor);

            return ['code' => $code, 'status' => $status];
        });
    }

    private function owned(string $code): object
    {
        $agency = $this->directory->agencyFor($this->context->idOrFail()) ?? throw ApiException::notFound('La publicación no existe.');

        return $this->db()->table('platform_showcase_listings')->where('code', $code)->where('agency_id', $agency->id)->first() ?? throw ApiException::notFound('La publicación no existe.');
    }

    private function editable(array $data, object $listing): array
    {
        $arrays = $this->db()->table('platform_showcase_listings')->where('id', $listing->id)->selectRaw('array_to_json(languages) as languages, array_to_json(start_times) as start_times, array_to_json(highlights) as highlights')->first();
        $merged = [
            'title' => $data['title'] ?? $listing->title,
            'city' => $data['city'] ?? $listing->city,
            'zone' => array_key_exists('zone', $data) ? $data['zone'] : $listing->zone,
            'theme' => array_key_exists('theme', $data) ? $data['theme'] : $listing->theme,
            'languages' => $data['languages'] ?? PgArray::parse($arrays->languages ?? null),
            'start_times' => $data['start_times'] ?? PgArray::parse($arrays->start_times ?? null),
            'highlights' => $data['highlights'] ?? PgArray::parse($arrays->highlights ?? null),
            'duration_hours' => $data['duration_hours'] ?? $listing->duration_hours,
            'meeting_point' => $data['meeting_point'] ?? $listing->meeting_point,
            'model' => $data['model'] ?? $listing->model,
            'price' => $data['price'] ?? $listing->price,
            'capacity' => $data['capacity'] ?? $listing->capacity,
            'own_content' => true,
        ];
        $this->assertContent($merged);
        $fields = $this->fields($merged);

        if (array_key_exists('product', $data)) {
            $fields['tenant_product_ref'] = $this->productRef($data['product']);
        }

        return $fields;
    }

    private function assertContent(array $data): void
    {
        if (empty($data['own_content'])) {
            throw ApiException::unprocessable('VT-01', 'Declara que las fotos y los textos son propios para enviar a revisión.', ['field' => 'own_content']);
        }

        $price = Decimal::money($data['price'] ?? 0);

        if (($data['model'] ?? 'propina') === 'pago' && ! $price->isPositive()) {
            throw ApiException::unprocessable('VT-PRICE', 'Un tour de pago necesita un precio por persona mayor que cero.', ['field' => 'price']);
        }
    }

    private function fields(array $data): array
    {
        $paid = ($data['model'] ?? 'propina') === 'pago';

        return [
            'title' => trim((string) $data['title']),
            'city' => Str::lower(trim((string) $data['city'])),
            'zone' => blank($data['zone'] ?? null) ? null : trim((string) $data['zone']),
            'theme' => blank($data['theme'] ?? null) ? null : trim((string) $data['theme']),
            'languages' => PgArray::literal(array_values(array_unique(array_map(fn ($l) => Str::lower((string) $l), $data['languages'] ?? ['es'])))),
            'start_times' => PgArray::literal(array_values(array_unique($data['start_times']))),
            'highlights' => PgArray::literal(array_values(array_filter(array_map(fn ($h) => trim((string) $h), $data['highlights'] ?? [])))),
            'duration_hours' => (string) $data['duration_hours'],
            'meeting_point' => trim((string) $data['meeting_point']),
            'model' => $paid ? 'pago' : 'propina',
            'price' => $paid ? (string) Decimal::money($data['price']) : '0',
            'capacity' => (int) ($data['capacity'] ?? 20),
        ];
    }

    private function productRef(?string $code): ?string
    {
        if (blank($code)) {
            return null;
        }

        return DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->value('id') ?? throw ApiException::unprocessable('VT-PRODUCT', 'Elige un producto de tu catálogo.', ['field' => 'product']);
    }

    private function slug(string $title): string
    {
        $base = Str::limit(Str::slug($title), 140, '') ?: 'tour';
        $slug = $base;
        $n = 2;

        while ($this->db()->table('platform_showcase_listings')->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$n++;
        }

        return $slug;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
