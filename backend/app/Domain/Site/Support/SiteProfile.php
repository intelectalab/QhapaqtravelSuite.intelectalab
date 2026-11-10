<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\Branding;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteProfile
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly Branding $branding,
    ) {}

    public function today(): Carbon
    {
        return Carbon::today($this->context->timezone());
    }

    public function show(): array
    {
        $tenant = $this->context->tenant();
        $general = $this->section('general');
        $policies = $this->section('policies');
        $branding = $this->branding->current();
        $fx = DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);
        $banner = DB::table('cms_contents')->whereNull('deleted_at')->where('type', 'Banner')->where('status', 'publicado')->where('channel', 'like', '%Web%')
            ->where(fn ($q) => $q->whereNull('valid_from')->orWhere('valid_from', '<=', $this->today()->toDateString()))
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>=', $this->today()->toDateString()))
            ->orderByDesc('published_at')->first(['title', 'body']);

        return [
            'locales' => SiteLocale::LOCALES,
            'agency' => [
                'subdomain' => $tenant->subdomain,
                'name' => $tenant->commercial_name,
                'legal_name' => $tenant->legal_name,
                'ruc' => $tenant->ruc,
                'initials' => $tenant->logo_initials,
                'logo' => $tenant->logo_path,
                'address' => $general['address'] ?? $tenant->fiscal_address,
                'phone' => $general['phone'] ?? null,
                'email' => $general['email'] ?? $tenant->admin_email,
                'web' => $general['web'] ?? null,
                'registry' => $general['mincetur_registry'] ?? null,
            ],
            'branding' => ['brand' => $branding['brand'], 'accent' => $branding['accent'], 'menu' => $branding['menu']],
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')
                ->get(['id', 'name', 'city', 'address', 'phone', 'is_main'])
                ->map(fn (stdClass $sede): array => ['id' => $sede->id, 'name' => $sede->name, 'city' => $sede->city, 'address' => $sede->address, 'phone' => $sede->phone, 'is_main' => (bool) $sede->is_main])
                ->all(),
            'fx' => $fx ? ['rate' => round((float) $fx->rate_pen, 3), 'date' => $fx->rate_date] : null,
            'banner' => $banner ? ['title' => preg_replace('/^Banner:\s*/u', '', $banner->title), 'body' => $banner->body] : null,
            'policies' => [
                'cancel' => $policies['cancel_text'] ?? null,
                'modify' => $policies['modify_text'] ?? null,
                'refund' => $policies['refund_text'] ?? null,
                'hold_minutes' => (int) ($policies['hold_minutes'] ?? 30),
            ],
            'claims_days' => (int) (DB::table('crm_claim_book_settings')->value('response_days') ?? 15),
        ];
    }

    public function holdMinutes(): int
    {
        return (int) ($this->section('policies')['hold_minutes'] ?? 30);
    }

    public function usdRate(): float
    {
        return (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 3.75);
    }

    private function section(string $name): array
    {
        $values = DB::table('sys_settings')->where('section', $name)->value('values');

        return is_string($values) ? (json_decode($values, true) ?: []) : [];
    }
}
