<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ApprovalsSeeder
{
    use SeedsTenant;

    private const ORIGIN_TYPES = ['quote', 'cancel'];

    private const SUBJECT_TYPES = [
        'reservation' => 'booking_reservations',
        'payment' => 'fin_payments',
        'payable' => 'fin_payables',
        'commission' => 'fin_commissions',
        'providerRequest' => 'supplier_rate_requests',
        'agency' => 'channel_b2b_agencies',
    ];

    private const ORIGIN_LOCKED = ['quote', 'cancel', 'reversal', 'payable', 'commission', 'provider_rate'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $rules = $this->seedRules();
        $fx = (float) (DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->value('rate_pen') ?? 3.75);

        foreach (KitSeeds::read('approvals') as $seed) {
            if (in_array($seed['type'], self::ORIGIN_TYPES, true)) {
                $seed['type'] === 'quote' ? $this->seedQuoteRequest($seed) : $this->seedCancelRequest($seed);

                continue;
            }

            $this->seedGeneric($seed, $rules, $seed['currency'] === 'USD' ? $fx : 1.0);
        }
    }

    private function seedRules(): array
    {
        $rules = [];

        foreach (KitSeeds::read('approvalRules') as $seed) {
            $rules[$seed['type']][$seed['level']] = [
                'id' => $this->upsert('collab_approval_rules', ['code' => $seed['id']], [
                    'request_type' => $seed['type'],
                    'level' => $seed['level'],
                    'permission' => $seed['perm'],
                    'min_amount_pen' => $seed['min'],
                    'sla_hours' => $seed['sla'],
                    'forbid_self_approval' => $seed['noSelf'],
                    'is_active' => $seed['active'],
                    'is_origin_locked' => $seed['level'] === 1 && in_array($seed['type'], self::ORIGIN_LOCKED, true),
                ]),
                'min' => (float) $seed['min'],
            ];
        }

        return $rules;
    }

    private function seedGeneric(array $seed, array $rules, float $fx): void
    {
        $requester = $seed['requester'];
        $isUser = str_starts_with($requester, 'U');
        $amountBase = round((float) $seed['amount'] * $fx, 2);
        $levels = collect($rules[$seed['type']] ?? [])->filter(fn (array $rule): bool => $rule['min'] <= $amountBase)->count() ?: 1;
        $decided = in_array($seed['status'], ['aprobada', 'rechazada'], true);
        $kind = $seed['ref']['kind'] ?? null;

        $id = $this->upsert('collab_approval_requests', ['code' => $seed['id']], [
            'request_type' => $seed['type'],
            'is_generic' => ! ($seed['origin'] ?? false),
            'subject_type' => self::SUBJECT_TYPES[$kind] ?? null,
            'subject_id' => $kind === 'reservation' ? $this->idByCode('booking_reservations', $seed['ref']['id']) : null,
            'subject_code' => $seed['ref']['id'] ?? null,
            'dedupe_key' => $seed['key'] ?? "{$seed['type']}:{$seed['id']}",
            'title' => $seed['title'],
            'justification' => $seed['detail'] ?? null,
            'requester_id' => $isUser ? $this->userId($requester) : null,
            'requester_kind' => $isUser ? 'user' : ($requester === 'Sistema' ? 'system' : 'supplier'),
            'amount' => $seed['amount'],
            'currency' => $seed['currency'],
            'fx_rate' => $fx,
            'status' => $seed['status'],
            'current_level' => min($seed['level'], 2),
            'total_levels' => max($levels, $seed['level']),
            'due_at' => $this->moment($seed['dueAt'] ?? null),
            'decided_by' => $decided ? $this->userId($seed['decidedBy'] ?? null) : null,
            'decided_at' => $decided ? $this->moment($seed['decidedAt'] ?? null) : null,
            'decision_note' => $decided ? ($seed['decisionNote'] ?? null) : null,
            'closed_in_origin' => false,
            'created_by' => $isUser ? $this->userId($requester) : null,
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($seed['decidedAt'] ?? $seed['createdAt']),
        ]);

        DB::table('collab_approval_steps')->where('request_id', $id)->delete();

        foreach ($seed['steps'] ?? [] as $step) {
            DB::table('collab_approval_steps')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'request_id' => $id,
                'level' => $step['level'],
                'rule_id' => $rules[$seed['type']][$step['level']]['id'],
                'decision' => 'aprobada',
                'decided_by' => $this->userId($step['by']),
                'note' => $step['note'] ?? null,
                'decided_at' => $this->moment($step['ts']),
            ]);
        }

        if (DB::table('collab_approval_events')->where('request_id', $id)->exists()) {
            return;
        }

        foreach ($seed['log'] ?? [] as $entry) {
            DB::table('collab_approval_events')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->tenant->getKey(),
                'request_id' => $id,
                'event' => $this->event($entry['action']),
                'actor_id' => str_starts_with((string) $entry['user'], 'U') ? $this->userId($entry['user']) : null,
                'note' => trim($entry['note'] ?? '') ?: $entry['action'],
                'occurred_at' => $this->moment($entry['ts']),
            ]);
        }
    }

    private function event(string $action): string
    {
        return match (true) {
            str_starts_with($action, 'Aprobó nivel') => 'aprobada_nivel',
            str_starts_with($action, 'Aprobó') => 'aprobada',
            str_starts_with($action, 'Rechazó') => 'rechazada',
            default => 'creada',
        };
    }

    private function seedQuoteRequest(array $seed): void
    {
        $quoteId = $this->idByCode('quote_quotes', $seed['ref']['id']);
        $version = $quoteId ? DB::table('quote_versions')->where('quote_id', $quoteId)->where('version_no', $seed['ref']['v'] ?? 1)->first(['id', 'discount_pct', 'margin_pct']) : null;

        if ($version === null || DB::table('quote_internal_approvals')->where('quote_version_id', $version->id)->exists()) {
            return;
        }

        DB::table('quote_internal_approvals')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->tenant->getKey(),
            'quote_version_id' => $version->id,
            'reasons' => json_encode(array_values(array_filter([
                (float) $version->discount_pct > 5 ? "Descuento de {$version->discount_pct} %" : null,
                (float) $version->margin_pct < 15 ? "Margen de {$version->margin_pct} %" : null,
            ])), JSON_UNESCAPED_UNICODE),
            'over_cap' => (float) $version->discount_pct > 10,
            'requested_by' => $this->userId($seed['requester']),
            'requested_at' => $this->moment($seed['createdAt']),
            'request_note' => $seed['detail'] ?? null,
            'status' => 'pendiente',
            'is_override' => false,
            'created_by' => $this->userId($seed['requester']),
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($seed['createdAt']),
        ]);
    }

    private function seedCancelRequest(array $seed): void
    {
        $reservation = DB::table('booking_reservations')->where('code', $seed['ref']['id'])->first(['id', 'status']);

        if ($reservation === null || in_array($reservation->status, ['cancelada', 'completada'], true) || DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->exists()) {
            return;
        }

        DB::table('booking_cancel_requests')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->tenant->getKey(),
            'reservation_id' => $reservation->id,
            'reason' => 'Cambio de planes: '.($seed['detail'] ?? $seed['title']),
            'requested_by' => $this->userId($seed['requester']),
            'requested_at' => $this->moment($seed['createdAt']),
            'status' => 'pendiente',
            'created_by' => $this->userId($seed['requester']),
            'created_at' => $this->moment($seed['createdAt']),
            'updated_at' => $this->moment($seed['createdAt']),
        ]);
    }
}
