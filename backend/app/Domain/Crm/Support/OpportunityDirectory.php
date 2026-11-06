<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OpportunityDirectory
{
    public const OPEN = ['calificacion', 'descubrimiento', 'cotizacion', 'negociacion'];

    private ?float $fx = null;

    public function __construct(private readonly CrmCatalog $catalog, private readonly TenantContext $context) {}

    public function stages(): Collection
    {
        return DB::table('crm_pipeline_stages')->orderBy('sort_order')->get(['code', 'name', 'default_probability', 'is_closed'])
            ->map(fn (object $stage) => ['code' => $stage->code, 'name' => $stage->name, 'probability' => (int) $stage->default_probability, 'closed' => (bool) $stage->is_closed]);
    }

    public function board(User $viewer): array
    {
        $items = $this->rows($viewer)->orderBy('o.expected_close_date')->get()->map(fn (object $row) => $this->summary($row));
        $open = $items->whereIn('stage', self::OPEN);
        $month = Carbon::now($this->timezone())->format('Y-m');
        $closed = $items->whereIn('stage', ['ganada', 'perdida']);
        $won = $closed->where('stage', 'ganada');

        return [
            'stages' => $this->stages(),
            'items' => $items->values(),
            'kpis' => [
                'open_pen' => (int) round($open->sum('amount_pen')),
                'weighted_pen' => (int) round($open->sum(fn (array $item) => $item['amount_pen'] * $item['probability'] / 100)),
                'won_month_pen' => (int) round($won->filter(fn (array $item) => str_starts_with((string) $item['closed_at'], $month))->sum('amount_pen')),
                'close_rate' => $closed->count() > 0 ? round($won->count() / $closed->count() * 100) : null,
            ],
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('o.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $lead = $row->lead_id ? DB::table('crm_leads')->where('id', $row->lead_id)->first(['code', 'full_name']) : null;

        return [
            ...$this->summary($row),
            'notes' => $row->notes,
            'lock_version' => (int) $row->lock_version,
            'owner_id' => $row->owner_id,
            'origin' => $row->origin,
            'lost_reason' => $this->catalog->label('lost_reason', $row->lost_reason_code),
            'lost_detail' => $row->lost_detail,
            'lost_at_stage' => $row->lost_at_stage,
            'lead' => $lead ? ['code' => $lead->code, 'name' => $lead->full_name] : null,
            'quotes' => DB::table('quote_quotes')->where('opportunity_id', $row->id)->whereNull('deleted_at')->orderByDesc('created_at')->get(['code', 'title', 'status', 'valid_until']),
            'history' => DB::table('audit_events')->where('entity', 'Oportunidad')->where('entity_id', $row->code)->orderByDesc('occurred_at')->limit(20)
                ->get(['action', 'before_value', 'after_value', 'occurred_at']),
            'stages' => $this->stages(),
        ];
    }

    public function fx(): float
    {
        return $this->fx ??= (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->value('rate_pen') ?? 3.75);
    }

    public function scoped(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('crm_opportunities as o')->whereNull('o.deleted_at'), $viewer, 'o.owner_id');
    }

    private function rows(User $viewer): Builder
    {
        return $this->scoped($viewer)
            ->join('crm_clients as c', 'c.id', '=', 'o.client_id')
            ->join('iam_users as u', 'u.id', '=', 'o.owner_id')
            ->select(['o.*', 'c.code as client_code', 'c.name as client_name', 'u.name as owner_name', 'u.avatar_color as owner_color']);
    }

    private function summary(object $row): array
    {
        $amount = (float) $row->amount;

        return [
            'code' => $row->code,
            'title' => $row->title,
            'stage' => $row->stage,
            'amount' => $row->amount,
            'currency' => $row->currency,
            'amount_pen' => round($row->currency === 'USD' ? $amount * $this->fx() : $amount, 2),
            'probability' => (int) $row->probability,
            'expected_close_date' => $row->expected_close_date,
            'closed_at' => $row->closed_at,
            'destination' => $row->destination_label,
            'pax' => (int) $row->pax,
            'client' => ['code' => $row->client_code, 'name' => $row->client_name],
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
            'updated_at' => Carbon::parse($row->updated_at)->toIso8601String(),
        ];
    }

    private function timezone(): string
    {
        return $this->context->tenant()->timezone ?: 'America/Lima';
    }
}
