<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Actions;

use App\Domain\Channels\Actions\ManageCmsContent;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\SiteContentAi;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\SiteTemplates\Support\AiCredits;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use stdClass;
use Throwable;

final class AiContent
{
    public const AUDIT = 'Contenido con IA';

    public const AUDIT_IMAGES = 'Imágenes con IA';

    public const AUDIT_CREDITS = 'Créditos de IA';

    public const KINDS = ['mejorar_texto' => 'Mejorar descripción', 'meta_seo' => 'Título y meta SEO', 'traducir' => 'Traducir', 'relato_aventura' => 'Relato de aventura', 'articulo' => 'Artículo de blog', 'imagen' => 'Imágenes'];

    public const KIND_TARGETS = ['mejorar_texto' => ['producto'], 'meta_seo' => ['producto', 'pagina'], 'traducir' => ['producto'], 'relato_aventura' => ['historia'], 'articulo' => ['libre']];

    public const TONES = ['cercano' => 'Cercano', 'profesional' => 'Profesional', 'aventurero' => 'Aventurero', 'lujo' => 'Lujo', 'familiar' => 'Familiar'];

    public const LOCALES = ['es' => 'Español', 'en' => 'Inglés', 'pt' => 'Portugués'];

    public const STATUSES = ['en_cola' => 'En cola', 'procesando' => 'Procesando', 'listo' => 'Por revisar', 'aplicado' => 'Aplicado', 'descartado' => 'Descartado', 'fallido' => 'Fallido (sin cobro)'];

    public const STYLES = ['fotografico' => 'Fotográfico', 'ilustracion' => 'Ilustración', 'acuarela' => 'Acuarela', 'mapa' => 'Mapa ilustrado', 'textil' => 'Patrón textil andino'];

    public const QUALITIES = ['std' => 1024, 'hd' => 2048];

    public const IMAGE_COUNTS = [1, 2, 4];

    public const IMAGE_USES = ['Banner de inicio', 'Galería de un tour', 'Artículo del blog', 'Historia de aventura'];

    public const BLOCKED_WORDS = ['logo', 'logotipo', 'marca registrada', 'famoso', 'famosa', 'celebridad', 'presidente', 'futbolista'];

    public const WARNING = 'Revise cifras, horarios y precios antes de aplicar.';

    public function __construct(
        private readonly TenantContext $context,
        private readonly AiCredits $credits,
        private readonly SiteContentAi $ai,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly ManageCmsContent $cms,
    ) {}

    public function options(): array
    {
        $products = DB::table('catalog_products')->whereNull('deleted_at')->where('status', '<>', 'INACTIVO')->orderBy('name')->limit(80)->get(['id', 'code', 'name']);
        $pages = DB::table('cms_seo_pages')->orderBy('path')->limit(80)->get(['id', 'path', 'title']);
        $stories = DB::table('cms_travel_stories')->whereNotNull('consent_at')->whereNull('consent_revoked_at')->orderByDesc('created_at')->limit(40)->get(['id', 'slug', 'title']);

        return [
            'kinds' => self::KINDS,
            'kind_targets' => self::KIND_TARGETS,
            'tones' => self::TONES,
            'locales' => self::LOCALES,
            'styles' => self::STYLES,
            'qualities' => self::QUALITIES,
            'image_counts' => self::IMAGE_COUNTS,
            'image_uses' => self::IMAGE_USES,
            'statuses' => self::STATUSES,
            'targets' => [
                'producto' => $products->map(fn (stdClass $row): array => ['id' => $row->id, 'code' => $row->code, 'label' => $row->name])->all(),
                'pagina' => $pages->map(fn (stdClass $row): array => ['id' => $row->id, 'code' => $row->path, 'label' => $row->title.' ('.$row->path.')'])->all(),
                'historia' => $stories->map(fn (stdClass $row): array => ['id' => $row->id, 'code' => $row->slug, 'label' => $row->title])->all(),
            ],
        ];
    }

    public function list(array $filters): array
    {
        $rows = DB::table('cms_ai_content_jobs')
            ->when($filters['kind'] ?? null, fn ($query, $kind) => $query->where('kind', $kind))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('created_at')->limit(300)->get();
        $users = DB::table('iam_users')->whereIn('id', $rows->pluck('created_by')->filter()->unique()->all())->pluck('name', 'id');

        return $rows->map(fn (stdClass $row): array => $this->present($row, $users[$row->created_by] ?? null))->all();
    }

    public function show(string $code): array
    {
        $row = $this->job($code);

        return $this->present($row, $row->created_by ? DB::table('iam_users')->where('id', $row->created_by)->value('name') : null, true);
    }

    public function create(array $data, User $user): array
    {
        $kind = (string) $data['kind'];
        $type = (string) $data['target_type'];

        if (! in_array($type, self::KIND_TARGETS[$kind] ?? [], true)) {
            throw ApiException::unprocessable('AI_TARGET_INVALID', 'Ese tipo de pedido no aplica a '.$type.'.', ['allowed' => self::KIND_TARGETS[$kind] ?? []]);
        }

        $locale = (string) ($data['locale'] ?? 'es');

        if ($kind === 'traducir' && $locale === 'es') {
            throw ApiException::unprocessable('AI_TARGET_INVALID', 'Elija el idioma al que quiere traducir: inglés o portugués.');
        }

        $target = $this->target($kind, $type, $data['target_id'] ?? null, $data['notes'] ?? null);
        $cost = $this->cost($kind, $target);
        $this->credits->ensure('contenido', $cost);

        return $this->generate($kind, $type, $target, $locale, $data['tone'] ?? null, $data['notes'] ?? null, $cost, 0, $user);
    }

    public function regenerate(string $code, User $user): array
    {
        $job = $this->job($code);

        if ($job->kind === 'imagen' || ! in_array($job->status, ['listo', 'descartado', 'fallido'], true)) {
            throw ApiException::unprocessable('AI_JOB_STATE', 'Solo se pide otra versión de un texto listo, descartado o fallido.');
        }

        $input = $this->decode($job->input);
        $target = $this->target($job->kind, $job->target_type, $job->target_id, $input['notes'] ?? null);
        $cost = $this->cost($job->kind, $target);
        $this->credits->ensure('contenido', $cost);

        if ($job->status === 'listo') {
            DB::table('cms_ai_content_jobs')->where('id', $job->id)->update(['status' => 'descartado']);
            $this->audit->log(self::AUDIT, $job->code, 'descartar', 'listo', 'Reemplazado por otra versión');
        }

        return $this->generate($job->kind, $job->target_type, $target, $job->locale, $job->tone, $input['notes'] ?? null, $cost, (int) ($input['attempt'] ?? 0) + 1, $user, $job->code);
    }

    public function apply(string $code, User $user): array
    {
        return DB::transaction(function () use ($code, $user): array {
            $job = DB::table('cms_ai_content_jobs')->where('code', $code)->lock('for no key update')->first();

            if ($job === null) {
                throw ApiException::notFound('Ese pedido no existe.');
            }

            if ($job->kind === 'imagen' || $job->status !== 'listo') {
                throw ApiException::unprocessable('AI_JOB_STATE', 'Solo se aplica un resultado listo para revisar.');
            }

            $output = $this->decode($job->output);
            $after = (array) ($output['after'] ?? []);
            $input = $this->decode($job->input);
            $before = (array) ($input['source']['before'] ?? []);
            $reference = $this->write($job, $after, $user);
            DB::table('cms_ai_content_jobs')->where('id', $job->id)->update(['status' => 'aplicado', 'applied_at' => now()->utc(), 'output' => json_encode([...$output, 'applied_ref' => $reference], JSON_UNESCAPED_UNICODE)]);
            $this->audit->log(self::AUDIT, $job->code, 'aplicar', $this->flatten($before), $this->flatten($after), ['target' => $job->target_type, 'reference' => $reference, 'antes' => $before, 'despues' => $after]);

            return $this->present(DB::table('cms_ai_content_jobs')->where('id', $job->id)->first(), $user->name, true);
        });
    }

    public function discard(string $code): array
    {
        $job = $this->job($code);

        if ($job->status !== 'listo') {
            throw ApiException::unprocessable('AI_JOB_STATE', 'Solo se descarta un resultado listo para revisar.');
        }

        DB::transaction(function () use ($job): void {
            DB::table('cms_ai_content_jobs')->where('id', $job->id)->update(['status' => 'descartado']);
            $this->audit->log($job->kind === 'imagen' ? self::AUDIT_IMAGES : self::AUDIT, $job->code, 'descartar', 'listo', 'descartado');
        });

        return $this->show($code);
    }

    public function createImages(array $data, User $user): array
    {
        $prompt = trim((string) $data['prompt']);
        $lower = mb_strtolower($prompt);

        foreach (self::BLOCKED_WORDS as $word) {
            if (preg_match('/\b'.preg_quote($word, '/').'\b/u', $lower) === 1) {
                throw ApiException::unprocessable('AI_IMAGE_REJECTED', 'El pedido menciona marcas o personas reales. Reformúlelo: no se generan personas identificables, logotipos de terceros ni lugares falsos.');
            }
        }

        $count = (int) $data['count'];
        $quality = (string) $data['quality'];
        $unit = AiCredits::COSTS[$quality === 'hd' ? 'imagen_hd' : 'imagen'];
        $cost = $count * $unit;
        $this->credits->ensure('imagenes', $cost);
        $style = (string) $data['style'];
        $size = self::QUALITIES[$quality];

        return DB::transaction(function () use ($prompt, $count, $quality, $unit, $cost, $style, $size, $user): array {
            $id = (string) Str::uuid7();
            $code = $this->sequences->next('ai_content_job');
            DB::table('cms_ai_content_jobs')->insert(['id' => $id, 'code' => $code, 'kind' => 'imagen', 'target_type' => 'libre', 'locale' => 'es', 'input' => json_encode(['prompt' => $prompt, 'style' => $style, 'count' => $count, 'quality' => $quality, 'cost' => $cost], JSON_UNESCAPED_UNICODE), 'status' => 'procesando', 'created_by' => $user->getKey()]);
            $disk = (string) config('filesystems.default');
            $images = [];

            for ($index = 0; $index < $count; $index++) {
                $imageId = (string) Str::uuid7();
                $path = "tenants/{$this->context->idOrFail()}/ai-images/{$imageId}.".($this->ai->imageMime() === 'image/svg+xml' ? 'svg' : 'png');
                Storage::disk($disk)->put($path, $this->ai->draw($prompt, $style, $size, (int) round($size * 0.6), $index));
                DB::table('cms_ai_images')->insert(['id' => $imageId, 'job_id' => $id, 'prompt' => $prompt, 'style' => $style, 'width' => $size, 'height' => (int) round($size * 0.6), 'file_path' => $path, 'alt_text' => mb_substr($prompt, 0, 120), 'ai_label' => true, 'credits_used' => $unit, 'status' => 'generada', 'used_in' => '[]', 'created_by' => $user->getKey()]);
                $images[] = $imageId;
            }

            DB::table('cms_ai_content_jobs')->where('id', $id)->update(['status' => 'listo', 'output' => json_encode(['images' => $images, 'provider' => $this->ai->provider()]), 'credits_used' => $cost]);
            $this->credits->append('imagenes', 'consumo', -$cost, null, $id, $code.' · '.$count.' '.($count === 1 ? 'imagen' : 'imágenes').($quality === 'hd' ? ' HD' : ''), $user->getKey());
            $this->audit->log(self::AUDIT_IMAGES, $code, 'generar', null, $count.' · '.$cost.' créditos');

            return ['job' => $code, 'credits_used' => $cost, 'balance' => $this->credits->balance('imagenes'), 'images' => array_map(fn (string $imageId): array => $this->presentImage(DB::table('cms_ai_images')->where('id', $imageId)->first()), $images)];
        });
    }

    public function images(): array
    {
        return DB::table('cms_ai_images')->orderByDesc('created_at')->limit(120)->get()->map($this->presentImage(...))->all();
    }

    public function updateImage(string $id, array $data): array
    {
        $image = Str::isUuid($id) ? DB::table('cms_ai_images')->where('id', $id)->first() : null;

        if ($image === null) {
            throw ApiException::notFound('Esa imagen no existe.');
        }

        $action = $data['action'] ?? null;

        if ($action !== null && $image->status !== 'generada') {
            throw ApiException::unprocessable('AI_IMAGE_STATE', $image->status === 'en_uso' ? 'La imagen ya está en uso.' : 'La imagen fue descartada.');
        }

        if ($action === null && $image->status === 'descartada') {
            throw ApiException::unprocessable('AI_IMAGE_STATE', 'La imagen fue descartada.');
        }

        $values = [];

        if (isset($data['alt_text'])) {
            $values['alt_text'] = trim((string) $data['alt_text']);
        }

        if ($action === 'usar') {
            $values['status'] = 'en_uso';
            $values['used_in'] = json_encode([...$this->decode($image->used_in), (string) $data['used_in']], JSON_UNESCAPED_UNICODE);
        }

        if ($action === 'descartar') {
            $values['status'] = 'descartada';
        }

        DB::transaction(function () use ($image, $values, $action, $data): void {
            DB::table('cms_ai_images')->where('id', $image->id)->update($values);
            $this->audit->log(self::AUDIT_IMAGES, $image->id, match ($action) {
                'usar' => 'usar',
                'descartar' => 'descartar',
                default => 'editar texto alternativo',
            }, $action === null ? $image->alt_text : $image->status, $action === 'usar' ? (string) $data['used_in'] : ($values['alt_text'] ?? ($values['status'] ?? null)));
        });

        return $this->presentImage(DB::table('cms_ai_images')->where('id', $image->id)->first());
    }

    public function imageFile(string $id): ?stdClass
    {
        $image = Str::isUuid($id) ? DB::table('cms_ai_images')->where('id', $id)->first() : null;

        return $image !== null && Storage::disk((string) config('filesystems.default'))->exists((string) $image->file_path) ? $image : null;
    }

    public function purchasePack(string $code, User $user): array
    {
        $pack = $this->credits->pack($code);

        if (! $pack->active) {
            throw ApiException::unprocessable('AI_PACK_INACTIVE', 'Ese paquete ya no está a la venta.');
        }

        $isPlan = $this->credits->isPlan($pack);

        if ($isPlan && $this->credits->contractedPlan()?->id === $pack->id) {
            throw ApiException::conflict('AI_PLAN_ACTIVE', 'Ya tiene contratado '.$pack->name.'.');
        }

        return DB::transaction(function () use ($pack, $isPlan, $user): array {
            $price = number_format((float) $pack->price, 2, '.', '');
            $note = ($isPlan ? 'Plan ' : 'Paquete ').$pack->name.' · '.$pack->currency.' '.$price.($pack->billing === 'mensual' ? ' al mes' : '');
            $this->credits->append($pack->kind, 'compra_paquete', (int) $pack->credits, $pack->id, null, $note, $user->getKey());

            if (($bonus = AiCredits::PLAN_IMAGE_BONUS[$pack->code] ?? 0) > 0) {
                $this->credits->append('imagenes', 'compra_paquete', $bonus, $pack->id, null, $note, $user->getKey());
            }

            $this->audit->log(self::AUDIT_CREDITS, $pack->code, $isPlan ? 'contratar' : 'comprar', null, $note);

            return ['pack' => $this->credits->presentPack($pack), 'summary' => $this->credits->summary()];
        });
    }

    private function generate(string $kind, string $type, array $target, string $locale, ?string $tone, ?string $notes, int $cost, int $attempt, User $user, ?string $replaces = null): array
    {
        $id = (string) Str::uuid7();
        $code = DB::transaction(function () use ($id, $kind, $type, $target, $locale, $tone, $notes, $cost, $attempt, $user, $replaces): string {
            $code = $this->sequences->next('ai_content_job');
            DB::table('cms_ai_content_jobs')->insert([
                'id' => $id,
                'code' => $code,
                'kind' => $kind,
                'target_type' => $type,
                'target_id' => $target['id'],
                'locale' => $locale,
                'tone' => $tone,
                'input' => json_encode(['source' => $target, 'notes' => $notes, 'cost' => $cost, 'attempt' => $attempt, 'replaces' => $replaces], JSON_UNESCAPED_UNICODE),
                'status' => 'en_cola',
                'created_by' => $user->getKey(),
            ]);
            $this->audit->log(self::AUDIT, $code, 'pedir', null, self::KINDS[$kind].' · '.$target['label'].' · '.$cost.' '.($cost === 1 ? 'crédito' : 'créditos'));

            return $code;
        });

        $this->process($id, $kind, $target, $locale, $tone, $notes, $cost, $attempt, $user);

        return $this->show($code);
    }

    private function process(string $id, string $kind, array $target, string $locale, ?string $tone, ?string $notes, int $cost, int $attempt, User $user): void
    {
        DB::table('cms_ai_content_jobs')->where('id', $id)->update(['status' => 'procesando']);

        try {
            $result = $this->ai->write($kind, $target, ['locale' => $locale, 'tone' => $tone, 'notes' => $notes, 'attempt' => $attempt]);
        } catch (Throwable $e) {
            report($e);
            DB::table('cms_ai_content_jobs')->where('id', $id)->update(['status' => 'fallido', 'error' => 'El proveedor de IA no respondió. No se descontaron créditos.', 'credits_used' => 0]);

            return;
        }

        DB::transaction(function () use ($id, $result, $cost, $user): void {
            $code = (string) DB::table('cms_ai_content_jobs')->where('id', $id)->value('code');
            $this->credits->append('contenido', 'consumo', -$cost, null, $id, $code, $user->getKey());
            DB::table('cms_ai_content_jobs')->where('id', $id)->update([
                'status' => 'listo',
                'credits_used' => $cost,
                'output' => json_encode(['after' => $result['after'], 'model' => $result['model'] ?? null, 'provider' => $this->ai->provider(), 'tokens_in' => (int) ($result['tokens_in'] ?? 0), 'tokens_out' => (int) ($result['tokens_out'] ?? 0), 'warning' => self::WARNING], JSON_UNESCAPED_UNICODE),
            ]);
        });
    }

    private function target(string $kind, string $type, ?string $reference, ?string $notes): array
    {
        if ($type === 'libre') {
            $tours = DB::table('catalog_products')->whereNull('deleted_at')->where('status', '<>', 'INACTIVO')->orderByDesc('is_featured')->orderBy('name')->limit(3)->pluck('name')->all();

            return ['id' => null, 'label' => 'Artículo nuevo', 'agency' => $this->context->tenant()->commercial_name, 'before' => ['text' => trim((string) $notes) ?: 'Tema libre'], 'facts' => ['tours' => $tours]];
        }

        $reference = trim((string) $reference);

        if ($reference === '') {
            throw ApiException::unprocessable('AI_TARGET_INVALID', 'Elija sobre qué quiere el contenido.');
        }

        return match ($type) {
            'producto' => $this->product($kind, $reference),
            'pagina' => $this->page($reference),
            default => $this->story($reference),
        };
    }

    private function product(string $kind, string $reference): array
    {
        $product = DB::table('catalog_products')->whereNull('deleted_at')->where(fn ($query) => Str::isUuid($reference) ? $query->where('id', $reference) : $query->where('code', $reference))->first();

        if ($product === null) {
            throw ApiException::notFound('Ese producto no existe.');
        }

        $includes = DB::table('catalog_product_inclusions')->where('product_id', $product->id)->where('kind', 'include')->orderBy('sort_order')->limit(6)->pluck('text')->all();
        $before = $kind === 'meta_seo' ? ['title' => (string) ($product->seo_title ?: $product->name), 'desc' => (string) ($product->seo_description ?? '')] : ['text' => (string) ($product->short_description ?? '')];

        return ['id' => $product->id, 'code' => $product->code, 'label' => $product->name, 'agency' => $this->context->tenant()->commercial_name, 'before' => $before, 'facts' => ['includes' => $includes, 'meeting' => $product->pickup_text, 'words' => str_word_count((string) $product->short_description.' '.(string) $product->long_description)]];
    }

    private function page(string $reference): array
    {
        $page = DB::table('cms_seo_pages')->where(fn ($query) => Str::isUuid($reference) ? $query->where('id', $reference) : $query->where('path', $reference))->first();

        if ($page === null) {
            throw ApiException::notFound('Esa página no existe.');
        }

        return ['id' => $page->id, 'code' => $page->path, 'label' => $page->title, 'agency' => $this->context->tenant()->commercial_name, 'before' => ['title' => (string) $page->title, 'desc' => (string) ($page->meta_description ?? '')], 'facts' => ['path' => $page->path]];
    }

    private function story(string $reference): array
    {
        $story = DB::table('cms_travel_stories')->where(fn ($query) => Str::isUuid($reference) ? $query->where('id', $reference) : $query->where('slug', $reference))->first();

        if ($story === null) {
            throw ApiException::notFound('Esa historia no existe.');
        }

        if ($story->consent_at === null || $story->consent_revoked_at !== null) {
            throw ApiException::unprocessable('AI_STORY_CONSENT', 'Esta historia no tiene el consentimiento vigente del viajero: no se puede escribir un relato con IA.');
        }

        return ['id' => $story->id, 'code' => $story->slug, 'label' => $story->title, 'agency' => $this->context->tenant()->commercial_name, 'before' => ['text' => (string) ($story->body ?: $story->quote ?: '')], 'facts' => ['city' => $story->city, 'quote' => $story->quote]];
    }

    private function cost(string $kind, array $target): int
    {
        $base = AiCredits::COSTS[$kind];

        return $kind === 'traducir' ? $base * max(1, (int) ceil(((int) ($target['facts']['words'] ?? 0)) / 1000)) : $base;
    }

    private function write(stdClass $job, array $after, User $user): ?string
    {
        if ($job->kind === 'articulo') {
            $title = (string) ($after['title'] ?? 'Artículo con IA');

            return $this->cms->create(['title' => mb_substr($title, 0, 160), 'type' => 'Artículo', 'channel' => 'Web', 'body' => (string) ($after['text'] ?? ''), 'seo_title' => mb_substr($title, 0, 70)], $user);
        }

        if ($job->target_type === 'pagina') {
            DB::table('cms_seo_pages')->where('id', $job->target_id)->update(['title' => mb_substr((string) $after['title'], 0, 120), 'meta_description' => mb_substr((string) $after['desc'], 0, 320)]);

            return DB::table('cms_seo_pages')->where('id', $job->target_id)->value('path');
        }

        if ($job->target_type === 'historia') {
            $story = DB::table('cms_travel_stories')->where('id', $job->target_id)->lock('for no key update')->first();

            if ($story === null || $story->consent_at === null || $story->consent_revoked_at !== null) {
                throw ApiException::unprocessable('AI_STORY_CONSENT', 'El viajero retiró su consentimiento: el relato no se puede aplicar.');
            }

            DB::table('cms_travel_stories')->where('id', $story->id)->update(['body' => (string) $after['text']]);

            return $story->slug;
        }

        $product = DB::table('catalog_products')->whereNull('deleted_at')->where('id', $job->target_id)->lock('for no key update')->first();

        if ($product === null) {
            throw ApiException::unprocessable('AI_TARGET_INVALID', 'El producto ya no existe.');
        }

        match ($job->kind) {
            'meta_seo' => DB::table('catalog_products')->where('id', $product->id)->update(['seo_title' => mb_substr((string) $after['title'], 0, 120), 'seo_description' => mb_substr((string) $after['desc'], 0, 320), 'updated_by' => $user->getKey()]),
            'traducir' => $this->translate($product, $job->locale, (string) $after['text'], $user),
            default => DB::table('catalog_products')->where('id', $product->id)->update(['short_description' => (string) $after['text'], 'updated_by' => $user->getKey()]),
        };

        return $product->code;
    }

    private function translate(stdClass $product, string $locale, string $text, User $user): void
    {
        $existing = DB::table('catalog_product_translations')->where('product_id', $product->id)->where('locale', $locale)->value('id');

        if ($existing !== null) {
            DB::table('catalog_product_translations')->where('id', $existing)->update(['short' => $text, 'updated_by' => $user->getKey()]);

            return;
        }

        DB::table('catalog_product_translations')->insert(['product_id' => $product->id, 'locale' => $locale, 'name' => $product->name, 'short' => $text, 'slug' => $product->slug ?: Str::slug($product->name), 'created_by' => $user->getKey(), 'updated_by' => $user->getKey()]);
    }

    private function job(string $code): stdClass
    {
        $job = DB::table('cms_ai_content_jobs')->where('code', $code)->first();

        if ($job === null) {
            throw ApiException::notFound('Ese pedido no existe.');
        }

        return $job;
    }

    private function present(stdClass $row, ?string $by, bool $full = false): array
    {
        $input = $this->decode($row->input);
        $output = $row->output !== null ? $this->decode($row->output) : null;
        $label = $row->kind === 'imagen' ? ((int) ($input['count'] ?? 0)).' '.(((int) ($input['count'] ?? 0)) === 1 ? 'imagen' : 'imágenes').' · '.(self::STYLES[$input['style'] ?? ''] ?? '') : (string) ($input['source']['label'] ?? '');

        return [
            'code' => $row->code,
            'kind' => $row->kind,
            'kind_label' => self::KINDS[$row->kind],
            'target_type' => $row->target_type,
            'target_id' => $row->target_id,
            'target_label' => $label,
            'locale' => $row->locale,
            'tone' => $row->tone,
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status],
            'credits_used' => (int) $row->credits_used,
            'cost' => (int) ($input['cost'] ?? 0),
            'error' => $row->error,
            'created_by' => $by,
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            'applied_at' => $row->applied_at ? Carbon::parse($row->applied_at)->toIso8601String() : null,
            ...($full ? [
                'notes' => $input['notes'] ?? null,
                'before' => $input['source']['before'] ?? null,
                'after' => $output['after'] ?? null,
                'applied_ref' => $output['applied_ref'] ?? null,
                'warning' => $row->kind === 'imagen' ? null : self::WARNING,
                'images' => $row->kind === 'imagen' ? DB::table('cms_ai_images')->where('job_id', $row->id)->orderBy('created_at')->get()->map($this->presentImage(...))->all() : [],
            ] : []),
        ];
    }

    private function presentImage(stdClass $image): array
    {
        return [
            'id' => $image->id,
            'job' => DB::table('cms_ai_content_jobs')->where('id', $image->job_id)->value('code'),
            'prompt' => $image->prompt,
            'style' => $image->style,
            'style_label' => self::STYLES[$image->style] ?? $image->style,
            'width' => (int) $image->width,
            'height' => (int) $image->height,
            'hd' => (int) $image->width >= self::QUALITIES['hd'],
            'alt_text' => $image->alt_text,
            'ai_label' => (bool) $image->ai_label,
            'credits_used' => (int) $image->credits_used,
            'status' => $image->status,
            'used_in' => $this->decode($image->used_in),
            'file' => '/cms/ai/images/'.$image->id.'/file',
            'created_at' => Carbon::parse($image->created_at)->toIso8601String(),
        ];
    }

    private function flatten(array $value): string
    {
        return mb_substr(implode(' · ', array_map(fn (mixed $part): string => is_scalar($part) ? (string) $part : (json_encode($part, JSON_UNESCAPED_UNICODE) ?: ''), $value)), 0, 2000);
    }

    private function decode(mixed $value): array
    {
        return is_string($value) ? (json_decode($value, true) ?: []) : (array) $value;
    }
}
