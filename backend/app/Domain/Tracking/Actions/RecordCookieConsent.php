<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Actions;

use App\Domain\Tracking\Support\SiteTags;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class RecordCookieConsent
{
    public static function validate(array $input): array
    {
        return Validator::make($input, [
            'visitor_id' => ['nullable', 'uuid'],
            'analytics' => ['required', 'boolean'],
            'marketing' => ['required', 'boolean'],
            'choice' => ['nullable', 'in:aceptar_todo,rechazar,configurar'],
            'policy_version' => ['required', 'string', 'max:20'],
            'site' => ['nullable', 'in:vitrina,blog,landing'],
        ], [
            'visitor_id.uuid' => 'El identificador del visitante no es válido.',
            'analytics.*' => 'Indica si aceptas las cookies analíticas.',
            'marketing.*' => 'Indica si aceptas las cookies de marketing.',
            'policy_version.*' => 'Falta la versión de la política de cookies.',
        ])->validate();
    }

    public function __invoke(array $data, ?string $site, string $ip, string $userAgent): array
    {
        $analytics = (bool) $data['analytics'];
        $marketing = (bool) $data['marketing'];
        $visitor = $data['visitor_id'] ?? (string) Str::uuid7();
        $row = [
            'id' => (string) Str::uuid7(),
            'visitor_id' => $visitor,
            'policy_version' => (string) $data['policy_version'],
            'analytics' => $analytics,
            'marketing' => $marketing,
            'choice' => $data['choice'] ?? ($analytics && $marketing ? 'aceptar_todo' : (! $analytics && ! $marketing ? 'rechazar' : 'configurar')),
            'ip_hash' => hash('sha256', 'consent|'.$ip.'|'.now()->toDateString().'|'.config('app.key')),
            'user_agent' => mb_substr($userAgent, 0, 250) ?: null,
            'created_at' => now(),
        ];

        if ($site !== null) {
            DB::connection('pgsql_platform')->table('platform_cookie_consents')->insert([...$row, 'site' => $site]);
        } else {
            DB::table('cms_cookie_consents')->insert($row);
        }

        return [
            'visitor_id' => $visitor,
            'analytics' => $analytics,
            'marketing' => $marketing,
            'policy_version' => $row['policy_version'],
            'current_policy' => SiteTags::POLICY_VERSION,
            'recorded_at' => now()->toIso8601String(),
        ];
    }

    public static function marketingGranted(string $visitorId, ?string $site = null): bool
    {
        $query = $site !== null
            ? DB::connection('pgsql_platform')->table('platform_cookie_consents')->where('site', $site)
            : DB::table('cms_cookie_consents');

        return (bool) $query->where('visitor_id', $visitorId)->orderByDesc('created_at')->orderByDesc('id')->value('marketing');
    }
}
