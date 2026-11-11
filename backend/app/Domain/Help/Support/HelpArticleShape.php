<?php

declare(strict_types=1);

namespace App\Domain\Help\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class HelpArticleShape
{
    public const ENTITY = 'Artículo de ayuda';

    public const AUDIENCES = ['agency' => 'Agencias', 'platform' => 'Consola de plataforma'];

    public const ORIGINS = ['qhapaq' => 'Versión de Qhapaq', 'adaptado' => 'Adaptado por la agencia', 'propio' => 'Propio de la agencia'];

    public const CONTENT = ['module', 'screen', 'title', 'summary', 'steps', 'faqs', 'keywords', 'roles', 'sort_order'];

    public const COLUMNS = ['id', 'tenant_id', 'slug', 'audience', 'module', 'screen', 'title', 'summary', 'steps', 'faqs', 'keywords', 'roles', 'sort_order', 'status', 'lock_version', 'updated_at'];

    public static function rules(bool $withAudience = false): array
    {
        return [
            ...($withAudience ? ['audience' => ['required', Rule::in(array_keys(self::AUDIENCES))]] : []),
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'module' => ['required', 'string', 'min:2', 'max:60'],
            'screen' => ['required', 'string', 'max:120', 'regex:/^\/[a-z0-9\/_-]*$/'],
            'summary' => ['required', 'string', 'min:10', 'max:600'],
            'steps' => ['present', 'array', 'max:8'],
            'steps.*.title' => ['required', 'string', 'min:2', 'max:120'],
            'steps.*.text' => ['required', 'string', 'min:2', 'max:600'],
            'faqs' => ['present', 'array', 'max:10'],
            'faqs.*.question' => ['required', 'string', 'min:3', 'max:200'],
            'faqs.*.answer' => ['required', 'string', 'min:2', 'max:800'],
            'keywords' => ['sometimes', 'array', 'max:12'],
            'keywords.*' => ['string', 'min:2', 'max:40'],
            'roles' => ['sometimes', 'array'],
            'roles.*' => [Rule::in(self::backofficeRoles())],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:99999'],
        ];
    }

    public static function messages(): array
    {
        return [
            'audience.*' => 'Elige para quién es el artículo.',
            'title.*' => 'Escribe un título de 3 a 160 caracteres.',
            'module.*' => 'Elige el módulo del artículo.',
            'screen.*' => 'Indica la ruta de la pantalla, por ejemplo /crm/clientes.',
            'summary.*' => 'Escribe de qué trata la pantalla (10 a 600 caracteres).',
            'steps.present' => 'Agrega los pasos, aunque sea una lista vacía.',
            'steps.max' => 'Usa como máximo 8 pasos.',
            'steps.*.title.*' => 'Cada paso necesita un título.',
            'steps.*.text.*' => 'Cada paso necesita su explicación.',
            'faqs.present' => 'Agrega las preguntas frecuentes, aunque sea una lista vacía.',
            'faqs.max' => 'Usa como máximo 10 preguntas.',
            'faqs.*.question.*' => 'Cada pregunta necesita su texto.',
            'faqs.*.answer.*' => 'Cada pregunta necesita su respuesta.',
            'keywords.*' => 'Cada palabra clave tiene de 2 a 40 caracteres, máximo 12.',
            'roles.*' => 'Elige roles válidos del back-office.',
            'sort_order.*' => 'El orden es un número de 0 a 99999.',
        ];
    }

    public static function backofficeRoles(): array
    {
        return collect(config('access.roles'))->filter(fn (array $role): bool => $role['experience'] === 'backoffice')->keys()->all();
    }

    public static function values(array $data): array
    {
        $values = [];

        foreach (['module', 'screen', 'title', 'summary'] as $key) {
            if (array_key_exists($key, $data)) {
                $values[$key] = trim((string) $data[$key]);
            }
        }

        if (array_key_exists('steps', $data)) {
            $values['steps'] = self::encode(collect($data['steps'])->map(fn (array $step): array => ['title' => trim((string) $step['title']), 'text' => trim((string) $step['text'])])->values()->all());
        }

        if (array_key_exists('faqs', $data)) {
            $values['faqs'] = self::encode(collect($data['faqs'])->map(fn (array $faq): array => ['question' => trim((string) $faq['question']), 'answer' => trim((string) $faq['answer'])])->values()->all());
        }

        if (array_key_exists('keywords', $data)) {
            $values['keywords'] = self::encode(collect($data['keywords'])->map(fn (string $word): string => trim(mb_strtolower($word)))->filter()->unique()->values()->all());
        }

        if (array_key_exists('roles', $data)) {
            $values['roles'] = self::encode(collect($data['roles'])->unique()->sort()->values()->all());
        }

        if (array_key_exists('sort_order', $data) && $data['sort_order'] !== null) {
            $values['sort_order'] = (int) $data['sort_order'];
        }

        return $values;
    }

    public static function changed(object $row, array $values): bool
    {
        foreach ($values as $key => $value) {
            $current = $row->{$key} ?? null;

            if (in_array($key, ['steps', 'faqs', 'keywords', 'roles'], true)) {
                if (self::canonical(self::decode($current)) !== self::canonical((array) json_decode((string) $value, true))) {
                    return true;
                }

                continue;
            }

            if ((string) $current !== (string) $value) {
                return true;
            }
        }

        return false;
    }

    private static function canonical(array $value): array
    {
        return array_map(function (mixed $item): mixed {
            if (! is_array($item)) {
                return $item;
            }

            ksort($item);

            return $item;
        }, array_values($value));
    }

    public static function copy(object $row): array
    {
        return [
            'slug' => $row->slug,
            'audience' => $row->audience,
            'module' => $row->module,
            'screen' => $row->screen,
            'title' => $row->title,
            'summary' => $row->summary,
            'steps' => self::encode(self::decode($row->steps)),
            'faqs' => self::encode(self::decode($row->faqs)),
            'keywords' => self::encode(self::decode($row->keywords)),
            'roles' => self::encode(self::decode($row->roles)),
            'sort_order' => (int) $row->sort_order,
        ];
    }

    public static function summary(object $row, string $origin): array
    {
        return [
            'slug' => $row->slug,
            'audience' => $row->audience,
            'module' => $row->module,
            'screen' => $row->screen,
            'title' => $row->title,
            'summary' => $row->summary,
            'roles' => self::decode($row->roles),
            'steps_count' => count(self::decode($row->steps)),
            'faqs_count' => count(self::decode($row->faqs)),
            'status' => $row->status,
            'origin' => $origin,
            'origin_label' => self::ORIGINS[$origin] ?? $origin,
            'sort_order' => (int) $row->sort_order,
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
        ];
    }

    public static function full(object $row, string $origin): array
    {
        return [
            ...self::summary($row, $origin),
            'steps' => self::decode($row->steps),
            'faqs' => self::decode($row->faqs),
            'keywords' => self::decode($row->keywords),
            'lock_version' => (int) $row->lock_version,
        ];
    }

    public static function haystack(object $row): string
    {
        $parts = [$row->title, $row->summary, $row->module, ...self::decode($row->keywords)];

        foreach (self::decode($row->steps) as $step) {
            $parts[] = $step['title'].' '.$step['text'];
        }

        foreach (self::decode($row->faqs) as $faq) {
            $parts[] = $faq['question'].' '.$faq['answer'];
        }

        return self::normalize(implode(' ', $parts));
    }

    public static function matches(object $row, string $query): bool
    {
        $terms = array_filter(explode(' ', self::normalize($query)));

        if ($terms === []) {
            return true;
        }

        $haystack = self::haystack($row);

        return collect($terms)->every(fn (string $term): bool => str_contains($haystack, $term));
    }

    public static function rank(object $row, string $query): int
    {
        $title = self::normalize($row->title);
        $terms = array_filter(explode(' ', self::normalize($query)));

        return collect($terms)->sum(fn (string $term): int => str_contains($title, $term) ? 3 : (str_contains(self::normalize(implode(' ', self::decode($row->keywords))), $term) ? 2 : 1));
    }

    public static function normalize(string $text): string
    {
        return trim((string) preg_replace('/\s+/', ' ', Str::ascii(mb_strtolower($text))));
    }

    public static function covers(string $screen, string $path): bool
    {
        return $path === $screen || ($screen !== '/' && str_starts_with($path, rtrim($screen, '/').'/'));
    }

    public static function decode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        return (array) json_decode((string) ($value ?? '[]'), true);
    }

    public static function encode(array $value): string
    {
        return (string) json_encode(array_values($value), JSON_UNESCAPED_UNICODE);
    }
}
