<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Brick\Math\BigDecimal;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ChannelsB2bSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $agencies = KitSeeds::read('b2bAgencies');
        $lists = [];

        foreach (array_unique(array_column($agencies, 'priceList')) as $name) {
            $lists[$name] = $this->upsert('channel_b2b_price_lists', ['name' => $name], [
                'year' => (int) preg_replace('/\D/', '', $name) ?: null,
                'status' => 'activa',
                'created_by' => $this->userId('U01'),
            ]);
        }

        foreach ($agencies as $seed) {
            $clientId = $this->idByCode('crm_clients', $seed['clientId']);
            $used = (float) $seed['creditUsed'];
            $limit = (float) $seed['creditLimit'];

            $agencyId = $this->upsert('channel_b2b_agencies', ['code' => $seed['id']], [
                'legal_name' => $seed['name'],
                'ruc' => $seed['ruc'],
                'contact_name' => $seed['contact'],
                'booking_email' => $clientId ? DB::table('crm_clients')->where('id', $clientId)->value('email') : null,
                'crm_client_id' => $clientId,
                'price_list_id' => $lists[$seed['priceList']],
                'commission_pct' => $seed['commissionPct'],
                'credit_currency' => $seed['currency'],
                'credit_limit' => $limit,
                'credit_used' => $used,
                'valid_from' => $this->day($seed['since']),
                'valid_to' => $this->day($seed['validTo']),
                'status' => $seed['status'],
                'block_reason' => $seed['status'] === 'bloqueada' ? ($limit > 0 && $used >= $limit ? 'credito_excedido' : 'manual') : null,
                'created_by' => $this->userId('U01'),
                'created_at' => $this->moment($seed['since'].' 09:00'),
            ]);

            $charges = $clientId ? $this->linkReservations($agencyId, $clientId, $seed) : collect();
            $this->creditMovements($agencyId, $seed, $charges);
        }
    }

    public function completeCredit(): int
    {
        $moved = 0;

        foreach (KitSeeds::read('b2bAgencies') as $seed) {
            $agency = DB::table('channel_b2b_agencies')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['id'])->first(['id', 'crm_client_id']);

            if ($agency === null) {
                continue;
            }

            $before = DB::table('channel_b2b_credit_movements')->where('agency_id', $agency->id)->count();
            $charges = $agency->crm_client_id ? $this->linkReservations((string) $agency->id, (string) $agency->crm_client_id, $seed) : collect();
            $this->creditMovements((string) $agency->id, $seed, $charges);
            $moved += DB::table('channel_b2b_credit_movements')->where('agency_id', $agency->id)->count() - $before;
        }

        return $moved;
    }

    private function linkReservations(string $agencyId, string $clientId, array $seed): Collection
    {
        $reservations = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->where('channel', 'B2B')->where('client_id', $clientId)->whereNull('deleted_at')
            ->where(fn ($query) => $query->whereNull('agency_id')->orWhere('agency_id', $agencyId))
            ->orderBy('created_at')->get(['id', 'code', 'status', 'total_amount', 'currency', 'created_at', 'b2b_terms']);

        return $reservations->map(function (object $reservation) use ($agencyId, $seed): ?object {
            $credit = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('concept', 'ilike', '%crédito%')->exists();
            $terms = [
                'price_list' => $seed['priceList'],
                'commission_pct' => (float) $seed['commissionPct'],
                'pay_mode' => $credit ? 'credito' : 'prepago',
                'agency_ref' => null,
                ...(json_decode((string) $reservation->b2b_terms, true) ?: []),
            ];
            DB::table('booking_reservations')->where('id', $reservation->id)->update(['agency_id' => $agencyId, 'b2b_terms' => json_encode($terms, JSON_UNESCAPED_UNICODE)]);

            return $terms['pay_mode'] === 'credito' && $reservation->status !== 'cancelada' && $reservation->currency === $seed['currency'] ? $reservation : null;
        })->filter()->values();
    }

    private function creditMovements(string $agencyId, array $seed, Collection $charges): void
    {
        if (DB::table('channel_b2b_credit_movements')->where('agency_id', $agencyId)->exists()) {
            return;
        }

        $used = BigDecimal::of((string) $seed['creditUsed'])->toScale(2);
        $charged = $charges->reduce(fn (BigDecimal $sum, object $row): BigDecimal => $sum->plus((string) $row->total_amount), BigDecimal::zero()->toScale(2));
        $opening = BigDecimal::max(BigDecimal::zero(), $used->minus($charged))->toScale(2);
        $balance = BigDecimal::zero()->toScale(2);
        $rows = collect();

        if ($opening->isPositive()) {
            $balance = $opening;
            $rows->push(['movement_type' => 'ajuste', 'reservation_id' => null, 'amount' => (string) $opening, 'balance_after' => (string) $balance, 'note' => 'Saldo del convenio al pasar a KipuControl', 'created_at' => $this->moment($seed['since'].' 09:05')]);
        }

        foreach ($charges as $reservation) {
            $balance = $balance->plus((string) $reservation->total_amount);
            $rows->push(['movement_type' => 'cargo_reserva', 'reservation_id' => $reservation->id, 'amount' => (string) BigDecimal::of((string) $reservation->total_amount)->toScale(2), 'balance_after' => (string) $balance, 'note' => "Reserva {$reservation->code}", 'created_at' => $reservation->created_at]);
        }

        foreach ($rows as $row) {
            DB::table('channel_b2b_credit_movements')->insert([...$row, 'tenant_id' => $this->tenant->getKey(), 'agency_id' => $agencyId, 'currency' => $seed['currency'], 'created_by' => $this->userId('U01')]);
        }

        DB::table('channel_b2b_agencies')->where('id', $agencyId)->update(['credit_used' => (string) $balance]);
    }
}
