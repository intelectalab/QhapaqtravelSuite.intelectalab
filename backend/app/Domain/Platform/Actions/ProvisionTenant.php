<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Finance\Actions\InvoiceFollowUp;
use App\Domain\Iam\Models\Sede;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\TenantBootstrap;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Jobs\DefaultScheduledJobs;
use App\Domain\Shared\Sequences\DefaultSequences;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Database\Seeders\CrmCatalogSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class ProvisionTenant
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly PlatformSession $session,
        private readonly TenantBootstrap $bootstrap,
        private readonly TenantContext $context,
        private readonly Invitations $invitations,
        private readonly DefaultSequences $sequences,
        private readonly DefaultScheduledJobs $jobs,
        private readonly PlatformInvoicer $invoicer,
    ) {}

    public function validate(array $data): void
    {
        $subdomain = Str::lower(trim((string) ($data['subdomain'] ?? '')));

        if ($subdomain !== '' && DB::connection(self::CONNECTION)->table('tenants')->where('subdomain', $subdomain)->exists()) {
            throw ApiException::unprocessable('TEN-BR-01', 'El subdominio ya está en uso por otra agencia.', ['field' => 'subdomain']);
        }

        if (! empty($data['ruc']) && DB::connection(self::CONNECTION)->table('tenants')->where('ruc', $data['ruc'])->exists()) {
            throw ApiException::unprocessable('TEN-BR-02', 'Ya existe una agencia con ese RUC.', ['field' => 'ruc']);
        }

        if (! empty($data['admin_email']) && DB::connection(self::CONNECTION)->table('iam_users')->whereRaw('lower(email) = ?', [Str::lower($data['admin_email'])])->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('TEN-BR-03', 'Ese correo ya pertenece a un usuario de otra agencia.', ['field' => 'admin_email']);
        }

        if (! empty($data['roles'])) {
            $unknown = array_diff($data['roles'], array_column(TenantBootstrap::tenantRoles(), 'id'));

            if ($unknown !== []) {
                throw ApiException::unprocessable('TEN-BR-05', 'Hay roles que no existen: '.implode(', ', $unknown).'.', ['field' => 'roles']);
            }
        }

        if (! empty($data['channels']) && ! empty($data['plan'])) {
            $rank = (int) DB::connection(self::CONNECTION)->table('plans')->where('code', $data['plan'])->value('rank');

            foreach ($data['channels'] as $channel) {
                $needs = SettingsCatalog::CHANNELS[$channel]['plan'] ?? 1;

                if ($needs > $rank) {
                    throw ApiException::unprocessable('TEN-BR-04', 'El canal '.SettingsCatalog::CHANNELS[$channel]['label'].' requiere el plan '.SettingsCatalog::PLAN_NAMES[$needs].'.', ['field' => 'channels']);
                }
            }
        }
    }

    public function __invoke(array $data, ?PlatformUser $actor): Tenant
    {
        $this->validate($data);
        $plan = Plan::on(self::CONNECTION)->where('code', $data['plan'])->first() ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.');
        $previous = DB::getDefaultConnection();
        $token = '';

        DB::setDefaultConnection(self::CONNECTION);

        try {
            [$tenant, $admin] = DB::transaction(function () use ($data, $plan, $actor, &$token): array {
                $trial = ($data['status'] ?? 'prueba') === 'prueba';
                $tenant = Tenant::query()->create([
                    'code' => $this->nextCode(),
                    'legal_name' => trim($data['legal_name']),
                    'commercial_name' => trim($data['commercial_name']),
                    'ruc' => $data['ruc'],
                    'fiscal_address' => trim($data['fiscal_address']),
                    'business_type' => $data['business_type'],
                    'subdomain' => Str::lower(trim($data['subdomain'])),
                    'logo_initials' => $this->initials($data['commercial_name']),
                    'plan_id' => $plan->getKey(),
                    'status' => $trial ? 'prueba' : 'activo',
                    'trial_ends_at' => $trial ? now()->addDays($plan->trial_days ?: 14) : null,
                    'mrr' => $trial ? 0 : $plan->price_month,
                    'admin_email' => Str::lower(trim($data['admin_email'])),
                    'legal_rep' => isset($data['legal_rep']) ? trim((string) $data['legal_rep']) : null,
                    'country' => $data['country'] ?? 'Perú',
                    'base_currency' => $data['base_currency'] ?? 'PEN',
                    'alt_currency' => $data['alt_currency'] ?? 'USD',
                    'timezone' => $data['timezone'] ?? 'America/Lima',
                    'locale' => $data['locale'] ?? 'es-PE',
                ]);

                DB::select('select app_set_tenant(?::uuid)', [$tenant->getKey()]);
                $this->context->set($tenant);
                app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

                $sede = Sede::query()->create([
                    'code' => 'SED-01',
                    'name' => trim($data['sede_name']),
                    'city' => trim($data['sede_city']),
                    'address' => trim($data['sede_address']),
                    'phone' => isset($data['sede_phone']) ? trim((string) $data['sede_phone']) : null,
                    'status' => 'activa',
                    'is_main' => true,
                ]);
                (new CrmCatalogSeeder)->run($tenant);
                $this->sequences->sync((string) $tenant->getKey(), CarbonImmutable::now($tenant->timezone ?: 'America/Lima')->year);
                $this->jobs->sync((string) $tenant->getKey());
                $template = $data['permission_template'] ?? 'standard';
                $roles = $this->bootstrap->roles($tenant, null, $data['roles'] ?? null, $template);
                $this->configure($tenant, $sede, $data, $plan);

                $admin = User::query()->create([
                    'code' => 'U01',
                    'name' => trim($data['admin_name']),
                    'email' => Str::lower(trim($data['admin_email'])),
                    'phone' => isset($data['admin_phone']) ? trim((string) $data['admin_phone']) : null,
                    'password' => null,
                    'sede_id' => $sede->getKey(),
                    'status' => 'pendiente',
                    'mfa_enabled' => false,
                    'mfa_required' => (bool) ($data['admin_mfa'] ?? true),
                ]);
                $admin->syncRoles([$roles['tenant_admin']]);

                $token = $this->invitations->create($admin, $tenant->getKey(), $admin->getKey());
                $this->subscribe($tenant, $plan, $trial, $actor);

                $this->session->log('Tenant', $tenant->code, 'alta', null, "{$tenant->commercial_name} · {$plan->name} · {$tenant->status} · ".count($roles).' roles · plantilla '.TenantProvisionRequest::TEMPLATES[$template], $actor);

                return [$tenant, $admin];
            });
        } finally {
            DB::setDefaultConnection($previous);
            $this->context->clear();
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        if ($data['send_invitation'] ?? true) {
            $this->invitations->send($admin->email, $admin->name, $tenant->commercial_name, $token, true);
        }

        return $tenant;
    }

    private function subscribe(Tenant $tenant, Plan $plan, bool $trial, ?PlatformUser $actor): void
    {
        $today = Carbon::today('America/Lima');
        $end = $trial ? Carbon::parse($tenant->trial_ends_at)->timezone('America/Lima')->startOfDay() : $today->copy()->addMonthNoOverflow()->subDay();
        $id = (string) Str::uuid7();
        DB::table('subscriptions')->insert([
            'id' => $id,
            'code' => 'SUB-'.$today->year.'-'.substr($tenant->code, -4),
            'tenant_id' => $tenant->getKey(),
            'plan_id' => $plan->getKey(),
            'cycle' => 'monthly',
            'status' => $trial ? 'trialing' : 'active',
            'trial_starts_at' => $trial ? $today->toDateString() : null,
            'trial_ends_at' => $trial ? $end->toDateString() : null,
            'current_period_start' => $today->toDateString(),
            'current_period_end' => $end->toDateString(),
            'billing_anchor_day' => min(28, $today->day),
            'gateway' => 'local_gateway',
            'billing_ruc' => $tenant->ruc,
            'billing_name' => $tenant->legal_name,
            'billing_address' => $tenant->fiscal_address,
            'billing_email' => $tenant->admin_email,
            'created_by' => $actor?->getKey(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (! $trial) {
            $this->invoicer->issue(DB::table('subscriptions')->where('id', $id)->first(), DB::table('plans')->where('id', $plan->getKey())->first(), 'monthly', $today, $end);
        }
    }

    private function configure(Tenant $tenant, Sede $sede, array $data, Plan $plan): void
    {
        $maxDiscount = (float) ($data['max_discount_pct'] ?? 5);
        $channels = array_fill_keys(array_keys(SettingsCatalog::CHANNELS), false);

        foreach ($data['channels'] ?? ['portal_cliente'] as $channel) {
            if ((SettingsCatalog::CHANNELS[$channel]['plan'] ?? 99) <= (int) $plan->rank) {
                $channels[$channel] = true;
            }
        }

        $sections = [
            'general' => ['lang' => $tenant->locale, 'legal_rep' => $tenant->legal_rep, 'email' => $tenant->admin_email, 'phone' => $sede->phone, 'address' => $tenant->fiscal_address, 'date_format' => 'DD/MM/AAAA', 'main_sede_id' => $sede->getKey()],
            'currency' => ['base_currency' => $tenant->base_currency, 'alt_currency' => $tenant->alt_currency, 'tax_pct' => (float) ($data['tax_pct'] ?? 18), 'rounding' => (string) ($data['rounding'] ?? '0.10'), 'round_mode' => 'nearest', 'price_with_tax' => true, 'fx_source' => $data['fx_source'] ?? SettingsCatalog::FX_SOURCES[0], 'invoice_void_days' => InvoiceFollowUp::DEFAULT_VOID_DAYS],
            'policies' => [
                'quote_validity_days' => (int) ($data['quote_validity_days'] ?? 10),
                'hold_minutes' => (int) ($data['hold_minutes'] ?? 30),
                'markup_pct' => (float) ($data['markup_pct'] ?? 25),
                'max_discount_pct' => $maxDiscount,
                'discount_cap_pct' => max(10.0, $maxDiscount),
                'approval_margin_pct' => 15,
                'advance_pct' => (float) ($data['advance_pct'] ?? 40),
                'balance_days_before' => 15,
                'cancel_text' => 'Sin penalidad hasta 15 días antes. 50 % entre 14 y 7 días. 100 % dentro de 7 días o no-show.',
                'modify_text' => 'Cambios de fecha sin costo hasta 10 días antes, sujetos a disponibilidad y diferencia tarifaria.',
                'noshow_text' => 'No-show se factura al 100 %.',
                'refund_text' => 'Reembolsos en 7 a 15 días hábiles por el mismo medio de pago.',
            ],
            'operations' => ['voucher_hours_before' => 72, 'assign_expiry_min' => 120, 'checkin_tolerance_min' => 15, 'modify_min_hours' => 48, 'max_pax_per_guide' => 16, 'offline_sync_min' => 10, 'pay_reminder_days' => 3, 'trip_notice_hours' => 48, 'incident_escalate_min' => 30],
            'channels' => $channels,
        ];

        foreach ($sections as $section => $values) {
            DB::table('sys_settings')->insert(['section' => $section, 'values' => json_encode($values, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        }

        $invoice = (string) ($data['invoice_series'] ?? 'F001');
        $receipt = (string) ($data['receipt_series'] ?? 'B001');

        foreach ([$invoice => '01', $receipt => '03', 'FC'.substr($invoice, -2) => '07', 'BC'.substr($receipt, -2) => '07'] as $series => $type) {
            DB::table('fin_document_series')->insert(['doc_type' => $type, 'series' => $series, 'next_number' => 1, 'active' => true, 'sede_id' => null]);
        }

        if ($tenant->base_currency === 'PEN' && ! empty($data['fx_rate'])) {
            DB::table('fin_fx_rates')->insert([
                'currency_code' => $tenant->alt_currency,
                'base_currency' => 'PEN',
                'rate_pen' => (string) $data['fx_rate'],
                'rate_date' => CarbonImmutable::now($tenant->timezone)->toDateString(),
                'source' => 'Alta de la agencia',
            ]);
        }
    }

    private function nextCode(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ['platform:tenants']);
        $last = DB::table('tenants')->where('code', 'like', 'TNT-%')->orderByDesc('code')->value('code');

        return 'TNT-'.str_pad((string) ($last ? (int) Str::after($last, 'TNT-') + 1 : 1), 4, '0', STR_PAD_LEFT);
    }

    private function initials(string $name): string
    {
        $words = collect(preg_split('/\s+/', trim($name)))->filter(fn (string $word) => mb_strlen($word) > 2)->values();

        return Str::upper(mb_substr($words[0] ?? $name, 0, 1).mb_substr($words[1] ?? mb_substr($name, 1), 0, 1));
    }
}
