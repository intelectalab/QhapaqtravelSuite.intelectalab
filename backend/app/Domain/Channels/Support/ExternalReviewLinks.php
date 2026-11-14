<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ExternalReviewLinks
{
    public const SECTION = 'notifications';

    public const KEY = 'review_links';

    public const PLATFORMS = [
        'google' => [
            'label' => 'Google',
            'invite' => 'Opina también en Google',
            'hosts' => ['g.page', 'search.google.com', 'www.google.com', 'google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl', 'g.co', 'business.google.com'],
            'example' => 'https://g.page/r/tu-negocio/review',
        ],
        'tripadvisor' => [
            'label' => 'TripAdvisor',
            'invite' => 'Opina también en TripAdvisor',
            'pattern' => '/^([a-z0-9-]+\.)?tripadvisor\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/',
            'example' => 'https://www.tripadvisor.com.pe/UserReviewEdit-g294314-d1234567',
        ],
    ];

    public function __construct(private readonly TenantSettings $settings, private readonly AuditLogger $audit) {}

    public function read(): array
    {
        $stored = (array) ($this->settings->section(self::SECTION)[self::KEY] ?? []);

        return collect(self::PLATFORMS)->mapWithKeys(fn (array $platform, string $key): array => [$key => is_string($stored[$key] ?? null) && $stored[$key] !== '' ? $stored[$key] : null])->all();
    }

    public function loaded(): array
    {
        return array_filter($this->read());
    }

    public function overview(): array
    {
        $row = DB::table('sys_settings as s')->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')->where('s.section', self::SECTION)->first(['s.lock_version', 's.updated_at', 'u.name']);
        $links = $this->read();

        return [
            'platforms' => collect(self::PLATFORMS)->map(fn (array $platform, string $key): array => [
                'platform' => $key,
                'label' => $platform['label'],
                'url' => $links[$key],
                'example' => $platform['example'],
                'invite' => $platform['invite'],
            ])->values()->all(),
            'lock_version' => (int) ($row->lock_version ?? 0),
            'updated_at' => $row->updated_at ?? null,
            'updated_by' => $row->name ?? null,
        ];
    }

    public static function check(string $platform, ?string $url): array
    {
        $definition = self::PLATFORMS[$platform] ?? null;
        $url = trim((string) $url);

        if ($definition === null) {
            return ['ok' => false, 'message' => 'Elige Google o TripAdvisor.'];
        }

        $parts = parse_url($url);
        $host = Str::lower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');

        $message = match (true) {
            $url === '' => 'Pega el enlace público de reseñas.',
            ! is_array($parts) || ! isset($parts['scheme'], $parts['host']) => 'El enlace no tiene un formato válido: debe empezar con https://.',
            Str::lower((string) $parts['scheme']) !== 'https' => 'El enlace debe empezar con https://.',
            isset($parts['user']) || isset($parts['pass']) || isset($parts['port']) => 'El enlace no puede llevar usuario, clave ni puerto.',
            ! self::hostMatches($definition, $host) => "El enlace no es de {$definition['label']}. Copia el enlace desde tu perfil de {$definition['label']}.",
            trim($path, '/') === '' && ! isset($parts['query']) => "Falta la dirección de tu negocio en {$definition['label']}: copia el enlace completo de reseñas.",
            default => null,
        };

        return $message === null
            ? ['ok' => true, 'message' => "Enlace de {$definition['label']} válido. Revisamos el formato y el dominio; ábrelo una vez para confirmar que lleva a tu negocio.", 'url' => $url, 'host' => $host]
            : ['ok' => false, 'message' => $message];
    }

    public function save(array $data, User $actor, ?int $expected): array
    {
        $errors = [];

        foreach (array_keys(self::PLATFORMS) as $platform) {
            if (array_key_exists($platform, $data) && filled($data[$platform])) {
                $result = self::check($platform, (string) $data[$platform]);

                if (! $result['ok']) {
                    $errors[$platform] = $result['message'];
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return DB::transaction(function () use ($data, $actor, $expected): array {
            $row = DB::table('sys_settings')->where('section', self::SECTION)->lockForUpdate()->first(['lock_version']);

            if ($expected !== null && $row !== null) {
                IfMatch::assertMatches($expected, (int) $row->lock_version, 'Los enlaces de reseñas');
            }

            $before = $this->read();
            $after = $before;

            foreach (array_keys(self::PLATFORMS) as $platform) {
                if (array_key_exists($platform, $data)) {
                    $after[$platform] = filled($data[$platform]) ? trim((string) $data[$platform]) : null;
                }
            }

            if ($before === $after) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->save(self::SECTION, [...$this->settings->section(self::SECTION), self::KEY => $after], $actor);

            foreach (array_keys(self::PLATFORMS) as $platform) {
                if ($before[$platform] !== $after[$platform]) {
                    $this->audit->log('Reseña externa', 'enlace.'.$platform, $after[$platform] === null ? 'quitar_enlace' : 'actualizar_enlace', $before[$platform], $after[$platform], actor: $actor);
                }
            }

            return $this->overview();
        });
    }

    public function invitationLines(string $subdomain, string $tenantId, string $code): array
    {
        $base = WidgetHosts::site($subdomain).'/resena/'.rawurlencode($code);
        $token = ReviewLinks::token($tenantId, $code);

        return collect($this->loaded())->map(fn (string $url, string $platform): string => self::PLATFORMS[$platform]['invite'].": {$base}/{$platform}?t={$token}")->values()->all();
    }

    private static function hostMatches(array $definition, string $host): bool
    {
        if (isset($definition['hosts'])) {
            return in_array($host, $definition['hosts'], true);
        }

        return preg_match($definition['pattern'], $host) === 1;
    }
}
