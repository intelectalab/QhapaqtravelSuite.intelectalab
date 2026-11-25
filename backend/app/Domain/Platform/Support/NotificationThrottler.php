<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class NotificationThrottler
{
    public const CODE = 'QUOTA_EXCEEDED';

    public const METRICS = ['email' => 'email_month', 'whatsapp' => 'whatsapp_month'];

    public const EXEMPT_EVENTS = ['usuario.invitado', 'arco.solicitud'];

    public const EXEMPT_PREFIXES = ['seguridad.'];

    private const LABELS = ['email_month' => 'correos', 'whatsapp_month' => 'mensajes de WhatsApp'];

    private const ZONE = 'America/Lima';

    public function __construct(private readonly TenantContext $context) {}

    public static function exempt(?string $event): bool
    {
        if ($event === null || $event === '') {
            return false;
        }

        if (in_array($event, self::EXEMPT_EVENTS, true)) {
            return true;
        }

        foreach (self::EXEMPT_PREFIXES as $prefix) {
            if (str_starts_with($event, $prefix)) {
                return true;
            }
        }

        return false;
    }

    public function reason(string $channel, ?string $tenantId = null, ?string $event = null): ?string
    {
        $metric = self::METRICS[mb_strtolower($channel)] ?? null;
        $tenantId ??= $this->context->id();

        if ($metric === null || $tenantId === null || self::exempt($event)) {
            return null;
        }

        $plan = DB::connection('pgsql_platform')->table('tenants')->where('id', $tenantId)->value('plan_id');

        if ($plan === null || ! UsageMeter::exhausted($tenantId, (string) $plan, $metric)) {
            return null;
        }

        $limit = (int) EffectiveLimits::limit($tenantId, (string) $plan, $metric);

        return 'Tu agencia ya usó los '.number_format($limit, 0, '.', ' ').' '.self::LABELS[$metric].' que incluye su plan este mes: el envío queda en espera hasta el '
            .$this->resumesAt()->format('d/m/Y').' o hasta que mejores el plan.';
    }

    public function resumesAt(): CarbonImmutable
    {
        return CarbonImmutable::now(self::ZONE)->startOfMonth()->addMonth()->setTime(8, 0);
    }
}
