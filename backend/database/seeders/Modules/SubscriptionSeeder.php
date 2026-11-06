<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SubscriptionSeeder
{
    use SeedsTenant;

    private const ADDON_PRICES = ['whatsapp_pack' => 65, 'custom_domain' => 45];

    private const INVOICE_STATUS = ['pagada' => 'paid', 'fallida' => 'failed', 'pendiente' => 'open', 'anulada' => 'void'];

    private const SUNAT_STATUS = ['aceptado' => 'accepted', 'observado' => 'observed', 'rechazado' => 'rejected'];

    private const USAGE = ['reservations' => 'reservations_month', 'whatsapp' => 'whatsapp_month', 'email' => 'email_month', 'apiCalls' => 'api_calls_month', 'storageGB' => 'storage_gb'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $seed = KitSeeds::read('subscription');

        if ($seed['tenantId'] !== $this->tenant->code) {
            return;
        }

        $owner = $this->userId('U01');
        $billing = $seed['billing'];
        $periodStart = Carbon::parse($this->day($seed['periodStart']));
        $values = [
            'tenant_id' => $this->tenant->getKey(),
            'plan_id' => $this->tenant->plan_id,
            'cycle' => $seed['cycle'] === 'anual' ? 'annual' : 'monthly',
            'status' => $seed['status'] === 'activa' ? 'active' : 'trialing',
            'trial_starts_at' => $seed['trialStart'],
            'trial_ends_at' => $seed['trialEnd'],
            'current_period_start' => $periodStart->toDateString(),
            'current_period_end' => $this->day($seed['periodEnd']),
            'billing_anchor_day' => min(28, $periodStart->day),
            'auto_renew' => (bool) $seed['autoRenew'],
            'credit_balance' => $seed['creditBalance'] ?? 0,
            'gateway' => 'local_gateway',
            'billing_ruc' => $billing['ruc'],
            'billing_name' => $billing['name'],
            'billing_address' => $billing['address'],
            'billing_ubigeo' => $billing['ubigeo'] ?? null,
            'billing_email' => $billing['email'],
            'created_by' => null,
            'updated_at' => now(),
        ];
        $subscriptionId = DB::table('subscriptions')->where('code', $seed['id'])->value('id');

        if ($subscriptionId) {
            DB::table('subscriptions')->where('id', $subscriptionId)->update($values);
        } else {
            $subscriptionId = (string) Str::uuid7();
            DB::table('subscriptions')->insert(['id' => $subscriptionId, 'code' => $seed['id'], 'created_at' => $this->moment($seed['customerSince'].' 09:00'), ...$values]);
        }

        foreach ($seed['addons'] as $addon) {
            DB::table('subscription_items')->updateOrInsert(
                ['subscription_id' => $subscriptionId, 'addon_code' => $addon['key'], 'ends_at' => null],
                [
                    'quantity' => $addon['qty'],
                    'meta' => isset($addon['meta']) ? json_encode(['domain' => $addon['meta'], 'ssl' => $addon['ssl'] ?? null], JSON_UNESCAPED_UNICODE) : null,
                    'starts_at' => $this->day($addon['since']),
                    'unit_price' => self::ADDON_PRICES[$addon['key']] ?? 0,
                    'created_by' => $owner,
                    'updated_at' => now(),
                ],
            );
        }

        $this->invoices((string) $subscriptionId);
        $this->usage($seed);
    }

    private function invoices(string $subscriptionId): void
    {
        foreach (KitSeeds::read('platformInvoices') as $row) {
            if ($row['tenantId'] !== $this->tenant->code) {
                continue;
            }

            [$series, $number] = explode('-', $row['id']);

            $values = [
                'tenant_id' => $this->tenant->getKey(),
                'subscription_id' => $subscriptionId,
                'kind' => $row['kind'] === 'suscripcion' ? 'subscription' : 'addon',
                'period_from' => $this->day($row['periodFrom']),
                'period_to' => $this->day($row['periodTo']),
                'issue_date' => $this->day($row['issueDate']),
                'due_date' => $this->day($row['dueDate']),
                'currency' => $row['currency'],
                'subtotal' => $row['subtotal'],
                'igv' => $row['igv'],
                'total' => $row['total'],
                'status' => self::INVOICE_STATUS[$row['status']] ?? 'open',
                'paid_at' => $this->moment($row['paidAt']),
                'payment_ref' => $row['method'] ?? null,
                'bill_to' => json_encode($row['billTo'], JSON_UNESCAPED_UNICODE),
                'sunat_status' => self::SUNAT_STATUS[$row['sunat'] ?? ''] ?? 'pending',
                'sunat_hash' => $row['hash'] ?? null,
                'created_at' => $this->moment($row['issueDate'].' 06:00'),
                'updated_at' => now(),
            ];
            $existing = DB::table('platform_invoices')->where('series', $series)->where('number', (int) $number)->value('id');

            if ($existing) {
                DB::table('platform_invoices')->where('id', $existing)->update($values);

                continue;
            }

            $id = (string) Str::uuid7();
            DB::table('platform_invoices')->insert(['id' => $id, 'series' => $series, 'number' => (int) $number, ...$values]);

            foreach ($row['lines'] as $line) {
                DB::table('platform_invoice_lines')->insert([
                    'invoice_id' => $id,
                    'description' => mb_substr((string) preg_replace_callback('/\d{2} \w{3} \d{4} al \d{2} \w{3} \d{4}/u', fn (): string => $this->periodLabel($row), $line['desc']), 0, 250),
                    'quantity' => $line['qty'],
                    'unit_price' => $line['unit'],
                    'amount' => $line['amount'],
                    'line_type' => str_starts_with($line['desc'], 'Add-on') ? 'addon' : 'plan',
                ]);
            }
        }
    }

    private function periodLabel(array $row): string
    {
        $from = Carbon::parse($this->day($row['periodFrom']))->locale('es');
        $to = Carbon::parse($this->day($row['periodTo']))->locale('es');

        return $from->translatedFormat('d M Y').' al '.$to->translatedFormat('d M Y');
    }

    private function usage(array $seed): void
    {
        $rows = collect($seed['usageHistory'])->push([
            'month' => $seed['usage']['month'],
            'reservations' => $seed['usage']['reservationsBase'],
            'whatsapp' => $seed['usage']['whatsappBase'],
            'email' => $seed['usage']['emailBase'],
            'apiCalls' => $seed['usage']['apiCalls'],
            'storageGB' => $seed['usage']['storageGB'],
        ]);
        $months = $rows->count();

        foreach ($rows->values() as $index => $row) {
            $month = Carbon::today()->startOfMonth()->subMonths($months - 1 - $index)->toDateString();

            foreach (self::USAGE as $key => $metric) {
                DB::table('usage_monthly')->updateOrInsert(
                    ['tenant_id' => $this->tenant->getKey(), 'metric' => $metric, 'month' => $month],
                    ['value' => (int) round($row[$key])],
                );
            }
        }

        DB::table('tenants')->where('id', $this->tenant->getKey())->update(['storage_used_bytes' => (int) round($seed['usage']['storageGB'] * 1024 ** 3)]);
    }
}
