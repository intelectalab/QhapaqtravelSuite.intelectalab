<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Illuminate\Validation\Rule;

final class ProductSectionRules
{
    public const ITEM_TYPES = ['Traslado', 'Transporte', 'Tren', 'Hotel', 'Alimentación', 'Guía', 'Actividad', 'Entrada', 'Libre', 'Otro'];

    public const REQUIREMENT_CATEGORIES = ['Condición física', 'Documentos', 'Nacionalidad', 'Restricción', 'Recomendación', 'Equipamiento', 'Requisito especial'];

    public const CHANNELS = ['erp', 'crm', 'quotes', 'b2b', 'portal', 'portal_pax', 'cms', 'ecommerce', 'mobile'];

    public const SOURCES = ['interna', 'externa'];

    public const STEPS = [
        'secondary_destination_ids' => 3,
        'components' => 4,
        'itinerary' => 5,
        'rates' => 6,
        'season_ids' => 7,
        'availability' => 8,
        'content' => 9,
        'policies' => 9,
        'channels' => 10,
    ];

    public static function destinations(): array
    {
        return [
            'secondary_destination_ids' => ['nullable', 'array', 'max:30'],
            'secondary_destination_ids.*' => ['uuid', 'distinct'],
        ];
    }

    public static function components(string $prefix = 'components'): array
    {
        return [$prefix => ['present', 'array', 'max:60'], "{$prefix}.*.id" => ['nullable', 'uuid', 'distinct'], ...self::component("{$prefix}.*")];
    }

    public static function component(string $prefix, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            "{$prefix}.service_id" => $partial ? ['nullable', 'uuid'] : ['nullable', 'uuid', "required_without:{$prefix}.component_product_id"],
            "{$prefix}.component_product_id" => ['nullable', 'uuid'],
            "{$prefix}.quantity" => [$required, 'numeric', 'min:1', 'max:999'],
            "{$prefix}.is_required" => ['nullable', 'boolean'],
            "{$prefix}.is_included" => ['nullable', 'boolean'],
            "{$prefix}.notes" => ['nullable', 'string', 'max:300'],
        ];
    }

    public static function itinerary(string $prefix = 'itinerary'): array
    {
        return [$prefix => ['present', 'array', 'max:60'], "{$prefix}.*.id" => ['nullable', 'uuid', 'distinct'], ...self::day("{$prefix}.*")];
    }

    public static function day(string $prefix): array
    {
        return [
            "{$prefix}.title" => ['required', 'string', 'min:3', 'max:160'],
            "{$prefix}.items" => ['nullable', 'array', 'max:30'],
            "{$prefix}.items.*.id" => ['nullable', 'uuid'],
            ...self::item("{$prefix}.items.*"),
        ];
    }

    public static function item(string $prefix, bool $partial = false): array
    {
        return [
            "{$prefix}.time" => ['nullable', 'date_format:H:i'],
            "{$prefix}.activity" => [$partial ? 'sometimes' : 'required', 'string', 'min:2', 'max:200'],
            "{$prefix}.type" => ['nullable', Rule::in(self::ITEM_TYPES)],
            "{$prefix}.location" => ['nullable', 'string', 'max:160'],
        ];
    }

    public static function rates(string $prefix = 'rates'): array
    {
        return [
            $prefix => ['nullable', 'array', 'max:40'],
            "{$prefix}.*.rate_type" => ['required', Rule::in(RateDirectory::TYPES)],
            "{$prefix}.*.segment" => ['required', Rule::in(RateDirectory::SEGMENTS)],
            "{$prefix}.*.channel" => ['required', Rule::in(RateDirectory::CHANNELS)],
            "{$prefix}.*.currency" => ['required', Rule::in(CatalogAccess::CURRENCIES)],
            "{$prefix}.*.price_basis" => ['nullable', Rule::in(RateDirectory::BASES)],
            "{$prefix}.*.cost" => ['required', 'numeric', 'min:0', 'max:999999'],
            "{$prefix}.*.price" => ['required', 'numeric', 'gt:0', 'max:999999'],
            "{$prefix}.*.valid_from" => ['required', 'date'],
            "{$prefix}.*.valid_to" => ['required', 'date', "after_or_equal:{$prefix}.*.valid_from"],
            "{$prefix}.*.season_id" => ['nullable', 'uuid'],
            "{$prefix}.*.min_price" => ['nullable', 'numeric', 'gt:0', 'max:999999'],
            "{$prefix}.*.max_price" => ['nullable', 'numeric', 'gt:0', 'max:999999'],
            "{$prefix}.*.conditions" => ['nullable', 'string', 'max:300'],
        ];
    }

    public static function seasons(string $field = 'season_ids'): array
    {
        return [
            $field => ['present', 'array', 'max:40'],
            "{$field}.*" => ['uuid', 'distinct'],
        ];
    }

    public static function availability(string $prefix = ''): array
    {
        return [
            "{$prefix}model" => ['required', Rule::in(ProductOptions::AVAILABILITY)],
            "{$prefix}capacity" => ['nullable', 'integer', 'min:1', 'max:99999'],
            "{$prefix}source" => ['required', Rule::in(self::SOURCES)],
        ];
    }

    public static function content(string $prefix = ''): array
    {
        return [
            "{$prefix}long_description" => ['nullable', 'string', 'max:6000'],
            "{$prefix}seo_title" => ['nullable', 'string', 'max:160'],
            "{$prefix}seo_description" => ['nullable', 'string', 'max:320'],
            "{$prefix}slug" => ['nullable', 'string', 'max:160', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/'],
            "{$prefix}video_url" => ['nullable', 'url', 'max:300'],
            "{$prefix}inclusions" => ['present', 'array', 'max:40'],
            "{$prefix}inclusions.*" => ['string', 'min:2', 'max:200', 'distinct:ignore_case'],
            "{$prefix}exclusions" => ['present', 'array', 'max:40'],
            "{$prefix}exclusions.*" => ['string', 'min:2', 'max:200', 'distinct:ignore_case'],
            "{$prefix}requirements" => ['present', 'array', 'max:40'],
            "{$prefix}requirements.*.category" => ['nullable', Rule::in(self::REQUIREMENT_CATEGORIES)],
            "{$prefix}requirements.*.text" => ['required', 'string', 'min:2', 'max:250'],
            "{$prefix}faqs" => ['present', 'array', 'max:30'],
            "{$prefix}faqs.*.question" => ['required', 'string', 'min:5', 'max:250'],
            "{$prefix}faqs.*.answer" => ['required', 'string', 'min:2', 'max:2000'],
            "{$prefix}media" => ['present', 'array', 'max:20'],
            "{$prefix}media.*.url" => ['required', 'url', 'max:500'],
            "{$prefix}media.*.alt_text" => ['required', 'string', 'min:3', 'max:200'],
            "{$prefix}media.*.is_main" => ['nullable', 'boolean'],
        ];
    }

    public static function policies(string $prefix = ''): array
    {
        return [
            "{$prefix}cancellation" => ['required', 'string', 'min:5', 'max:1500'],
            "{$prefix}modification" => ['required', 'string', 'min:5', 'max:1500'],
            "{$prefix}no_show" => ['required', 'string', 'min:5', 'max:1500'],
            "{$prefix}refund" => ['required', 'string', 'min:5', 'max:1500'],
            "{$prefix}penalties" => ['nullable', 'string', 'max:1500'],
            "{$prefix}date_change" => ['nullable', 'string', 'max:1500'],
            ...CancellationTiers::rules($prefix),
        ];
    }

    public static function channels(string $field = 'channels'): array
    {
        return [
            $field => ['present', 'array', 'max:9'],
            "{$field}.*" => [Rule::in(self::CHANNELS), 'distinct'],
        ];
    }

    public static function messages(): array
    {
        return [
            'secondary_destination_ids.*' => 'Revisa los destinos secundarios.',
            'components.*.service_id.*' => 'Elige el servicio del componente.',
            'components.*.component_product_id.*' => 'Elige el producto del componente.',
            'components.*.quantity.*' => 'La cantidad del componente va de 1 a 999.',
            'components.*.notes.*' => 'La nota del componente admite hasta 300 caracteres.',
            'components.*' => 'Revisa los componentes.',
            'itinerary.*.title.*' => 'Cada día necesita un título de al menos 3 letras.',
            'itinerary.*.items.*.time.*' => 'Escribe la hora como 08:30.',
            'itinerary.*.items.*.activity.*' => 'Describe la actividad.',
            'itinerary.*.items.*.type.*' => 'Elige el tipo de actividad.',
            'itinerary.*.items.*.location.*' => 'La ubicación admite hasta 160 caracteres.',
            'itinerary.*' => 'Revisa el itinerario.',
            'rates.*.rate_type.*' => 'Elige el tipo de tarifa.',
            'rates.*.segment.*' => 'Elige el segmento de la tarifa.',
            'rates.*.channel.*' => 'Elige el canal de la tarifa.',
            'rates.*.currency.*' => 'Toda tarifa necesita moneda (PRD-BR-004).',
            'rates.*.price_basis.*' => 'Elige cómo se cobra la tarifa.',
            'rates.*.cost.*' => 'El costo de la tarifa debe ser cero o mayor.',
            'rates.*.price.*' => 'El precio de venta debe ser mayor que cero.',
            'rates.*.valid_from.*' => 'Toda tarifa necesita fecha de inicio (PRD-BR-004).',
            'rates.*.valid_to.after_or_equal' => 'La vigencia debe terminar después de empezar.',
            'rates.*.valid_to.*' => 'Toda tarifa necesita fecha de fin (PRD-BR-004).',
            'rates.*.season_id.*' => 'Elige una temporada válida.',
            'rates.*.min_price.*' => 'Revisa el precio mínimo de la tarifa.',
            'rates.*.max_price.*' => 'Revisa el precio máximo de la tarifa.',
            'rates.*.conditions.*' => 'Las condiciones admiten hasta 300 caracteres.',
            'season_ids.*' => 'Revisa las temporadas elegidas.',
            'availability.model.*' => 'Elige el modelo de disponibilidad.',
            'availability.capacity.*' => 'La capacidad va de 1 a 99 999.',
            'availability.source.*' => 'Elige la fuente de disponibilidad.',
            'model.*' => 'Elige el modelo de disponibilidad.',
            'capacity.*' => 'La capacidad va de 1 a 99 999.',
            'source.*' => 'Elige la fuente de disponibilidad.',
            ...self::contentMessages('content.'),
            ...self::contentMessages(''),
            ...self::policyMessages('policies.'),
            ...self::policyMessages(''),
            'channels.*' => 'Elige canales válidos.',
            'main_provider_id.*' => 'Elige un proveedor válido.',
            'lock_version.*' => 'Recarga la página e inténtalo de nuevo.',
            'step.*' => 'Paso no válido.',
        ];
    }

    private static function contentMessages(string $prefix): array
    {
        return [
            "{$prefix}long_description.*" => 'La descripción completa admite hasta 6000 caracteres.',
            "{$prefix}seo_title.*" => 'El título SEO admite hasta 160 caracteres.',
            "{$prefix}seo_description.*" => 'La descripción SEO admite hasta 320 caracteres.',
            "{$prefix}slug.regex" => 'El slug solo lleva minúsculas, números y guiones.',
            "{$prefix}slug.*" => 'Revisa el slug.',
            "{$prefix}video_url.*" => 'Escribe un enlace de video válido.',
            "{$prefix}inclusions.*.distinct" => 'Hay líneas repetidas en «Incluye».',
            "{$prefix}inclusions.*" => 'Cada línea de «Incluye» lleva de 2 a 200 caracteres.',
            "{$prefix}exclusions.*.distinct" => 'Hay líneas repetidas en «No incluye».',
            "{$prefix}exclusions.*" => 'Cada línea de «No incluye» lleva de 2 a 200 caracteres.',
            "{$prefix}requirements.*.category.*" => 'Elige la categoría del requisito.',
            "{$prefix}requirements.*.text.*" => 'Describe el requisito.',
            "{$prefix}faqs.*.question.*" => 'Escribe la pregunta (al menos 5 letras).',
            "{$prefix}faqs.*.answer.*" => 'Escribe la respuesta.',
            "{$prefix}media.*.url.*" => 'Escribe el enlace de la imagen.',
            "{$prefix}media.*.alt_text.*" => 'Describe la imagen en al menos 3 letras.',
        ];
    }

    private static function policyMessages(string $prefix): array
    {
        return [
            "{$prefix}cancellation.*" => 'Escribe la política de cancelación.',
            "{$prefix}modification.*" => 'Escribe la política de cambios.',
            "{$prefix}no_show.*" => 'Escribe qué pasa si el pasajero no se presenta.',
            "{$prefix}refund.*" => 'Escribe la política de reembolsos.',
            "{$prefix}penalties.*" => 'Las penalidades admiten hasta 1500 caracteres.',
            "{$prefix}date_change.*" => 'El cambio de fecha admite hasta 1500 caracteres.',
            ...CancellationTiers::messages($prefix),
        ];
    }
}
