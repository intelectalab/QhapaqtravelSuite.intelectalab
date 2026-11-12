<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LeadDirectory
{
    public function __construct(
        private readonly CrmCatalog $catalog,
        private readonly CatalogInterest $interest,
        private readonly ActivityDirectory $activities,
        private readonly RecordHistory $history,
        private readonly LeadDuplicates $matcher,
    ) {}

    public function list(User $viewer): Collection
    {
        return $this->rows($viewer)->orderByDesc('l.created_at')->get()->map(fn (object $row) => $this->summary($row));
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->rows($viewer)->where('l.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $duplicate = match ($row->duplicate_of_type) {
            'client' => DB::table('crm_clients')->where('id', $row->duplicate_of_id)->first(['code', 'name']),
            'lead' => DB::table('crm_leads')->where('id', $row->duplicate_of_id)->first(['code', 'full_name as name']),
            default => null,
        };
        $open = in_array($row->status, LeadDuplicates::OPEN, true);
        $absorbed = DB::table('crm_leads')->where('duplicate_of_type', 'lead')->where('duplicate_of_id', $row->id)->whereNull('deleted_at')->orderBy('code')->get(['code', 'full_name as name']);
        $client = $row->converted_client_id ? DB::table('crm_clients')->where('id', $row->converted_client_id)->first(['code', 'name']) : null;
        $opportunity = $row->converted_opportunity_id ? DB::table('crm_opportunities')->where('id', $row->converted_opportunity_id)->first(['code', 'title', 'stage', 'amount', 'currency']) : null;

        return [
            ...$this->summary($row),
            'notes' => $row->notes,
            'product' => $this->interest->label($row->product_id),
            'bant' => $this->bant($row->id),
            'validated_at' => $this->iso($row->validated_at),
            'assigned_at' => $this->iso($row->assigned_at),
            'first_contact_at' => $this->iso($row->first_contact_at),
            'discard_reason' => $this->catalog->label('discard_reason', $row->discard_reason_code),
            'discard_detail' => $row->discard_detail,
            'discarded_at' => $this->iso($row->discarded_at),
            'discarded_from' => [2 => 'nuevo', 4 => 'contactado', 6 => 'calificado'][(int) $row->discarded_at_step] ?? null,
            'duplicate_of' => $duplicate ? ['type' => $row->duplicate_of_type, 'code' => $duplicate->code, 'name' => $duplicate->name] : null,
            'duplicates' => $open ? collect($this->matcher->find($row->email, $row->phone, $row->id))->map(fn (array $match) => [
                ...$match,
                'mergeable' => $match['type'] === 'lead' && ! in_array($match['status'], ['convertido', 'duplicado'], true),
            ])->values() : [],
            'absorbed' => $absorbed->map(fn (object $lead) => ['code' => $lead->code, 'name' => $lead->name])->values(),
            'activities' => $this->activities->related($viewer, ['lead' => [$row->id]]),
            'history' => $this->history->for([$row->code, ...$absorbed->pluck('code')->all()]),
            'converted' => $client ? [
                'at' => $this->iso($row->converted_at),
                'client' => ['code' => $client->code, 'name' => $client->name],
                'opportunity' => $opportunity ? ['code' => $opportunity->code, 'title' => $opportunity->title, 'stage' => $opportunity->stage, 'amount' => $opportunity->amount, 'currency' => $opportunity->currency] : null,
            ] : null,
        ];
    }

    public function bant(string $leadId): ?array
    {
        $row = DB::table('crm_lead_qualifications as q')->leftJoin('iam_users as u', 'u.id', '=', 'q.qualified_by')->where('q.lead_id', $leadId)->orderByDesc('q.qualified_at')
            ->first(['q.budget', 'q.authority', 'q.need', 'q.timeline', 'q.score', 'q.declared_amount', 'q.currency', 'q.notes', 'q.qualified_at', 'u.name as qualified_by']);

        return $row ? (array) $row : null;
    }

    private function rows(User $viewer): Builder
    {
        $query = DB::table('crm_leads as l')
            ->leftJoin('iam_users as u', 'u.id', '=', 'l.owner_id')
            ->whereNull('l.deleted_at')
            ->select(['l.*', 'u.name as owner_name', 'u.avatar_color as owner_color']);

        if (Portfolio::ownOnly($viewer)) {
            $query->where(fn (Builder $scope) => $scope->where('l.owner_id', $viewer->getKey())->orWhereNull('l.owner_id'));
        }

        return $query;
    }

    private function summary(object $row): array
    {
        return [
            'code' => $row->code,
            'name' => $row->full_name,
            'company' => $row->company,
            'email' => $row->email,
            'phone' => $row->phone,
            'source' => $this->catalog->label('lead_source', $row->source_code),
            'channel' => $this->catalog->label('lead_channel', $row->channel_code),
            'interest' => $this->catalog->label('lead_interest', $row->interest_code),
            'destination' => $row->destination_label,
            'destination_id' => $row->destination_id,
            'travel_date' => $row->travel_date,
            'pax' => (int) $row->pax,
            'score' => (int) $row->score,
            'status' => $row->status,
            'lock_version' => (int) $row->lock_version,
            'codes' => ['source' => $row->source_code, 'channel' => $row->channel_code, 'interest' => $row->interest_code],
            'owner_id' => $row->owner_id,
            'owner' => $row->owner_id ? ['name' => $row->owner_name, 'color' => $row->owner_color] : null,
            'created_at' => $this->iso($row->created_at),
        ];
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->toIso8601String();
    }
}
