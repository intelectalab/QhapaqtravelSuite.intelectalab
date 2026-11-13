<?php

declare(strict_types=1);

namespace App\Domain\Growth\CatalogImport;

use App\Domain\Catalog\Actions\ProductWorkflow;
use App\Domain\Growth\Assistant\AssistantWorkflow;
use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\SalesAssistant;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class CatalogImports
{
    public const SOURCES = ['url' => 'Página web', 'pdf' => 'PDF', 'csv' => 'Planilla CSV', 'xlsx' => 'Planilla Excel'];

    public const STATUSES = ['en_cola' => 'En cola', 'procesando' => 'Procesando', 'revision' => 'En revisión', 'importado' => 'Importado', 'fallido' => 'Fallido', 'cancelado' => 'Cancelado'];

    public const PERMISSION = 'catalog.products.import';

    public function __construct(
        private readonly GrowthRules $rules,
        private readonly SalesAssistant $assistant,
        private readonly AssistantWorkflow $quota,
        private readonly SequenceService $sequences,
        private readonly ProductWorkflow $products,
        private readonly AttachmentGuard $guard,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function index(): array
    {
        $jobs = DB::table('catalog_import_jobs as j')->leftJoin('iam_users as u', 'u.id', '=', 'j.created_by')->orderByDesc('j.created_at')->limit(200)
            ->get(['j.*', 'u.name as created_by_name'])->map(fn (object $row): array => $this->summary($row))->values();

        return [
            'enabled' => $this->rules->enabled('R-AI-IMPORT'),
            'kpis' => [
                'total' => $jobs->count(),
                'review' => $jobs->where('status', 'revision')->count(),
                'detected' => (int) $jobs->sum('products_detected'),
                'created' => (int) $jobs->sum('products_created'),
            ],
            'imports' => $jobs->all(),
            'catalogs' => ['sources' => self::SOURCES, 'statuses' => self::STATUSES],
        ];
    }

    public function create(array $data, ?UploadedFile $file, User $actor): array
    {
        $this->rules->ensure('R-AI-IMPORT', self::PERMISSION);
        $usage = $this->quota->usage($actor);

        if ($usage['used'] >= $usage['limit']) {
            throw new ApiException(429, 'AI_QUOTA_EXCEEDED', 'AI_QUOTA_EXCEEDED', 'La agencia ya usó los '.$usage['limit'].' pedidos de IA del mes.');
        }

        $type = (string) $data['source_type'];
        [$path, $source] = $this->source($type, $data, $file);
        $id = (string) Str::uuid7();

        $code = DB::transaction(function () use ($id, $type, $data, $path, $actor): string {
            $code = $this->sequences->next('catalog_import');
            DB::table('catalog_import_jobs')->insert([
                'id' => $id,
                'code' => $code,
                'source_type' => $type,
                'source_url' => $type === 'url' ? $data['source_url'] : null,
                'file_path' => $path,
                'status' => 'procesando',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Importación de productos', $code, 'crear', null, self::SOURCES[$type]);

            return $code;
        });

        $this->process($id, $code, $type, $source, $actor);

        return $this->show($code);
    }

    public function show(string $code): array
    {
        $row = DB::table('catalog_import_jobs as j')->leftJoin('iam_users as u', 'u.id', '=', 'j.created_by')->where('j.code', $code)->first(['j.*', 'u.name as created_by_name'])
            ?? throw ApiException::notFound('La importación no existe.');
        $destinations = DB::table('catalog_destinations')->whereNull('deleted_at')->pluck('name')->map(fn (string $name): string => $this->normal($name))->flip();

        return [
            ...$this->summary($row),
            'error' => $row->error,
            'products' => collect((array) json_decode((string) $row->extracted, true))->map(fn (array $item): array => [
                ...$item,
                'destination_known' => isset($item['destination']) && $destinations->has($this->normal((string) $item['destination'])),
            ])->values()->all(),
        ];
    }

    public function confirm(string $code, array $keys, User $actor): array
    {
        $this->rules->ensure('R-AI-IMPORT', self::PERMISSION);

        DB::transaction(function () use ($code, $keys, $actor): void {
            $job = DB::table('catalog_import_jobs')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound('La importación no existe.');

            if ($job->status !== 'revision') {
                throw ApiException::conflict('IMP-STATUS', 'Solo se confirma una importación en revisión.');
            }

            $items = collect((array) json_decode((string) $job->extracted, true));
            $chosen = $items->whereIn('key', $keys);

            if ($chosen->count() !== count(array_unique($keys))) {
                throw ApiException::unprocessable('VALIDATION_ERROR', 'Uno de los productos elegidos no está en la importación.');
            }

            $defaults = $this->defaults();
            $created = [];

            foreach ($chosen as $item) {
                $created[$item['key']] = $this->products->create($this->productData($job, $item, $defaults), $actor);
            }

            $extracted = $items->map(fn (array $item): array => [...$item, 'created_code' => $created[$item['key']] ?? ($item['created_code'] ?? null)])->values()->all();
            DB::table('catalog_import_jobs')->where('id', $job->id)->update([
                'extracted' => json_encode($extracted, JSON_UNESCAPED_UNICODE),
                'products_created' => count($created),
                'status' => 'importado',
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
            $this->audit->log('Importación de productos', $code, 'confirmar', 'revision', count($created).' productos en borrador: '.implode(', ', $created), null, ['detectado_por_ia' => true]);
        });

        return $this->show($code);
    }

    public function cancel(string $code, User $actor): array
    {
        DB::transaction(function () use ($code, $actor): void {
            $job = DB::table('catalog_import_jobs')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound('La importación no existe.');

            if (! in_array($job->status, ['en_cola', 'revision'], true)) {
                throw ApiException::conflict('IMP-STATUS', 'Solo se cancela una importación en cola o en revisión.');
            }

            DB::table('catalog_import_jobs')->where('id', $job->id)->update(['status' => 'cancelado', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Importación de productos', $code, 'cancelar', (string) $job->status, 'cancelado');
        });

        return $this->show($code);
    }

    private function process(string $id, string $code, string $type, string $source, User $actor): void
    {
        $context = ['destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('name')->limit(50)->pluck('name')->all()];
        $completion = $this->assistant->extractProducts($type, $source, $context);
        $requestId = (string) Str::uuid7();

        DB::transaction(function () use ($id, $code, $type, $completion, $requestId, $actor): void {
            DB::table('sys_ai_requests')->insert([
                'id' => $requestId,
                'kind' => 'product_import',
                'source_type' => 'catalog_import',
                'source_id' => $id,
                'user_id' => $actor->getKey(),
                'prompt' => 'Importar productos desde '.self::SOURCES[$type].' ('.$code.')',
                'input_ref' => json_encode(['import' => $code], JSON_UNESCAPED_UNICODE),
                'output' => $completion->ok ? json_encode($completion->output, JSON_UNESCAPED_UNICODE) : null,
                'provider' => $this->assistant->provider(),
                'model' => $completion->model,
                'tokens_in' => $completion->tokensIn,
                'tokens_out' => $completion->tokensOut,
                'cost_usd' => $completion->costUsd,
                'status' => $completion->ok ? 'completed' : 'failed',
                'error' => $completion->error,
                'completed_at' => now(),
                'created_by' => $actor->getKey(),
            ]);
            $products = array_map(fn (array $item): array => [...$item, 'created_code' => null], $completion->output['products'] ?? []);
            DB::table('catalog_import_jobs')->where('id', $id)->update([
                'status' => $completion->ok ? 'revision' : 'fallido',
                'extracted' => json_encode($products, JSON_UNESCAPED_UNICODE),
                'products_detected' => count($products),
                'ai_request_id' => $requestId,
                'error' => $completion->error,
                'updated_at' => now(),
            ]);
        });
        UsageMeter::record($this->context->idOrFail(), 'ai_requests');
    }

    private function source(string $type, array $data, ?UploadedFile $file): array
    {
        if ($type === 'url') {
            return [null, (string) $data['source_url']];
        }

        if ($file === null && $type === 'csv' && trim((string) ($data['content'] ?? '')) !== '') {
            $path = 'imports/'.$this->context->idOrFail().'/'.Str::uuid7().'.csv';
            Storage::disk('local')->put($path, (string) $data['content']);

            return [$path, (string) $data['content']];
        }

        if ($file === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Adjunta el archivo a importar.', ['field' => 'file']);
        }

        $extension = Str::lower($file->getClientOriginalExtension());
        $allowed = ['csv' => ['csv', 'txt'], 'pdf' => ['pdf'], 'xlsx' => ['xlsx', 'xls']][$type];

        if (! in_array($extension, $allowed, true)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'El archivo no coincide con el tipo elegido ('.self::SOURCES[$type].').', ['field' => 'file']);
        }

        $contents = (string) file_get_contents((string) $file->getRealPath());
        $this->guard->ensureClean($contents, $file->getClientOriginalName(), 'Importación de productos', $type);
        $path = (string) Storage::disk('local')->putFile('imports/'.$this->context->idOrFail(), $file);

        return [$path, $type === 'csv' ? $contents : $file->getClientOriginalName().'|'.strlen($contents)];
    }

    private function defaults(): array
    {
        $type = DB::table('catalog_product_types')->whereNull('deleted_at')->orderBy('sort_order')->orderBy('name')->value('id');
        $category = DB::table('catalog_product_categories')->whereNull('deleted_at')->orderBy('name')->value('id');
        $destinations = DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('level')->orderBy('name')->get(['id', 'name']);

        if ($type === null || $category === null || $destinations->isEmpty()) {
            throw ApiException::unprocessable('IMP-SETUP', 'Antes de importar, registra al menos un tipo de producto, una categoría y un destino en el catálogo.');
        }

        return ['type' => (string) $type, 'category' => (string) $category, 'destinations' => $destinations];
    }

    private function productData(object $job, array $item, array $defaults): array
    {
        $destination = $defaults['destinations']->first(fn (object $row): bool => $this->normal($row->name) === $this->normal((string) ($item['destination'] ?? ''))) ?? $defaults['destinations']->first();
        $days = max(1, (int) ($item['duration_days'] ?? 1));
        $confidence = (int) round(((float) ($item['confidence'] ?? 0)) * 100);
        $price = isset($item['price']) ? ' · tarifa sugerida '.($item['currency'] ?? 'PEN').' '.$item['price'] : '';

        return [
            'code' => 'IA-'.Str::after((string) $job->code, 'IMP-').'-'.Str::after((string) $item['key'], 'P'),
            'name' => Str::limit((string) $item['name'], 150, ''),
            'type_id' => $defaults['type'],
            'category_id' => $defaults['category'],
            'destination_id' => (string) $destination->id,
            'short_description' => Str::limit("Detectado por IA en {$job->code} (confianza {$confidence} %){$price}.", 300, ''),
            'duration_value' => $days,
            'duration_unit' => 'días',
            'modality' => 'Compartido',
            'minimum_passengers' => 1,
            'maximum_passengers' => 20,
            'minimum_age' => 0,
            'maximum_age' => 99,
            'booking_advance_min_days' => 1,
            'booking_advance_max_days' => 365,
            'is_bookable' => false,
        ];
    }

    private function normal(string $value): string
    {
        return Str::lower(Str::ascii(trim($value)));
    }

    private function summary(object $row): array
    {
        return [
            'code' => $row->code,
            'source_type' => $row->source_type,
            'source_label' => self::SOURCES[$row->source_type] ?? $row->source_type,
            'source' => $row->source_url ?? ($row->file_path !== null ? basename((string) $row->file_path) : null),
            'status' => $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'products_detected' => (int) $row->products_detected,
            'products_created' => (int) $row->products_created,
            'created_at' => $row->created_at,
            'created_by' => $row->created_by_name ?? null,
        ];
    }
}
