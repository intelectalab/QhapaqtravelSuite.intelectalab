<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
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
                'lock_version' => (int) $tenant->lock_version,
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
            'sequence_types' => collect(SettingsCatalog::SEQUENCE_TYPES)->except(DB::table('sys_sequences')->pluck('doc_type')->all())->map(fn (array $type, string $value): array => ['value' => $value, 'label' => $type['label'], 'pad' => $type['pad'], 'year_reset' => $type['year_reset']])->values()->all(),
            'sequences' => DB::table('sys_sequences')->orderBy('label')->orderBy('series')->get(['doc_type', 'label', 'series', 'prefix', 'pad_width', 'next_number', 'year_reset', 'updated_at'])->map(fn (object $row): array => [
                'doc_type' => $row->doc_type,
                'series' => $row->series,
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

    public function sequencePage(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = DB::table('sys_sequences')
            ->when($filters['doc_type'] ?? null, fn (Builder $q, string $type) => $q->whereIn('doc_type', explode(',', $type)))
            ->select(['id', 'doc_type', 'label', 'series', 'prefix', 'pad_width', 'next_number', 'year_reset', 'updated_at']);

        return CursorPage::respond($request, $query, ['label' => 'label', 'doc_type' => 'doc_type', 'updated_at' => 'updated_at'], 'label', fn (object $row): array => self::sequence($row), [
            'kpis' => ['total' => DB::table('sys_sequences')->count()],
            'available_types' => collect(SettingsCatalog::SEQUENCE_TYPES)->keys()->diff(DB::table('sys_sequences')->pluck('doc_type'))->map(fn (string $type): array => ['value' => $type, 'label' => SettingsCatalog::SEQUENCE_TYPES[$type]['label']])->values()->all(),
        ]);
    }

    public function sequenceById(string $id): array
    {
        return self::sequence(DB::table('sys_sequences')->where('id', $id)->first() ?? throw ApiException::notFound('La serie no existe.'));
    }

    public function fxPage(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = DB::table('fin_fx_rates as f')
            ->leftJoin('iam_users as u', 'u.id', '=', 'f.created_by')
            ->when($filters['from_currency'] ?? $filters['currency'] ?? null, fn (Builder $q, string $currency) => $q->where('f.currency_code', strtoupper($currency)))
            ->when($filters['rate_date'] ?? null, fn (Builder $q, string $date) => $q->where('f.rate_date', $date))
            ->select(['f.id', 'f.rate_date', 'f.currency_code', 'f.base_currency', 'f.rate_pen', 'f.buy', 'f.sell', 'f.previous_rate', 'f.source', 'f.created_by', 'f.created_at', 'f.effective_at', 'u.name as user_name']);

        return CursorPage::respond($request, $query, ['rate_date' => 'f.rate_date', 'created_at' => 'f.created_at', 'from_currency' => 'f.currency_code'], '-rate_date,-created_at', fn (object $row): array => [
            'id' => $row->id,
            'rate_date' => $row->rate_date,
            'from_currency' => $row->currency_code,
            'to_currency' => $row->base_currency ?? 'PEN',
            'rate' => (string) $row->rate_pen,
            'buy' => $row->buy === null ? null : (string) $row->buy,
            'sell' => $row->sell === null ? null : (string) $row->sell,
            'previous_rate' => $row->previous_rate === null ? null : (string) $row->previous_rate,
            'source' => $row->source,
            'created_by' => $row->created_by,
            'created_by_name' => $row->user_name ?? 'Sistema',
            'created_at' => $row->created_at,
            'effective_at' => $row->effective_at,
        ]);
    }

    public static function sequence(object $row): array
    {
        return [
            'id' => $row->id,
            'doc_type' => $row->doc_type,
            'label' => $row->label,
            'series' => $row->series,
            'prefix' => $row->prefix,
            'pad_width' => (int) $row->pad_width,
            'next_number' => (int) $row->next_number,
            'year_reset' => (bool) $row->year_reset,
            'updated_at' => $row->updated_at,
            'next_document' => $row->prefix.str_pad((string) $row->next_number, (int) $row->pad_width, '0', STR_PAD_LEFT),
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
