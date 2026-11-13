<?php

declare(strict_types=1);

namespace App\Domain\Landing\Support;

use App\Domain\Platform\Support\PlatformSequence;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class SignupDirectory
{
    private const STEPS = [
        ['code' => 'perfil', 'label' => 'Completa el perfil y el logo de tu agencia'],
        ['code' => 'usuarios', 'label' => 'Invita a tu equipo'],
        ['code' => 'catalogo', 'label' => 'Carga tu primer tour o paquete'],
        ['code' => 'sitio', 'label' => 'Publica tu sitio y conecta tus píxeles'],
        ['code' => 'reserva', 'label' => 'Registra tu primera reserva'],
    ];

    public function __construct(private readonly SignupState $state) {}

    public function show(string $token): array
    {
        [$tenant, $signup] = $this->state->find($token);
        $state = SignupState::effective($signup);
        $invoice = isset($signup['invoice']['id']) ? $this->db()->table('platform_invoices')->where('id', $signup['invoice']['id'])->first(['series', 'number', 'status', 'total', 'paid_at']) : null;
        $payment = (array) ($signup['payment'] ?? []);
        $expired = isset($payment['expires_at']) && Carbon::parse($payment['expires_at'])->isPast();
        $progress = $this->progress((string) $tenant->id);

        return [
            'state' => $state,
            'state_label' => SignupState::LABELS[$state] ?? $state,
            'agency' => $tenant->commercial_name,
            'tenant' => $tenant->code,
            'plan' => $signup['plan'] ?? null,
            'cycle' => $signup['cycle'] ?? null,
            'doc_type' => $signup['doc_type'] ?? null,
            'totals' => $signup['totals'] ?? null,
            'trial_ends_at' => $tenant->trial_ends_at ? Carbon::parse($tenant->trial_ends_at)->toDateString() : null,
            'invoice' => $invoice === null ? null : ['number' => PlatformSequence::format(trim((string) $invoice->series), (int) $invoice->number), 'status' => $invoice->status, 'total' => (string) $invoice->total, 'paid_at' => $invoice->paid_at ? Carbon::parse($invoice->paid_at)->toIso8601String() : null],
            'payment' => $payment === [] ? null : [...$payment, 'expired' => $expired],
            'can_retry' => in_array($state, ['fallida', 'abandonada'], true) || ($state === 'pago_pendiente' && ($payment === [] || $expired)),
            'poll_seconds' => $state === 'pago_pendiente' && ! $expired && $payment !== [] ? 3 : null,
            'last_error' => $signup['last_error'] ?? null,
            'login_url' => '/login',
            'steps' => collect(self::STEPS)->map(fn (array $step) => [...$step, 'done' => $progress[$step['code']] ?? false])->values(),
        ];
    }

    public function platform(): array
    {
        $tenants = $this->db()->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')
            ->whereRaw("t.settings->'signup' is not null")
            ->orderByDesc('t.created_at')
            ->get(['t.id', 't.code', 't.commercial_name', 't.ruc', 't.admin_email', 't.status', 't.trial_ends_at', 't.created_at', 't.settings', 'p.name as plan_name', 'p.price_month']);
        $invoices = $this->db()->table('platform_invoices')->whereIn('tenant_id', $tenants->pluck('id'))->whereIn('status', ['open', 'paid', 'failed'])->orderByDesc('created_at')->get(['tenant_id', 'series', 'number', 'status', 'total'])->groupBy('tenant_id');

        $rows = $tenants->map(function (object $tenant) use ($invoices): array {
            $signup = (array) (json_decode((string) $tenant->settings, true)['signup'] ?? []);
            $state = SignupState::effective($signup);
            $invoice = ($invoices[$tenant->id] ?? collect())->first();
            $utm = (array) ($signup['attribution']['utm'] ?? []);

            return [
                'tenant' => $tenant->code,
                'agency' => $tenant->commercial_name,
                'ruc' => trim((string) $tenant->ruc),
                'email' => $tenant->admin_email,
                'plan' => $tenant->plan_name,
                'cycle' => $signup['cycle'] ?? null,
                'state' => $state,
                'state_label' => SignupState::LABELS[$state] ?? $state,
                'total' => $signup['totals']['total'] ?? '0.00',
                'coupon' => $signup['coupon'] ?? null,
                'source' => $utm['source'] ?? (isset($signup['attribution']['gclid']) ? 'google' : (isset($signup['attribution']['fbclid']) ? 'facebook' : '(directo)')),
                'campaign' => $utm['campaign'] ?? null,
                'doc_type' => $signup['doc_type'] ?? null,
                'invoice' => $invoice ? PlatformSequence::format(trim((string) $invoice->series), (int) $invoice->number) : null,
                'invoice_status' => $invoice->status ?? null,
                'mrr' => $state === 'pagada' ? (string) $tenant->price_month : '0.00',
                'trial_ends_at' => $tenant->trial_ends_at ? Carbon::parse($tenant->trial_ends_at)->toDateString() : null,
                'created_at' => Carbon::parse($tenant->created_at)->toIso8601String(),
                'history' => $signup['history'] ?? [],
            ];
        });

        return ['rows' => $rows->values(), 'kpis' => $this->kpis($rows), 'funnel' => $this->funnel($rows)];
    }

    private function kpis(Collection $rows): array
    {
        $paid = $rows->where('state', 'pagada');
        $recent = $rows->filter(fn (array $row) => Carbon::parse($row['created_at'])->gte(now()->subDays(30)));

        return [
            'total' => $rows->count(),
            'last_30_days' => $recent->count(),
            'paid' => $paid->count(),
            'trials' => $rows->where('state', 'prueba')->count(),
            'pending' => $rows->whereIn('state', ['pago_pendiente', 'fallida'])->count(),
            'abandoned' => $rows->where('state', 'abandonada')->count(),
            'new_mrr' => number_format($paid->sum(fn (array $row) => (float) $row['mrr']), 2, '.', ''),
            'conversion_rate' => $rows->count() > 0 ? round(100 * $paid->count() / $rows->count(), 1) : 0.0,
        ];
    }

    private function funnel(Collection $rows): array
    {
        $total = $rows->count();

        return [
            ['step' => 'cuenta_creada', 'label' => 'Cuenta creada', 'count' => $total],
            ['step' => 'checkout', 'label' => 'Llegó al pago o a la prueba', 'count' => $rows->filter(fn (array $row) => $row['state'] !== 'abandonada')->count()],
            ['step' => 'activa', 'label' => 'Activa (pagada o en prueba)', 'count' => $rows->whereIn('state', ['pagada', 'prueba'])->count()],
            ['step' => 'pagada', 'label' => 'Pagada', 'count' => $rows->where('state', 'pagada')->count()],
        ];
    }

    private function progress(string $tenantId): array
    {
        $db = $this->db();

        return [
            'perfil' => $db->table('tenants')->where('id', $tenantId)->whereNotNull('logo_path')->exists(),
            'usuarios' => $db->table('iam_users')->where('tenant_id', $tenantId)->whereNull('deleted_at')->count() > 1,
            'catalogo' => $db->table('catalog_products')->where('tenant_id', $tenantId)->exists(),
            'sitio' => $db->table('mkt_tracking_tags')->where('tenant_id', $tenantId)->exists(),
            'reserva' => $db->table('booking_reservations')->where('tenant_id', $tenantId)->exists(),
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
