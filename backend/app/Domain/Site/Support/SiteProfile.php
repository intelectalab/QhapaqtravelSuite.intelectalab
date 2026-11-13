<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\Branding;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SiteProfile
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly Branding $branding,
        private readonly SiteDesignStudio $designs,
        private readonly RuleResolver $rules,
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
        $presentation = $this->presentation($this->designs->publicDesign($this->today()));
        $fx = DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date']);

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
                'emergency_phone' => $general['emergency_phone'] ?? $general['phone'] ?? DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->value('phone'),
                'payment_methods' => array_keys(CheckoutTerms::METHODS),
            ],
            'branding' => $presentation['branding'],
            'design' => $presentation['design'],
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')
                ->get(['id', 'name', 'city', 'address', 'phone', 'is_main'])
                ->map(fn (stdClass $sede): array => ['id' => $sede->id, 'name' => $sede->name, 'city' => $sede->city, 'address' => $sede->address, 'phone' => $sede->phone, 'is_main' => (bool) $sede->is_main])
                ->all(),
            'fx' => $fx ? ['rate' => round((float) $fx->rate_pen, 3), 'date' => $fx->rate_date] : null,
            'banner' => $presentation['banner'],
            'policies' => [
                'cancel' => $policies['cancel_text'] ?? null,
                'modify' => $policies['modify_text'] ?? null,
                'refund' => $policies['refund_text'] ?? null,
                'hold_minutes' => (int) ($policies['hold_minutes'] ?? 30),
            ],
            'claims_days' => (int) (DB::table('crm_claim_book_settings')->value('response_days') ?? 15),
        ];
    }

    public function presentation(array $design): array
    {
        $colors = $design['theme']['colors'] === 'propios' ? $design['theme'] : $this->branding->current();

        return [
            'design' => $design,
            'branding' => ['brand' => $colors['brand'], 'accent' => $colors['accent'], 'menu' => $colors['menu']],
            'banner' => match ($design['announcement']['mode']) {
                'propio' => ['title' => $design['announcement']['text'], 'body' => null, 'link_label' => $design['announcement']['link_label'] ?: null, 'link_href' => $design['announcement']['link_href'] ?: null],
                'oculto' => null,
                default => $this->cmsBanner(),
            },
        ];
    }

    public function subdomain(): string
    {
        return (string) $this->context->tenant()->subdomain;
    }

    public function holdEnabled(): bool
    {
        return $this->rules->on('R-HOLD');
    }

    public function holdMinutes(): int
    {
        $minutes = (int) ($this->rules->param('R-HOLD', 'minutes') ?? 0);

        return $minutes > 0 ? $minutes : (int) ($this->section('policies')['hold_minutes'] ?? 30);
    }

    public function usdRate(): float
    {
        return (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen') ?? 3.75);
    }

    private function cmsBanner(): ?array
    {
        $banner = DB::table('cms_contents')->whereNull('deleted_at')->where('type', 'Banner')->where('status', 'publicado')->where('channel', 'like', '%Web%')
            ->where(fn ($q) => $q->whereNull('valid_from')->orWhere('valid_from', '<=', $this->today()->toDateString()))
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>=', $this->today()->toDateString()))
            ->orderByDesc('published_at')->first(['title', 'body']);

        return $banner ? ['title' => preg_replace('/^Banner:\s*/u', '', $banner->title), 'body' => $banner->body, 'link_label' => null, 'link_href' => null] : null;
    }

    private function section(string $name): array
    {
        $values = DB::table('sys_settings')->where('section', $name)->value('values');

        return is_string($values) ? (json_decode($values, true) ?: []) : [];
    }
}
