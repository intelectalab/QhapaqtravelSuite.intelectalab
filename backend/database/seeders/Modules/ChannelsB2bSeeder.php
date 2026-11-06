<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
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

            $this->upsert('channel_b2b_agencies', ['code' => $seed['id']], [
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
        }
    }
}
