<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\TenantNotice;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Showcase\Support\ShowcaseRules;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class BillShowcaseFees
{
    public function __construct(
        private readonly PlatformInvoicer $invoicer,
        private readonly PlatformSession $session,
        private readonly TenantNotice $notice,
    ) {}

    public function run(CarbonImmutable $today): array
    {
        $cutoff = $today->startOfMonth()->toDateString();
        $agencies = $this->pending($cutoff)->get()->groupBy('agency_id')->map(fn (Collection $rows): object => $rows->first());
        $count = ['invoiced' => 0, 'total' => BigDecimal::zero()->toScale(2), 'no_account' => 0, 'no_subscription' => 0];

        foreach ($agencies as $agency) {
            if ($agency->tenant_id === null) {
                $count['no_account']++;

                continue;
            }

            $subscription = $this->db()->table('subscriptions')->where('tenant_id', $agency->tenant_id)->where('status', '<>', 'canceled')->orderByDesc('created_at')->first();

            if ($subscription === null) {
                $count['no_subscription']++;

                continue;
            }

            $invoice = $this->db()->transaction(fn (): ?array => $this->bill($agency, $subscription, $cutoff));

            if ($invoice !== null) {
                $count['invoiced']++;
                $count['total'] = $count['total']->plus(Decimal::money($invoice['total']));
            }
        }

        return [...$count, 'total' => (string) $count['total']];
    }

    private function bill(object $agency, object $subscription, string $cutoff): ?array
    {
        $rows = $this->pending($cutoff)->where('l.agency_id', $agency->agency_id)->lock('for no key update of b')->get();

        if ($rows->isEmpty()) {
            return null;
        }

        $items = [];

        foreach ($rows->groupBy(fn (object $row): string => substr((string) $row->service_date, 0, 7))->sortKeys() as $month => $monthRows) {
            $label = Carbon::parse("{$month}-01")->locale('es')->translatedFormat('F Y');
            $attendees = $monthRows->where('fee_basis', 'por_asistente');
            $commissions = $monthRows->where('fee_basis', 'comision');

            if ($attendees->isNotEmpty()) {
                $items[] = ['Vitrina '.ShowcaseRules::BRAND." · {$label} · cargo por asistente ({$this->pax($attendees)} asistentes en {$attendees->count()} reservas)", 1, $this->sum($attendees, 'fee_amount'), 'usage_overage'];
            }

            if ($commissions->isNotEmpty()) {
                $items[] = ['Vitrina '.ShowcaseRules::BRAND." · {$label} · comisión de tours de pago ({$commissions->count()} reservas, ventas ".Decimal::display($this->sum($commissions, 'amount'), ShowcaseRules::FEE_CURRENCY).')', 1, $this->sum($commissions, 'fee_amount'), 'usage_overage'];
            }
        }

        if ($items === []) {
            return null;
        }

        $months = $rows->map(fn (object $row): string => (string) $row->service_date)->sort()->values();
        $from = Carbon::parse($months->first(), 'America/Lima')->startOfMonth();
        $to = Carbon::parse($months->last(), 'America/Lima')->endOfMonth()->startOfDay();
        $invoice = $this->invoicer->charge($subscription, 'manual', $from, $to, $items);
        $this->db()->table('platform_showcase_bookings')->whereIn('id', $rows->pluck('id')->all())->update(['invoice_id' => $invoice['id'], 'updated_at' => now()]);
        $this->session->log('Vitrina cargos', (string) $agency->agency_code, 'facturar', null, "{$invoice['number']} · {$rows->count()} reservas · ".Decimal::display($invoice['total'], 'PEN'));
        $this->notice->send((string) $agency->tenant_id, "Factura {$invoice['number']} de la vitrina ".ShowcaseRules::BRAND, 'Facturamos los cargos de la vitrina '.ShowcaseRules::BRAND." del {$from->format('d/m/Y')} al {$to->format('d/m/Y')}: cargos por asistente después del cupo gratis y comisiones de tours de pago. Total: ".Decimal::display($invoice['total'], 'PEN').' (incluye IGV). Puedes ver el detalle por mes en Canales › Vitrina › Cargos y comisiones.');

        return $invoice;
    }

    private function pending(string $cutoff): Builder
    {
        return $this->db()->table('platform_showcase_bookings as b')
            ->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
            ->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')
            ->whereNull('b.invoice_id')
            ->where('b.status', '<>', 'cancelada')
            ->where('b.fee_amount', '>', 0)
            ->whereIn('b.fee_basis', ['por_asistente', 'comision'])
            ->where('b.service_date', '<', $cutoff)
            ->orderBy('b.service_date')
            ->select(['b.id', 'b.service_date', 'b.pax', 'b.fee_basis', 'b.fee_amount', 'b.amount', 'l.agency_id', 'a.code as agency_code', 'a.tenant_id']);
    }

    private function sum(Collection $rows, string $field): BigDecimal
    {
        return $rows->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $sum->plus(Decimal::money($row->{$field} ?? 0)), BigDecimal::zero()->toScale(2));
    }

    private function pax(Collection $rows): int
    {
        return (int) $rows->sum('pax');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
