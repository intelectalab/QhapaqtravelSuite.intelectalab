<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SettingsDirectory
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantSettings $settings,
        private readonly AuditDirectory $audit,
    ) {}

    public function overview(User $viewer): array
    {
        $tenant = $this->context->tenant();
        $rank = $this->planRank();
        $sections = $this->settings->sections(SettingsCatalog::SECTIONS);
        $channels = $sections['channels']['values'];
        $general = $sections['general']['values'];
        $fx = DB::table('fin_fx_rates')->where('currency_code', $sections['currency']['values']['alt_currency'] ?? 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_pen', 'rate_date', 'source']);
        $sedes = DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')->get(['id', 'name']);
        $changes = DB::table('audit_events')->where('entity', 'Configuración')->where('occurred_at', '>=', Carbon::today()->subDays(29))->count();

        return [
            'agency' => [
                'legal_name' => $tenant->legal_name,
                'commercial_name' => $tenant->commercial_name,
                'logo_initials' => $tenant->logo_initials,
                'ruc' => $tenant->ruc,
                'country' => $tenant->country,
                'timezone' => $tenant->timezone,
                'fiscal_address' => $tenant->fiscal_address,
                'legal_rep' => $tenant->legal_rep,
                'business_type' => $tenant->business_type,
                'subdomain' => $tenant->subdomain,
                'plan' => SettingsCatalog::PLAN_NAMES[$rank] ?? 'Starter',
            ],
            'sections' => $sections,
            'main_sede' => $sedes->firstWhere('id', $general['main_sede_id'] ?? null)?->name,
            'fx' => $fx ? ['rate' => (float) $fx->rate_pen, 'date' => $fx->rate_date, 'source' => $fx->source] : null,
            'base_locked' => DB::table('booking_reservations')->exists() || DB::table('fin_payments')->exists(),
            'channels' => collect(SettingsCatalog::CHANNELS)->map(fn (array $channel, string $key): array => [
                'key' => $key,
                'label' => $channel['label'],
                'description' => $channel['description'],
                'enabled' => (bool) ($channels[$key] ?? false),
                'allowed' => $rank >= $channel['plan'],
                'min_plan' => SettingsCatalog::PLAN_NAMES[$channel['plan']],
            ])->values(),
            'sequences' => DB::table('sys_sequences')->orderBy('label')->get(['doc_type', 'label', 'series', 'prefix', 'pad_width', 'next_number', 'year_reset', 'updated_at'])->map(fn (object $row): array => [
                'doc_type' => $row->doc_type,
                'label' => $row->label,
                'prefix' => $row->prefix,
                'pad' => (int) $row->pad_width,
                'next' => (int) $row->next_number,
                'year_reset' => (bool) $row->year_reset,
                'preview' => $row->prefix.str_pad((string) $row->next_number, (int) $row->pad_width, '0', STR_PAD_LEFT),
                'updated_at' => $row->updated_at,
            ])->values(),
            'options' => [
                'sedes' => $sedes->map(fn (object $sede): array => ['value' => $sede->id, 'label' => $sede->name])->values(),
                'timezones' => SettingsCatalog::TIMEZONES,
                'langs' => $this->options(SettingsCatalog::LANGS),
                'date_formats' => $this->options(SettingsCatalog::DATE_FORMATS),
                'fx_sources' => SettingsCatalog::FX_SOURCES,
                'rounding' => $this->options(SettingsCatalog::ROUNDING),
                'round_modes' => $this->options(SettingsCatalog::ROUND_MODES),
                'alt_currencies' => $this->options(SettingsCatalog::ALT_CURRENCIES),
            ],
            'kpis' => [
                'changes_30d' => $changes,
                'channels_on' => collect($channels)->filter()->count(),
                'channels_allowed' => collect(SettingsCatalog::CHANNELS)->filter(fn (array $channel): bool => $rank >= $channel['plan'])->count(),
                'sequences' => DB::table('sys_sequences')->count(),
                'updated_at' => collect($sections)->pluck('updated_at')->filter()->max(),
            ],
            'history' => $this->audit->recent(['Configuración'], 10),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }

    public function planRank(): int
    {
        return (int) DB::table('plans')->where('id', $this->context->tenant()->plan_id)->value('rank');
    }

    private function options(array $map): array
    {
        return collect($map)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all();
    }
}
