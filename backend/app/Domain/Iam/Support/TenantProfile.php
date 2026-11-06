<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Admin\Support\SettingsCatalog;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class TenantProfile
{
    private const STATUSES = ['activo' => 'Activa', 'prueba' => 'En prueba', 'suspendido' => 'Suspendida'];

    public function __construct(private readonly TenantContext $context, private readonly TenantSettings $settings) {}

    public function for(User $user): array
    {
        $tenant = $this->context->tenant();
        $plan = DB::table('plans')->where('id', $tenant->plan_id)->first(['code', 'name']);
        $general = $this->settings->section('general');
        $currency = $this->settings->section('currency');
        $channels = $this->settings->section('channels');
        $sedes = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')->get(['id', 'name', 'city', 'is_main']);
        $main = $sedes->firstWhere('id', $general['main_sede_id'] ?? null) ?? $sedes->firstWhere('is_main', true);

        return [
            'id' => $tenant->getKey(),
            'code' => $tenant->code,
            'commercial_name' => $tenant->commercial_name,
            'legal_name' => $tenant->legal_name,
            'ruc' => $tenant->ruc,
            'country' => $tenant->country,
            'subdomain' => $tenant->subdomain,
            'initials' => $tenant->logo_initials,
            'status' => $tenant->status,
            'status_label' => self::STATUSES[$tenant->status] ?? $tenant->status,
            'trial_ends_at' => $tenant->status === 'prueba' ? $tenant->trial_ends_at : null,
            'plan' => $plan ? ['code' => $plan->code, 'name' => $plan->name] : null,
            'timezone' => $tenant->timezone,
            'locale' => $general['lang'] ?? $tenant->locale,
            'date_format' => $general['date_format'] ?? null,
            'base_currency' => $currency['base_currency'] ?? $tenant->base_currency,
            'alt_currency' => $currency['alt_currency'] ?? $tenant->alt_currency,
            'tax_pct' => isset($currency['tax_pct']) ? (int) $currency['tax_pct'] : null,
            'price_with_tax' => (bool) ($currency['price_with_tax'] ?? false),
            'contact' => ['email' => $general['email'] ?? null, 'phone' => $general['phone'] ?? null, 'web' => $general['web'] ?? null],
            'main_sede' => $main ? ['id' => $main->id, 'name' => $main->name, 'city' => $main->city] : null,
            'my_sede' => $user->sede ? ['id' => $user->sede->getKey(), 'name' => $user->sede->name] : null,
            'sedes' => $sedes->count(),
            'active_users' => DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->count(),
            'channels' => collect(SettingsCatalog::CHANNELS)->filter(fn (array $channel, string $key): bool => (bool) ($channels[$key] ?? false))->map(fn (array $channel, string $key): array => ['key' => $key, 'label' => $channel['label']])->values()->all(),
        ];
    }
}
