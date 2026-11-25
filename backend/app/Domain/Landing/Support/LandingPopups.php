<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class LandingPopups
{
    public const TRIGGERS = ['salida' => 'Intención de salida', 'scroll_60' => '60 % de lectura', 'tiempo_30s' => '30 s en la página'];

    public const KINDS = ['prueba' => 'Prueba gratis con correo', 'boletin' => 'Suscripción al boletín', 'enlace' => 'Botón con enlace'];

    public const PAGES = ['inicio' => 'Inicio', 'planes' => 'Planes', 'modulos' => 'Módulos', 'blog' => 'Lista del blog', 'articulo' => 'Artículos del blog', 'agencias' => 'Agencias', 'contacto' => 'Contacto'];

    public const STATUSES = ['borrador' => 'Borrador', 'activo' => 'Activo', 'pausado' => 'Pausado'];

    public const TRANSITIONS = ['borrador' => ['activo'], 'activo' => ['pausado'], 'pausado' => ['activo']];

    private const ENTITY = 'Popup landing';

    public function __construct(private readonly PlatformSession $session) {}

    public function list(): array
    {
        $rows = $this->db()->table('platform_landing_popups')->orderBy('code')->get();

        return [
            'items' => $rows->map(fn (object $row): array => $this->present($row))->values()->all(),
            'counts' => ['total' => $rows->count(), ...collect(array_keys(self::STATUSES))->mapWithKeys(fn (string $key): array => [$key => $rows->where('status', $key)->count()])->all(), 'views' => (int) $rows->sum('views'), 'conversions' => (int) $rows->sum('conversions')],
            'options' => [
                'triggers' => $this->options(self::TRIGGERS),
                'kinds' => $this->options(self::KINDS),
                'pages' => $this->options(self::PAGES),
                'statuses' => $this->options(self::STATUSES),
            ],
        ];
    }

    public function active(string $page): array
    {
        return $this->db()->table('platform_landing_popups')->where('status', 'activo')->whereRaw('? = any(pages)', [$page])->orderBy('code')->get()
            ->map(fn (object $row): array => [
                'code' => (string) $row->code,
                'trigger' => (string) $row->trigger,
                'kind' => (string) $row->kind,
                'freq_days' => (int) $row->freq_days,
                'eyebrow' => $row->eyebrow,
                'title' => (string) $row->title,
                'body' => (string) $row->body,
                'cta_label' => (string) $row->cta_label,
                'cta_href' => $row->cta_href,
            ])->values()->all();
    }

    public function record(string $code, string $event): array
    {
        $column = $event === 'conversion' ? 'conversions' : 'views';
        $updated = $this->db()->table('platform_landing_popups')->where('code', strtoupper($code))->where('status', 'activo')->increment($column);

        if ($updated === 0) {
            throw ApiException::notFound('El popup no existe o está pausado.');
        }

        return ['code' => strtoupper($code), 'event' => $event];
    }

    public function create(array $data, PlatformUser $actor): array
    {
        $code = $this->db()->transaction(function () use ($data, $actor): string {
            $this->db()->select('select pg_advisory_xact_lock(hashtext(?))', ['platform_landing_popups:code']);
            $last = (string) $this->db()->table('platform_landing_popups')->max('code');
            $code = sprintf('POP-%02d', (preg_match('/^POP-(\d+)$/', $last, $match) === 1 ? (int) $match[1] : 0) + 1);
            $this->db()->table('platform_landing_popups')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                ...$this->fields($data),
                'status' => 'borrador',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $code;
        });
        $this->session->log(self::ENTITY, $code, 'crear', null, (string) $data['name'].' · borrador', $actor);

        return $this->find($code);
    }

    public function update(string $code, array $data, PlatformUser $actor): array
    {
        $current = $this->row($code);
        $fields = $this->fields([...$this->editable($current), ...$data]);
        $changed = array_keys(array_filter($fields, fn ($value, string $key): bool => $this->normalized($value) !== $this->normalized($this->editable($current)[$key] ?? null), ARRAY_FILTER_USE_BOTH));

        if ($changed === []) {
            throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
        }

        $this->db()->table('platform_landing_popups')->where('id', $current->id)->update([...$fields, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->session->log(self::ENTITY, (string) $current->code, 'editar', null, implode(', ', $changed), $actor);

        return $this->find((string) $current->code);
    }

    public function transition(string $code, string $status, PlatformUser $actor): array
    {
        $current = $this->row($code);

        if (! in_array($status, self::TRANSITIONS[$current->status] ?? [], true)) {
            throw ApiException::unprocessable('LND-13', 'El popup está '.mb_strtolower(self::STATUSES[$current->status]).' y no puede pasar a '.mb_strtolower(self::STATUSES[$status] ?? $status).'.');
        }

        $this->db()->table('platform_landing_popups')->where('id', $current->id)->update(['status' => $status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->session->log(self::ENTITY, (string) $current->code, $status === 'activo' ? 'activar' : 'pausar', self::STATUSES[$current->status], self::STATUSES[$status], $actor);

        return $this->find((string) $current->code);
    }

    public function delete(string $code, PlatformUser $actor): void
    {
        $current = $this->row($code);

        if ($current->status === 'activo') {
            throw ApiException::conflict('LND-13', 'Pausa el popup antes de eliminarlo.');
        }

        $this->db()->table('platform_landing_popups')->where('id', $current->id)->delete();
        $this->session->log(self::ENTITY, (string) $current->code, 'eliminar', (string) $current->name, null, $actor);
    }

    public function find(string $code): array
    {
        return $this->present($this->row($code));
    }

    private function fields(array $data): array
    {
        $pages = array_values(array_unique(array_filter((array) ($data['pages'] ?? []), fn ($page): bool => is_string($page) && isset(self::PAGES[$page]))));
        $kind = (string) $data['kind'];
        $href = blank($data['cta_href'] ?? null) ? null : trim((string) $data['cta_href']);

        if ($pages === []) {
            throw ValidationException::withMessages(['pages' => 'Elige al menos una página.']);
        }

        if ($kind === 'enlace' && $href === null) {
            throw ValidationException::withMessages(['cta_href' => 'Indica a qué página lleva el botón.']);
        }

        if ($href !== null && (! str_starts_with($href, '/') || str_starts_with($href, '//'))) {
            throw ValidationException::withMessages(['cta_href' => 'Usa una ruta del sitio que empiece con «/».']);
        }

        return [
            'name' => trim((string) $data['name']),
            'trigger' => (string) $data['trigger'],
            'kind' => $kind,
            'pages' => '{'.implode(',', $pages).'}',
            'freq_days' => (int) ($data['freq_days'] ?? 7),
            'eyebrow' => blank($data['eyebrow'] ?? null) ? null : trim((string) $data['eyebrow']),
            'title' => trim((string) $data['title']),
            'body' => trim((string) $data['body']),
            'cta_label' => trim((string) $data['cta_label']),
            'cta_href' => $href,
        ];
    }

    private function editable(object $row): array
    {
        return [
            'name' => $row->name,
            'trigger' => $row->trigger,
            'kind' => $row->kind,
            'pages' => $this->pages($row->pages),
            'freq_days' => (int) $row->freq_days,
            'eyebrow' => $row->eyebrow,
            'title' => $row->title,
            'body' => $row->body,
            'cta_label' => $row->cta_label,
            'cta_href' => $row->cta_href,
        ];
    }

    private function normalized(mixed $value): string
    {
        return is_array($value) ? '{'.implode(',', $value).'}' : (string) $value;
    }

    private function present(object $row): array
    {
        $views = (int) $row->views;

        return [
            ...$this->editable($row),
            'id' => (string) $row->id,
            'code' => (string) $row->code,
            'trigger_label' => self::TRIGGERS[$row->trigger] ?? $row->trigger,
            'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
            'page_labels' => array_map(fn (string $page): string => self::PAGES[$page] ?? $page, $this->pages($row->pages)),
            'status' => (string) $row->status,
            'status_label' => self::STATUSES[$row->status] ?? $row->status,
            'next' => array_map(fn (string $status): array => ['value' => $status, 'label' => $status === 'activo' ? 'Activar' : 'Pausar'], self::TRANSITIONS[$row->status] ?? []),
            'views' => $views,
            'conversions' => (int) $row->conversions,
            'conversion_pct' => $views > 0 ? round((int) $row->conversions / $views * 100, 1) : null,
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
        ];
    }

    private function pages(mixed $value): array
    {
        $inner = trim((string) $value, '{}');

        return $inner === '' ? [] : explode(',', $inner);
    }

    private function row(string $code): object
    {
        return $this->db()->table('platform_landing_popups')->where('code', strtoupper(trim($code)))->first() ?? throw ApiException::notFound('El popup no existe.');
    }

    private function options(array $map): array
    {
        return collect($map)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
