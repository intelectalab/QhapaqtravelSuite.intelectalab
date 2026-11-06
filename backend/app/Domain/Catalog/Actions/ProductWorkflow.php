<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\ProductChecklist;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductWorkflow
{
    public const TRANSITIONS = [
        'submit-review' => ['from' => ['DRAFT'], 'to' => 'REVIEW', 'reason' => false, 'permission' => 'catalog.products.update', 'label' => 'enviar_revision'],
        'approve' => ['from' => ['REVIEW'], 'to' => 'APPROVED', 'reason' => false, 'permission' => 'catalog.products.activate', 'label' => 'aprobar'],
        'return-to-draft' => ['from' => ['REVIEW'], 'to' => 'DRAFT', 'reason' => true, 'permission' => 'catalog.products.activate', 'label' => 'devolver'],
        'activate' => ['from' => ['APPROVED', 'SUSPENDED', 'INACTIVE'], 'to' => 'ACTIVE', 'reason' => false, 'permission' => 'catalog.products.activate', 'label' => 'activar'],
        'suspend' => ['from' => ['ACTIVE'], 'to' => 'SUSPENDED', 'reason' => true, 'permission' => 'catalog.products.activate', 'label' => 'suspender'],
        'deactivate' => ['from' => ['ACTIVE', 'SUSPENDED'], 'to' => 'INACTIVE', 'reason' => true, 'permission' => 'catalog.products.activate', 'label' => 'inactivar'],
        'archive' => ['from' => ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'INACTIVE'], 'to' => 'ARCHIVED', 'reason' => true, 'permission' => 'catalog.products.activate', 'label' => 'archivar'],
    ];

    private const FIELDS = [
        'name' => 'Nombre', 'internal_name' => 'Nombre interno', 'code' => 'Código', 'sku' => 'SKU', 'product_type_id' => 'Tipo', 'category_id' => 'Categoría',
        'subcategory_id' => 'Subcategoría', 'primary_destination_id' => 'Destino', 'main_provider_id' => 'Proveedor principal', 'short_description' => 'Descripción',
        'long_description' => 'Descripción larga', 'duration_value' => 'Duración', 'duration_unit' => 'Unidad de duración', 'modality' => 'Modalidad',
        'minimum_passengers' => 'Pasajeros mínimos', 'maximum_passengers' => 'Pasajeros máximos', 'minimum_age' => 'Edad mínima', 'maximum_age' => 'Edad máxima',
        'booking_advance_min_days' => 'Anticipación mínima', 'booking_advance_max_days' => 'Anticipación máxima', 'is_b2b' => 'Agencias B2B',
        'is_ecommerce' => 'Tienda en línea', 'is_featured' => 'Destacado', 'markup_pct' => 'Margen', 'availability_model' => 'Disponibilidad',
    ];

    private const DEFAULT_POLICIES = [
        'cancellation' => 'Sin penalidad hasta 15 días antes. 50% entre 14 y 7 días. 100% dentro de 7 días o no-show.',
        'modification' => 'Cambios de fecha sin costo hasta 10 días antes, sujetos a disponibilidad y diferencia tarifaria.',
        'no_show' => 'No-show se factura al 100%.',
        'penalties' => 'Penalidades según cronograma de cancelación; gastos de emisión no reembolsables.',
        'refund' => 'Reembolsos en 7–15 días hábiles por el mismo medio de pago.',
        'date_change' => 'Un cambio de fecha sin costo por reserva, con 10 días de anticipación.',
        'advance_min' => '48 horas',
        'advance_max' => '365 días',
    ];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CodeSequence $codes,
        private readonly ProductChecklist $checklist,
        private readonly TenantContext $context,
    ) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $values = $this->values($data, null);
            $id = (string) Str::uuid7();
            $tenantId = $this->context->idOrFail();
            DB::table('catalog_products')->insert([
                ...$values,
                'id' => $id,
                'tenant_id' => $tenantId,
                'ref' => $this->codes->next('catalog_products', 'PRD-', 3, 'ref'),
                'status' => 'DRAFT',
                'slug' => Str::slug($values['name'].' '.$values['code']),
                'created_by' => $actor->getKey(),
            ]);
            DB::table('catalog_product_policies')->insert([...self::DEFAULT_POLICIES, 'id' => (string) Str::uuid7(), 'tenant_id' => $tenantId, 'product_id' => $id, 'created_by' => $actor->getKey()]);
            DB::table('catalog_product_channels')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $tenantId, 'product_id' => $id, 'channel' => 'erp', 'is_published' => true, 'published_at' => now(), 'published_by' => $actor->getKey(), 'created_by' => $actor->getKey()]);
            $versionId = (string) Str::uuid7();
            DB::table('catalog_product_versions')->insert([
                'id' => $versionId, 'tenant_id' => $tenantId, 'product_id' => $id, 'version' => '0.1', 'status' => 'borrador',
                'valid_from' => now()->toDateString(), 'reason' => 'Alta del producto', 'snapshot' => json_encode($values, JSON_UNESCAPED_UNICODE), 'created_by' => $actor->getKey(),
            ]);
            DB::table('catalog_products')->where('id', $id)->update(['current_version_id' => $versionId]);
            $this->audit->log('Producto', $values['code'], 'crear', after: $values['name']);

            return $values['code'];
        });
    }

    public function update(string $code, array $data, int $version, User $actor): string
    {
        return DB::transaction(function () use ($code, $data, $version, $actor): string {
            $product = $this->product($code);

            if ($product->status === 'ARCHIVED') {
                throw ApiException::conflict('PRD-ARCHIVED', 'Un producto archivado no se edita.');
            }

            $values = $this->values($data, $product);
            $changed = array_filter(self::FIELDS, fn (string $label, string $field) => array_key_exists($field, $values) && $this->differs($values[$field], $product->{$field}), ARRAY_FILTER_USE_BOTH);

            if ($changed === []) {
                return $product->code;
            }

            $updated = DB::table('catalog_products')->where('id', $product->id)->where('lock_version', $version)
                ->update([...$values, 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió este producto mientras lo veías. Recarga la página e inténtalo de nuevo.');
            }

            $this->audit->log('Producto', $values['code'], 'modificar', after: implode(', ', $changed));

            return $values['code'];
        });
    }

    public function transition(string $code, string $action, ?string $reason, int $version, User $actor): void
    {
        $rule = self::TRANSITIONS[$action] ?? throw ApiException::notFound('La acción no existe.');

        if (! $actor->can($rule['permission'])) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no puede hacer este cambio.', [$rule['permission']]);
        }

        $product = $this->product($code);

        if (! in_array($product->status, $rule['from'], true)) {
            throw ApiException::conflict('PRD-BR-TRANSITION', 'Este cambio no está permitido desde el estado actual.');
        }

        if ($rule['reason'] && trim((string) $reason) === '') {
            throw ApiException::unprocessable('CAT-BR-07', 'Escribe el motivo.');
        }

        if ($action === 'submit-review' && ! $product->category_id) {
            throw ApiException::unprocessable('CAT-BR-05', 'Completa nombre, tipo, destino y categoría antes de enviarlo a revisión.');
        }

        if ($action === 'activate') {
            $failed = $this->checklist->failed($product);
            if ($failed !== []) {
                $this->audit->log('Producto', $product->code, 'activacion_rechazada', $product->status, implode(', ', array_column($failed, 'label')));
                throw ApiException::unprocessable('PRD-ACT-CHECKLIST', 'Aún no se puede activar: faltan '.count($failed).' requisitos.', ['failed' => $failed]);
            }
        }

        DB::transaction(function () use ($product, $rule, $action, $reason, $version, $actor): void {
            $updated = DB::table('catalog_products')->where('id', $product->id)->where('lock_version', $version)
                ->update(['status' => $rule['to'], 'lock_version' => $version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

            if ($updated === 0) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió este producto mientras lo veías. Recarga la página e inténtalo de nuevo.');
            }

            $versionStatus = match ($action) {
                'submit-review' => ['from' => ['borrador'], 'to' => 'en_revision'],
                'return-to-draft' => ['from' => ['en_revision'], 'to' => 'borrador'],
                'activate' => ['from' => ['borrador', 'en_revision'], 'to' => 'vigente'],
                default => null,
            };

            if ($versionStatus) {
                DB::table('catalog_product_versions')->where('product_id', $product->id)->whereIn('status', $versionStatus['from'])->update(['status' => $versionStatus['to']]);
            }

            $this->audit->log('Producto', $product->code, 'cambio_estado', $product->status, trim($rule['to'].($reason ? " · {$reason}" : '')));
        });
    }

    public function delete(string $code, string $reason, User $actor): void
    {
        $product = $this->product($code);

        if (in_array($product->status, ['ACTIVE', 'SUSPENDED'], true)) {
            throw ApiException::conflict('PRD-BR-018', 'Un producto en venta no se elimina. Inactívalo o archívalo primero.');
        }

        $quotes = DB::table('quote_items')->where('product_id', $product->id)->count();
        $reservations = DB::table('booking_reservation_services')->where('product_id', $product->id)->count();
        $packages = DB::table('catalog_product_items')->where('component_product_id', $product->id)->count();

        if ($quotes + $reservations + $packages > 0) {
            throw ApiException::conflict('PRD-BR-018', 'No se puede eliminar porque ya se usa en '.implode(', ', array_filter([
                $quotes ? "{$quotes} cotizaciones" : null,
                $reservations ? "{$reservations} servicios de reservas" : null,
                $packages ? "{$packages} paquetes" : null,
            ])).'. Archívalo en su lugar.');
        }

        DB::table('catalog_products')->where('id', $product->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Producto', $product->code, 'eliminar', $product->name, $reason);
    }

    private function values(array $data, ?object $current): array
    {
        $code = strtoupper(trim((string) $data['code']));
        $twin = DB::table('catalog_products')->whereRaw('upper(code) = ?', [$code])
            ->when($current, fn ($query) => $query->where('id', '<>', $current->id))->first(['deleted_at']);

        if ($twin) {
            throw ApiException::unprocessable('CAT-BR-01', $twin->deleted_at ? 'Ese código ya lo usó un producto eliminado. Elige otro.' : 'Ya hay otro producto con ese código.');
        }

        foreach ([['minimum_passengers', 'maximum_passengers', 'pasajeros'], ['minimum_age', 'maximum_age', 'edades'], ['booking_advance_min_days', 'booking_advance_max_days', 'días de anticipación']] as [$min, $max, $label]) {
            if ((int) $data[$min] > (int) $data[$max]) {
                throw ApiException::unprocessable('CAT-BR-02', "El mínimo de {$label} no puede ser mayor que el máximo.");
            }
        }

        $subcategory = $data['subcategory_id'] ?? null;
        if ($subcategory && ! DB::table('catalog_product_subcategories')->where('id', $subcategory)->where('category_id', $data['category_id'])->exists()) {
            throw ApiException::unprocessable('CAT-BR-03', 'La subcategoría no pertenece a esa categoría.');
        }

        $provider = $data['provider_id'] ?? null;
        if ($provider && ! DB::table('catalog_providers')->where('id', $provider)->where('status', 'activo')->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('CAT-BR-11', 'Elige un proveedor activo.');
        }

        $sku = strtoupper(trim((string) ($data['sku'] ?? '')));
        $name = trim($data['name']);

        return [
            'code' => $code,
            'sku' => $sku !== '' ? $sku : ($current?->sku ?? $this->skuPrefix().'-'.$code),
            'name' => $name,
            'internal_name' => trim((string) ($data['internal_name'] ?? '')) ?: ($current?->internal_name ?? $name),
            'product_type_id' => $data['type_id'],
            'category_id' => $data['category_id'],
            'subcategory_id' => $subcategory,
            'primary_destination_id' => $data['destination_id'],
            'main_provider_id' => $provider,
            'short_description' => trim((string) ($data['short_description'] ?? '')) ?: null,
            'duration_value' => $data['duration_value'],
            'duration_unit' => $data['duration_unit'],
            'modality' => $data['modality'],
            'minimum_passengers' => (int) $data['minimum_passengers'],
            'maximum_passengers' => (int) $data['maximum_passengers'],
            'minimum_age' => (int) $data['minimum_age'],
            'maximum_age' => (int) $data['maximum_age'],
            'booking_advance_min_days' => (int) $data['booking_advance_min_days'],
            'booking_advance_max_days' => (int) $data['booking_advance_max_days'],
            'is_b2b' => (bool) ($data['is_b2b'] ?? false),
            'is_ecommerce' => (bool) ($data['is_ecommerce'] ?? false),
            'is_featured' => (bool) ($data['is_featured'] ?? false),
            'markup_pct' => $data['markup_pct'] ?? ($current?->markup_pct ?? 25),
            'availability_model' => $data['availability_model'] ?? ($current?->availability_model ?? 'SIN_CONTROL'),
        ];
    }

    private function differs(mixed $next, mixed $previous): bool
    {
        if (is_bool($next)) {
            return $next !== (bool) $previous;
        }

        if (is_numeric($next) && is_numeric($previous)) {
            return (float) $next !== (float) $previous;
        }

        return (string) $next !== (string) $previous;
    }

    private function skuPrefix(): string
    {
        return strtoupper((string) ($this->context->tenant()->logo_initials ?: 'QT'));
    }

    private function product(string $code): object
    {
        return DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('El producto no existe.');
    }
}
