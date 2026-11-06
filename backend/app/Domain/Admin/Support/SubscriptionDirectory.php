<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SubscriptionDirectory
{
    public const ADDONS = ['whatsapp_pack' => 'Paquete WhatsApp +1 000 mensajes al mes', 'custom_domain' => 'Dominio propio con certificado SSL'];

    private const METRICS = [
        'users' => ['label' => 'Usuarios', 'unit' => 'usuarios'],
        'sedes' => ['label' => 'Sedes activas', 'unit' => 'sedes'],
        'reservations_month' => ['label' => 'Reservas del mes', 'unit' => 'reservas'],
        'storage_gb' => ['label' => 'Almacenamiento', 'unit' => 'GB'],
        'whatsapp_month' => ['label' => 'Mensajes de WhatsApp', 'unit' => 'mensajes'],
        'email_month' => ['label' => 'Correos enviados', 'unit' => 'correos'],
        'api_calls_month' => ['label' => 'Llamadas a la API', 'unit' => 'llamadas'],
        'api_keys' => ['label' => 'Claves de API activas', 'unit' => 'claves'],
        'webhooks' => ['label' => 'Webhooks', 'unit' => 'webhooks'],
    ];

    private const STATUS = ['trialing' => 'En prueba', 'active' => 'Activa', 'past_due' => 'Pago pendiente', 'cancel_scheduled' => 'Cancelación programada', 'suspended' => 'Suspendida', 'canceled' => 'Cancelada'];

    public function __construct(private readonly TenantContext $context, private readonly AuditDirectory $audit) {}

    public function overview(User $viewer): array
    {
        $tenant = $this->context->tenant();
        $platform = $this->platform();
        $plan = $platform->table('plans')->where('id', $tenant->plan_id)->first(['code', 'name', 'rank', 'price_month', 'price_year', 'currency', 'support_level', 'module_count']);
        $limits = $platform->table('plan_limits')->where('plan_id', $tenant->plan_id)->get(['metric', 'value', 'hard'])->keyBy('metric');
        $subscription = $platform->table('subscriptions')->where('tenant_id', $tenant->getKey())->where('status', '<>', 'canceled')->first();
        $items = $platform->table('subscription_items')->where('subscription_id', $subscription->id ?? null)->whereNull('ends_at')->get(['addon_code', 'quantity', 'unit_price', 'starts_at', 'meta']);
        $month = Carbon::today()->startOfMonth();
        $metered = $platform->table('usage_monthly')->where('tenant_id', $tenant->getKey())->where('month', '>=', $month->copy()->subMonths(5)->toDateString())->get(['metric', 'month', 'value']);
        $current = $metered->filter(fn (object $row): bool => Carbon::parse($row->month)->isSameMonth($month))->pluck('value', 'metric');
        $whatsappExtra = (int) $items->where('addon_code', 'whatsapp_pack')->sum('quantity') * 1000;
        $used = [
            'users' => DB::table('iam_users')->whereNull('deleted_at')->whereIn('status', ['activo', 'pendiente'])->count(),
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->count(),
            'reservations_month' => DB::table('booking_reservations')->whereNull('deleted_at')->where('created_at', '>=', $month)->count(),
            'storage_gb' => round(((int) $tenant->storage_used_bytes) / 1024 ** 3, 1),
            'whatsapp_month' => (int) ($current['whatsapp_month'] ?? 0),
            'email_month' => (int) ($current['email_month'] ?? 0),
            'api_calls_month' => (int) ($current['api_calls_month'] ?? 0),
            'api_keys' => DB::table('integration_api_keys')->where('status', 'active')->count(),
            'webhooks' => DB::table('integration_webhooks')->whereIn('status', ['active', 'paused'])->count(),
        ];
        $invoices = $platform->table('platform_invoices')->where('tenant_id', $tenant->getKey())->orderByDesc('issue_date')->limit(24)->get(['id', 'series', 'number', 'kind', 'period_from', 'period_to', 'issue_date', 'due_date', 'currency', 'subtotal', 'igv', 'total', 'status', 'paid_at', 'payment_ref', 'sunat_status']);
        $lines = $platform->table('platform_invoice_lines')->whereIn('invoice_id', $invoices->pluck('id'))->get(['invoice_id', 'description', 'quantity', 'unit_price', 'amount'])->groupBy('invoice_id');

        return [
            'plan' => $plan ? [
                'code' => $plan->code,
                'name' => $plan->name,
                'price_month' => (float) $plan->price_month,
                'price_year' => (float) $plan->price_year,
                'currency' => $plan->currency,
                'support' => $plan->support_level,
                'modules' => (int) $plan->module_count,
            ] : null,
            'subscription' => $subscription ? [
                'code' => $subscription->code,
                'status' => $subscription->status,
                'status_label' => self::STATUS[$subscription->status] ?? $subscription->status,
                'cycle' => $subscription->cycle,
                'period_start' => $subscription->current_period_start,
                'period_end' => $subscription->current_period_end,
                'auto_renew' => (bool) $subscription->auto_renew,
                'cancel_at' => $subscription->cancel_at,
                'credit_balance' => (float) $subscription->credit_balance,
                'customer_since' => $subscription->created_at,
                'billing' => [
                    'ruc' => $subscription->billing_ruc,
                    'name' => $subscription->billing_name,
                    'address' => $subscription->billing_address,
                    'ubigeo' => $subscription->billing_ubigeo,
                    'email' => $subscription->billing_email,
                ],
            ] : null,
            'addons' => $items->map(fn (object $item): array => [
                'code' => $item->addon_code,
                'label' => self::ADDONS[$item->addon_code] ?? $item->addon_code,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'since' => $item->starts_at,
                'detail' => self::domain($item->meta),
            ])->values(),
            'usage' => collect(self::METRICS)->map(function (array $meta, string $metric) use ($limits, $used, $whatsappExtra): array {
                $limit = isset($limits[$metric]) && $limits[$metric]->value !== null ? (int) $limits[$metric]->value : null;

                if ($metric === 'whatsapp_month' && $limit !== null) {
                    $limit += $whatsappExtra;
                }

                return [
                    'metric' => $metric,
                    'label' => $meta['label'],
                    'unit' => $meta['unit'],
                    'used' => $used[$metric],
                    'limit' => $limit,
                    'hard' => (bool) ($limits[$metric]->hard ?? true),
                ];
            })->values(),
            'history' => $metered->groupBy('metric')->map(fn ($rows) => $rows->sortBy('month')->map(fn (object $row): array => ['month' => $row->month, 'value' => (int) $row->value])->values())->all(),
            'invoices' => $invoices->map(fn (object $row): array => [
                'number' => $row->series.'-'.str_pad((string) $row->number, 8, '0', STR_PAD_LEFT),
                'kind' => $row->kind,
                'period_from' => $row->period_from,
                'period_to' => $row->period_to,
                'issue_date' => $row->issue_date,
                'due_date' => $row->due_date,
                'currency' => $row->currency,
                'subtotal' => (float) $row->subtotal,
                'igv' => (float) $row->igv,
                'total' => (float) $row->total,
                'status' => $row->status,
                'paid_at' => $row->paid_at,
                'method' => $row->payment_ref,
                'sunat' => $row->sunat_status,
                'lines' => collect($lines[$row->id] ?? [])->map(fn ($line): array => ['description' => $line->description, 'quantity' => (float) $line->quantity, 'amount' => (float) $line->amount])->values(),
            ])->values(),
            'changes' => $this->audit->recent(['Suscripción'], 6),
            'can_manage' => $viewer->can('admin.billing.manage'),
        ];
    }

    public function updateBilling(array $data): array
    {
        $platform = $this->platform();
        $tenantId = $this->context->idOrFail();
        $subscription = $platform->table('subscriptions')->where('tenant_id', $tenantId)->where('status', '<>', 'canceled')->first(['id', 'billing_ruc', 'billing_name', 'billing_address', 'billing_ubigeo', 'billing_email']);

        if ($subscription === null) {
            return [];
        }

        $after = ['billing_ruc' => $data['ruc'], 'billing_name' => $data['name'], 'billing_address' => $data['address'], 'billing_ubigeo' => $data['ubigeo'] ?? null, 'billing_email' => $data['email']];
        $changed = TenantSettings::changes((array) $subscription, $after);

        if ($changed !== []) {
            $platform->table('subscriptions')->where('id', $subscription->id)->update([...$after, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
        }

        return $changed;
    }

    private static function domain(?string $meta): ?string
    {
        $values = $meta ? json_decode($meta, true) : null;

        return is_array($values) && isset($values['domain']) ? (string) $values['domain'] : null;
    }

    private function platform(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
