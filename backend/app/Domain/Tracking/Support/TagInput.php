<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

final class TagInput
{
    public const CODE_FIELDS = ['measurement_id', 'script_src', 'script_body', 'sri_hash', 'csp_domains', 'page_rules', 'placement', 'consent_category'];

    private const CONFIG_FLAGS = ['server_side', 'enhanced_conversions', 'debug_mode', 'send_page_view', 'url_passthrough', 'ads_data_redaction'];

    public static function validate(array $data, TagScope $scope, ?object $current): array
    {
        $creating = $current === null;
        $rules = [
            'provider' => [$creating ? 'required' : 'prohibited', Rule::in(array_keys(TrackingCatalog::PROVIDERS))],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'min:3', 'max:80'],
            'measurement_id' => ['nullable', 'string', 'max:40'],
            'consent_category' => ['nullable', Rule::in(array_keys(TrackingCatalog::CONSENT))],
            'placement' => ['nullable', Rule::in(array_keys(TrackingCatalog::PLACEMENTS))],
            'pages' => ['nullable', 'string', 'max:500'],
            'exclude' => ['nullable', 'string', 'max:500'],
            'script_src' => ['nullable', 'string', 'max:400'],
            'sri_hash' => ['nullable', 'string', 'max:120'],
            'script_body' => ['nullable', 'string', 'max:51200'],
            'csp_domains' => ['nullable'],
            'secret' => ['nullable', 'string', 'min:8', 'max:500'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'submit' => ['nullable', 'boolean'],
            'site' => [$scope->isPlatform() && $creating ? 'required' : 'nullable', Rule::in(array_keys(TrackingCatalog::PLATFORM_SITES))],
            'lock_version' => ['nullable', 'integer', 'min:0'],
        ];

        foreach (self::CONFIG_FLAGS as $flag) {
            $rules[$flag] = ['nullable', 'boolean'];
        }

        return Validator::make($data, $rules, [
            'provider.required' => 'Elige el proveedor de la etiqueta.',
            'provider.prohibited' => 'El proveedor no se cambia. Crea una etiqueta nueva.',
            'provider.in' => 'Ese proveedor no está disponible.',
            'name.*' => 'Escribe un nombre de 3 a 80 caracteres.',
            'site.*' => 'Elige dónde carga la etiqueta: vitrina, blog o ambos.',
            'script_body.max' => 'El código no puede superar 50 KB.',
            'secret.*' => 'El token del proveedor debe tener entre 8 y 500 caracteres.',
            'starts_at.date' => 'La fecha de inicio no es válida.',
            'ends_at.date' => 'La fecha de fin no es válida.',
        ])->validate();
    }

    public static function columns(array $data, TagScope $scope, ?object $current): array
    {
        $provider = (string) ($current->provider ?? $data['provider']);
        $meta = TrackingCatalog::provider($provider);
        $isScript = $provider === 'script';
        $values = [];

        if (array_key_exists('name', $data)) {
            $values['name'] = trim((string) $data['name']);
        }

        if ($scope->isPlatform() && ! empty($data['site'])) {
            $values['site'] = $data['site'];
        }

        if (! $isScript && ($current === null || array_key_exists('measurement_id', $data))) {
            $id = trim((string) ($data['measurement_id'] ?? ''));

            if (! TrackingCatalog::idIsValid($provider, $id === '' ? null : $id)) {
                throw ApiException::unprocessable('TAG_ID_INVALID', "El {$meta['id_label']} debe tener el formato {$meta['placeholder']}.", ['field' => 'measurement_id']);
            }

            $values['measurement_id'] = $id;
        }

        if ($current === null) {
            $values['consent_category'] = $isScript ? ($data['consent_category'] ?? 'marketing') : $meta['consent'];
            $values['placement'] = $data['placement'] ?? ($isScript ? 'body_fin' : 'head');
            $values['exclude_checkout'] = true;
        } else {
            if ($isScript && ! empty($data['consent_category'])) {
                $values['consent_category'] = $data['consent_category'];
            }

            if (! empty($data['placement'])) {
                $values['placement'] = $data['placement'];
            }
        }

        if ($current === null || array_key_exists('pages', $data) || array_key_exists('exclude', $data)) {
            $previous = $current ? (array) json_decode((string) $current->page_rules, true) : ['include' => ['/*'], 'exclude' => []];
            $values['page_rules'] = TrackingCatalog::rules(
                array_key_exists('pages', $data) ? $data['pages'] : implode(',', (array) ($previous['include'] ?? ['/*'])),
                array_key_exists('exclude', $data) ? $data['exclude'] : implode(',', (array) ($previous['exclude'] ?? [])),
            );
        }

        $config = $current ? (array) json_decode((string) $current->config, true) : [];

        foreach (self::CONFIG_FLAGS as $flag) {
            if (array_key_exists($flag, $data) && $data[$flag] !== null) {
                $config[$flag] = (bool) $data[$flag];
            }
        }

        if (! TrackingCatalog::supportsServer($provider)) {
            $config['server_side'] = false;
        }

        if ($provider !== 'google_ads') {
            unset($config['enhanced_conversions']);
        }

        $values['config'] = $config;

        if ($isScript) {
            $values = [...$values, ...self::script($data, $current)];
        }

        $starts = array_key_exists('starts_at', $data) ? $data['starts_at'] : ($current->starts_at ?? null);
        $ends = array_key_exists('ends_at', $data) ? $data['ends_at'] : ($current->ends_at ?? null);

        if ($starts !== null && $ends !== null && Carbon::parse($ends)->lessThanOrEqualTo(Carbon::parse($starts))) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La fecha de fin de la campaña debe ser posterior a la de inicio.', ['field' => 'ends_at']);
        }

        if (array_key_exists('starts_at', $data)) {
            $values['starts_at'] = $starts === null ? null : Carbon::parse($starts)->utc();
        }

        if (array_key_exists('ends_at', $data)) {
            $values['ends_at'] = $ends === null ? null : Carbon::parse($ends)->utc();
        }

        return $values;
    }

    public static function encode(array $values): array
    {
        foreach (['config', 'page_rules'] as $json) {
            if (array_key_exists($json, $values)) {
                $values[$json] = json_encode($values[$json] === [] ? (object) [] : $values[$json], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        if (array_key_exists('csp_domains', $values)) {
            $values['csp_domains'] = '{'.implode(',', array_map(fn (string $domain) => '"'.$domain.'"', $values['csp_domains'])).'}';
        }

        return $values;
    }

    public static function domains(mixed $raw): array
    {
        $items = is_array($raw) ? $raw : explode(',', (string) $raw);

        return collect($items)->map(fn ($item) => strtolower(trim((string) $item)))->filter()->unique()->values()->all();
    }

    private static function script(array $data, ?object $current): array
    {
        $pick = fn (string $field) => array_key_exists($field, $data) ? (trim((string) $data[$field]) === '' ? null : trim((string) $data[$field])) : ($current->{$field} ?? null);
        $src = $pick('script_src');
        $sri = $pick('sri_hash');
        $body = array_key_exists('script_body', $data) ? (trim((string) $data['script_body']) === '' ? null : (string) $data['script_body']) : ($current->script_body ?? null);
        $domains = array_key_exists('csp_domains', $data) ? self::domains($data['csp_domains']) : self::currentDomains($current);

        if ($src === null && $body === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica la URL del script o el código en línea.', ['field' => 'script_src']);
        }

        if ($src !== null && ! str_starts_with($src, 'https://')) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La URL del script debe empezar con https://.', ['field' => 'script_src']);
        }

        if ($src !== null && ($sri === null || preg_match('/^sha(256|384|512)-[A-Za-z0-9+\/=]{20,}$/', $sri) !== 1)) {
            throw ApiException::unprocessable('SCRIPT_SRI_REQUIRED', 'Un script externo necesita su hash SRI (por ejemplo sha384-…).', ['field' => 'sri_hash']);
        }

        if ($body !== null && ($forbidden = TrackingCatalog::forbiddenCode($body)) !== null) {
            throw ApiException::unprocessable('SCRIPT_CODE_FORBIDDEN', "El código usa {$forbidden}. No se permite en un script propio.", ['field' => 'script_body']);
        }

        if ($domains === []) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Declara los dominios que el script necesita en la CSP.', ['field' => 'csp_domains']);
        }

        foreach ($domains as $domain) {
            if (preg_match('/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/', $domain) !== 1) {
                throw ApiException::unprocessable('VALIDATION_ERROR', "«{$domain}» no es un dominio válido.", ['field' => 'csp_domains']);
            }
        }

        return ['script_src' => $src, 'sri_hash' => $src === null ? null : $sri, 'script_body' => $body, 'csp_domains' => $domains, 'measurement_id' => null];
    }

    public static function currentDomains(?object $current): array
    {
        if ($current === null || $current->csp_domains === null) {
            return [];
        }

        return array_values(array_filter(array_map(fn (string $item) => trim($item, '" '), explode(',', trim((string) $current->csp_domains, '{}')))));
    }

    public static function codeChanges(array $values, object $current): array
    {
        $changes = [];

        foreach (Arr::only($values, self::CODE_FIELDS) as $field => $value) {
            $before = match ($field) {
                'page_rules' => (array) json_decode((string) $current->page_rules, true),
                'csp_domains' => self::currentDomains($current),
                default => $current->{$field},
            };

            if ($before !== $value) {
                $changes[$field] = $value;
            }
        }

        return $changes;
    }
}
