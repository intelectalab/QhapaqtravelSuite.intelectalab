<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\Plan;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class RegisterDemoRequest
{
    private const CONNECTION = 'pgsql_platform';

    private const REPEAT_WINDOW_HOURS = 24;

    public function __construct(private readonly PlatformSession $session) {}

    public function __invoke(array $data): array
    {
        if (filled($data['website'] ?? null)) {
            return ['code' => null, 'repeated' => false];
        }

        $plan = null;

        if (filled($data['plan'] ?? null)) {
            $plan = Plan::on(self::CONNECTION)->where('code', $data['plan'])->where('status', 'active')->first()
                ?? throw ApiException::unprocessable('DEMO-BR-01', 'El plan elegido no está disponible.');
        }

        $email = Str::lower(trim((string) $data['email']));
        $previous = DB::connection(self::CONNECTION)->table('platform_demo_requests')
            ->whereRaw('lower(email) = ?', [$email])
            ->where('status', 'nueva')
            ->where('created_at', '>=', now()->subHours(self::REPEAT_WINDOW_HOURS))
            ->value('code');

        if ($previous !== null) {
            return ['code' => $previous, 'repeated' => true];
        }

        return DB::connection(self::CONNECTION)->transaction(function () use ($data, $plan, $email): array {
            $code = (string) DB::connection(self::CONNECTION)->table('platform_demo_requests')->insertGetId([
                'kind' => $data['kind'],
                'plan_id' => $plan?->getKey(),
                'billing_cycle' => $plan ? ($data['billing_cycle'] ?? 'month') : null,
                'full_name' => trim((string) $data['full_name']),
                'email' => $email,
                'phone' => $this->clean($data['phone'] ?? null),
                'company' => trim((string) $data['company']),
                'business_type' => $data['business_type'],
                'city' => $this->clean($data['city'] ?? null),
                'team_size' => $data['team_size'],
                'message' => $this->clean($data['message'] ?? null),
                'ip' => Request::ip(),
                'user_agent' => mb_substr((string) Request::userAgent(), 0, 250) ?: null,
                'consent_at' => now(),
            ], 'code');

            $this->session->log('Solicitud comercial', $code, $data['kind'] === 'trial' ? 'solicitar_prueba' : 'solicitar_demo', null, trim((string) $data['company']).($plan ? ' · '.$plan->name : ''));

            return ['code' => $code, 'repeated' => false];
        });
    }

    private function clean(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
