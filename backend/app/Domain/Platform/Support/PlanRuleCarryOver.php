<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PlanRuleCarryOver
{
    private const ITEMS = [
        'R-GIFT-CARDS' => ['one' => 'vale vigente', 'many' => 'vales vigentes', 'kept' => 'se consultan y canjean hasta vencer'],
        'R-PAY-LINKS' => ['one' => 'link de pago abierto', 'many' => 'links de pago abiertos', 'kept' => 'se pueden pagar hasta su vencimiento'],
        'R-QR-CHECKIN' => ['one' => 'pase QR por usar', 'many' => 'pases QR por usar', 'kept' => 'siguen sirviendo en el check-in'],
        'R-CORP-PORTAL' => ['one' => 'cuenta corporativa activa', 'many' => 'cuentas corporativas activas', 'kept' => 'su portal queda en solo lectura'],
    ];

    public function __construct(private readonly TenantDatabase $tenants, private readonly TenantContext $context) {}

    public function summary(string $tenantId, array $lostCodes, string $timezone = 'America/Lima'): array
    {
        $codes = array_values(array_intersect(array_keys(self::ITEMS), $lostCodes));

        if ($codes === []) {
            return ['items' => [], 'notice' => null];
        }

        $today = Carbon::today($timezone)->toDateString();
        $previous = $this->context->id();

        try {
            $items = $this->items($tenantId, $codes, $today);
        } finally {
            $previous === null ? $this->context->clear() : $this->context->set($previous);
        }

        return ['items' => $items, 'notice' => $this->notice($items)];
    }

    private function items(string $tenantId, array $codes, string $today): array
    {
        return $this->tenants->run($tenantId, fn (): array => collect($codes)
            ->map(fn (string $code): array => ['rule' => $code, 'count' => $this->count($code, $today)])
            ->filter(fn (array $item): bool => $item['count'] > 0)
            ->map(fn (array $item): array => [
                ...$item,
                'noun' => self::ITEMS[$item['rule']][$item['count'] === 1 ? 'one' : 'many'],
                'label' => $item['count'].' '.self::ITEMS[$item['rule']][$item['count'] === 1 ? 'one' : 'many'],
                'kept' => self::ITEMS[$item['rule']]['kept'],
            ])
            ->values()
            ->all());
    }

    private function count(string $code, string $today): int
    {
        return match ($code) {
            'R-GIFT-CARDS' => DB::table('fin_gift_cards')->where('status', 'activa')->where('expires_at', '>=', $today)->count(),
            'R-PAY-LINKS' => DB::table('fin_payment_links')->where('status', 'activo')->where('expires_at', '>', now())->count(),
            'R-QR-CHECKIN' => DB::table('ops_checkin_passes as p')->join('booking_reservation_services as s', 's.id', '=', 'p.service_id')->where('p.status', 'emitido')->where('s.service_date', '>=', $today)->count(),
            'R-CORP-PORTAL' => DB::table('crm_corporate_accounts')->where('status', 'activa')->count(),
            default => 0,
        };
    }

    private function notice(array $items): ?string
    {
        if ($items === []) {
            return null;
        }

        $labels = array_column($items, 'label');
        $last = array_pop($labels);
        $list = $labels === [] ? $last : implode(', ', $labels).' y '.$last;

        return "Tienes {$list}: se respetarán, pero no podrás crear nuevos.";
    }
}
