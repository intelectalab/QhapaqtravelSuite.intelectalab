<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ChannelsEcommerceSeeder
{
    use SeedsTenant;

    private const CHANNELS = ['erp' => 'erp', 'crm' => 'crm', 'quotes' => 'quotes', 'b2b' => 'b2b', 'portal' => 'portal', 'portalPax' => 'portal_pax', 'cms' => 'cms', 'ecommerce' => 'ecommerce', 'mobile' => 'mobile'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->publications();
        $this->orders();
    }

    private function publications(): void
    {
        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['id'], 'ref');

            if ($productId === null) {
                continue;
            }

            foreach (self::CHANNELS as $key => $channel) {
                $published = (bool) ($product['channels'][$key] ?? false);
                $this->upsert('catalog_product_channels', ['product_id' => $productId, 'channel' => $channel], [
                    'is_published' => $published,
                    'published_at' => $published ? $this->moment(($product['updatedAt'] ?? $product['createdAt'] ?? '2026-09-01').' 09:00') : null,
                    'published_by' => $published ? $this->userId('U01') : null,
                ]);
            }
        }
    }

    private function orders(): void
    {
        $subscribers = collect(KitSeeds::read('subscribers'));
        $claims = collect(KitSeeds::read('claims'))->pluck('consumer')->filter()->keyBy('name');
        $template = DB::table('crm_clients')->where('code', 'CLI-0010')->first(['owner_id', 'segment_code']);

        foreach (KitSeeds::read('ecomOrders') as $seed) {
            $client = DB::table('crm_clients')->where('name', 'ilike', $seed['customer'].'%')->first(['id', 'email', 'country']);

            if ($client === null) {
                $subscriber = $subscribers->first(fn (array $row): bool => str_starts_with($row['name'], $seed['customer']));
                $claim = $claims->get($seed['customer']);

                if ($subscriber === null || $template === null) {
                    continue;
                }

                $peruvian = ($subscriber['country'] ?? '') === 'Perú';
                $code = sprintf('CLI-%04d', (int) DB::table('crm_clients')->selectRaw("max(substring(code from '[0-9]+$')::int) as n")->value('n') + 1);
                $id = $this->upsert('crm_clients', ['email' => $subscriber['email']], [
                    'code' => $code,
                    'kind' => 'persona',
                    'name' => $subscriber['name'],
                    'doc_type' => $peruvian ? 'DNI' : 'PASAPORTE',
                    'doc_number' => $claim['docNumber'] ?? str_replace('-', '', $seed['id']),
                    'phone' => $subscriber['phone'] ?? null,
                    'country' => $subscriber['country'] ?? 'Perú',
                    'segment_code' => $template->segment_code,
                    'owner_id' => $template->owner_id,
                    'tags' => '{web}',
                    'created_by' => $this->userId('U01'),
                    'created_at' => $this->moment($seed['date']),
                ]);
                $client = (object) ['id' => $id, 'email' => $subscriber['email'], 'country' => $subscriber['country'] ?? null];
            }

            $this->upsert('channel_ecom_orders', ['code' => $seed['id']], [
                'ordered_at' => $this->moment($seed['date']),
                'crm_client_id' => $client->id,
                'customer_name' => $seed['customer'],
                'customer_email' => $client->email ?? '',
                'customer_country' => $client->country,
                'product_id' => $this->idByCode('catalog_products', $seed['product'], 'ref'),
                'pax_adults' => $seed['pax'],
                'pax_children' => 0,
                'total' => $seed['total'],
                'currency' => $seed['currency'],
                'amount_due_now' => $seed['total'],
                'status' => $seed['status'],
                'created_at' => $this->moment($seed['date']),
                'updated_at' => $this->moment($seed['date']),
            ]);
            $this->attempt($seed);
        }
    }

    private function attempt(array $seed): void
    {
        $result = ['confirmado' => 'aprobado', 'pago_rechazado' => 'rechazado', 'pago_por_validar' => 'por_validar'][$seed['status']] ?? null;
        $order = DB::table('channel_ecom_orders')->where('code', $seed['id'])->first(['id', 'ordered_at']);

        if ($result === null || $order === null || DB::table('channel_ecom_payment_attempts')->where('order_id', $order->id)->exists()) {
            return;
        }

        DB::table('channel_ecom_payment_attempts')->insert([
            'tenant_id' => $this->tenant->getKey(),
            'order_id' => $order->id,
            'attempted_at' => Carbon::parse($order->ordered_at)->addMinutes(4),
            'method' => $result === 'por_validar' ? 'transferencia' : 'tarjeta',
            'card_masked' => $result === 'por_validar' ? null : ($result === 'aprobado' ? '•••• 4242' : '•••• 0002'),
            'operation_ref' => $result === 'por_validar' ? 'OP-'.substr($seed['id'], -5) : null,
            'result' => $result,
            'gateway_code' => match ($result) {
                'aprobado' => '00',
                'rechazado' => '51',
                default => null,
            },
            'message' => match ($result) {
                'aprobado' => 'Aprobado',
                'rechazado' => 'Fondos insuficientes. Prueba con otra tarjeta u otro medio de pago.',
                default => 'Pago informado; lo validamos en un plazo de 4 horas hábiles.',
            },
            'gateway_txn_id' => $result === 'aprobado' ? 'SBX-'.substr($seed['id'], -5) : null,
            'amount' => $seed['total'],
            'currency' => $seed['currency'],
        ]);
    }
}
