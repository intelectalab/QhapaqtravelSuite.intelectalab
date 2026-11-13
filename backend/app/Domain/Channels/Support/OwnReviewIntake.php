<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class OwnReviewIntake
{
    private const PERSONAL = '/[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{7,}\d|\b[A-Z]{1,2}\d{6,9}\b/u';

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly RuleResolver $rules,
    ) {}

    public static function rules(): array
    {
        return [
            'product' => ['required', 'string', 'max:40'],
            'stars' => ['required', 'integer', 'between:1,5'],
            'subratings' => ['nullable', 'array'],
            'subratings.*' => ['integer', 'between:1,5'],
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'body' => ['required', 'string', 'min:20', 'max:2000'],
            'lang' => ['nullable', 'in:es,en,de,fr,pt'],
            'country' => ['nullable', 'string', 'max:60'],
            'consent_publish' => ['nullable', 'boolean'],
            'photos' => ['nullable', 'array', 'max:'.self::MAX_PHOTOS],
            'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_PHOTO_KB],
        ];
    }

    public const MAX_PHOTOS = 4;

    public const MAX_PHOTO_KB = 5120;

    private function storePhotos(array $files): array
    {
        $folder = 'reviews/'.app(TenantContext::class)->idOrFail().'/'.Str::uuid7();

        return collect($files)->filter(fn (mixed $file): bool => $file instanceof UploadedFile && $file->isValid())->take(self::MAX_PHOTOS)->values()
            ->map(fn (UploadedFile $file, int $index): string => (string) Storage::disk(config('filesystems.default'))->putFileAs($folder, $file, ($index + 1).'.'.strtolower($file->extension() ?: 'jpg')))
            ->filter()->values()->all();
    }

    public static function messages(): array
    {
        return [
            'product.*' => 'Elige qué quieres calificar.',
            'stars.*' => 'Elige de 1 a 5 estrellas.',
            'subratings.*' => 'Cada aspecto va de 1 a 5.',
            'title.*' => 'Escribe un título (3 a 120 caracteres).',
            'body.*' => 'Cuéntanos tu experiencia (20 a 2000 caracteres).',
            'lang.*' => 'Elige el idioma de la reseña.',
        ];
    }

    public function ensureEnabled(string $message): void
    {
        if (! $this->rules->on('R-OWN-REVIEWS')) {
            throw ApiException::forbidden('RVW-01', $message);
        }
    }

    public static function subratings(): array
    {
        $settings = OwnReviewSettings::read();

        return collect($settings['active_subratings'])->filter(fn (string $key): bool => isset(OwnReviewSettings::SUBRATINGS[$key]))
            ->map(fn (string $key): array => ['key' => $key, 'label' => OwnReviewSettings::SUBRATINGS[$key]])->values()->all();
    }

    public static function items(object $reservation, ?string $createdBy, bool $anyAuthor = false): array
    {
        $today = CarbonImmutable::now('America/Lima')->toDateString();
        $services = DB::table('booking_reservation_services as s')->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->where('s.reservation_id', $reservation->id)->whereNotIn('s.status', ['cancelado', 'rechazado'])
            ->orderBy('s.service_date')->get(['p.id', 'p.code', 'p.name', 's.status', 's.service_date']);
        $reviews = DB::table('crm_own_reviews')->where('reservation_id', $reservation->id)->whereNull('deleted_at')
            ->when(! $anyAuthor, fn ($query) => $query->where('created_by', $createdBy))
            ->when($anyAuthor, fn ($query) => $query->whereNull('passenger_id'))
            ->get(['product_id', 'code', 'stars', 'title', 'status'])->keyBy('product_id');
        $items = [];

        foreach ($services->groupBy('id') as $productId => $rows) {
            $first = $rows->first();
            $done = $reservation->status === 'completada' || (in_array($reservation->status, ['en_operacion', 'incidencia', 'parcial'], true) && $rows->contains(fn (object $row): bool => $row->status === 'completado' || $row->service_date < $today));
            $review = $reviews->get($productId);
            $items[] = [
                'product' => ['id' => (string) $productId, 'code' => $first->code, 'name' => $first->name],
                'date' => (string) $rows->max('service_date'),
                'eligible' => $done && $review === null,
                'reason' => $review !== null ? null : ($done ? null : (in_array($reservation->status, ['cancelada', 'borrador'], true) ? 'Este viaje no se realizó.' : 'Podrás calificarlo cuando termine el servicio.')),
                'review' => $review ? ['code' => $review->code, 'stars' => (int) $review->stars, 'title' => $review->title, 'status' => $review->status] : null,
            ];
        }

        return $items;
    }

    public static function pick(array $items, string $product): array
    {
        $item = collect($items)->firstWhere('product.code', $product)
            ?? throw ApiException::unprocessable('RVW-02', 'Ese producto no es parte de tu viaje.', ['product' => ['Ese producto no es parte de tu viaje.']]);

        if (! $item['eligible']) {
            throw ApiException::unprocessable('RVW-02', $item['reason'] ?? ($item['review'] !== null ? 'Ya calificaste este servicio. Gracias.' : 'Todavía no puedes calificar este servicio.'));
        }

        return $item;
    }

    public function record(object $reservation, array $item, array $data, array $author): array
    {
        $settings = OwnReviewSettings::read();
        $body = trim((string) $data['body']);
        $title = trim((string) $data['title']);
        $alerts = [];

        if ($settings['personal_data'] === 'enmascarar') {
            $body = (string) preg_replace(self::PERSONAL, '[dato oculto]', $body);
            $title = (string) preg_replace(self::PERSONAL, '[dato oculto]', $title);
        } elseif (preg_match(self::PERSONAL, $title.' '.$body) === 1) {
            $alerts[] = 'Incluye datos personales';
        }

        $text = mb_strtolower($title.' '.$body);
        $banned = array_values(array_filter($settings['banned_words'], fn (string $word): bool => $word !== '' && str_contains($text, mb_strtolower($word))));
        if ($banned !== []) {
            $alerts[] = 'Palabras no permitidas: '.implode(', ', $banned);
        }

        $consent = (bool) ($data['consent_publish'] ?? false);
        $stars = (int) $data['stars'];
        $minStars = (int) ($this->rules->param('R-OWN-REVIEWS', 'minStarsAutoPublish') ?? 4);
        $moderation = (bool) ($this->rules->param('R-OWN-REVIEWS', 'moderation') ?? true);
        $status = match (true) {
            ! $consent => 'oculta',
            $alerts === [] && $stars >= $minStars && (! $moderation || $settings['auto_publish']) => 'publicada',
            default => 'pendiente',
        };
        $active = $settings['active_subratings'];
        $subratings = collect($data['subratings'] ?? [])->filter(fn ($value, $key): bool => in_array($key, $active, true))->map(fn ($value): int => (int) $value)->all();
        $parts = preg_split('/\s+/', trim($author['name'])) ?: [$author['name']];
        $display = count($parts) > 1 ? $parts[0].' '.mb_substr((string) end($parts), 0, 1).'.' : $parts[0];

        $photos = $this->storePhotos((array) ($data['photos'] ?? []));

        return DB::transaction(function () use ($reservation, $item, $data, $subratings, $title, $body, $consent, $stars, $status, $alerts, $display, $author, $photos): array {
            $code = $this->codes->next('crm_own_reviews', 'RVO-', 4);
            $requestId = $author['request_id'] ?? DB::table('crm_review_requests')->where('reservation_id', $reservation->id)->whereIn('status', ['programada', 'enviada', 'abierta'])->value('id');
            $id = (string) DB::table('crm_own_reviews')->insertGetId([
                'code' => $code,
                'reservation_id' => $reservation->id,
                'product_id' => $item['product']['id'],
                'client_id' => $author['client_id'],
                'author_display' => mb_substr($display, 0, 80),
                'author_name' => mb_substr($author['name'], 0, 160),
                'country' => $data['country'] ?? null,
                'travel_date' => $item['date'],
                'stars' => $stars,
                'subratings' => json_encode((object) $subratings),
                'title' => $title,
                'body' => $body,
                'lang' => $data['lang'] ?? 'es',
                'verified' => true,
                'consent_publish' => $consent,
                'status' => $status,
                'moderation_reason' => $alerts === [] ? null : implode(' · ', $alerts),
                'photos' => json_encode($photos),
                'source' => $author['source'],
                'request_id' => $requestId,
                'published_at' => $status === 'publicada' ? now() : null,
                'created_by' => $author['user_id'],
                'updated_by' => $author['user_id'],
            ], 'id');
            DB::table('crm_own_review_log')->insert(['review_id' => $id, 'action' => 'crear', 'note' => $alerts === [] ? null : implode(' · ', $alerts), 'user_id' => $author['user_id']]);
            if ($status === 'publicada') {
                DB::table('crm_own_review_log')->insert(['review_id' => $id, 'action' => 'autopublicar', 'note' => null, 'user_id' => null]);
            }
            if ($requestId !== null) {
                DB::table('crm_review_requests')->where('id', $requestId)->update(['status' => 'respondida', 'updated_at' => now()]);
            }
            $this->audit->log('Reseña propia', $code, 'crear', null, "{$stars} estrellas · {$status}");

            return ['code' => $code, 'status' => $status];
        });
    }
}
