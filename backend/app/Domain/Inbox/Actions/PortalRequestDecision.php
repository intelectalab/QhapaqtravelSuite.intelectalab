<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Catalog\Actions\ProviderRateReview;
use App\Domain\Finance\Actions\SettlementRequestWorkflow;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class PortalRequestDecision
{
    private const SETTLEMENT_PERMISSIONS = ['finance.commissions'];

    private const RATE_PERMISSIONS = ['catalog.products.manage_rates', 'catalog.providers.manage'];

    public function __construct(
        private readonly SettlementRequestWorkflow $settlements,
        private readonly ProviderRateReview $rates,
    ) {}

    public function decide(string $code, bool $approve, ?string $note, User $actor): ?array
    {
        return match ($this->source($code)) {
            'settlement' => $this->settlement($code, $approve, $note, $actor),
            'rate' => $this->rate($code, $approve, $note, $actor),
            default => null,
        };
    }

    private function settlement(string $code, bool $approve, ?string $note, User $actor): array
    {
        $this->authorize($actor, self::SETTLEMENT_PERMISSIONS);

        if (! $approve) {
            $this->settlements->reject($code, (string) $note, $actor);

            return ['code' => $code, 'status' => 'rechazada'];
        }

        return ['code' => $code, 'status' => 'aprobada', 'commissions' => $this->settlements->approve($code, $note, $actor)];
    }

    private function rate(string $code, bool $approve, ?string $note, User $actor): array
    {
        $this->authorize($actor, self::RATE_PERMISSIONS);

        if (! $approve) {
            $this->rates->reject($code, (string) $note, $actor);

            return ['code' => $code, 'status' => 'rechazada'];
        }

        return ['code' => $code, 'status' => 'aprobada', 'effect' => $this->rates->approve($code, $note, $actor)];
    }

    private function source(string $code): ?string
    {
        return match (true) {
            DB::table('channel_b2b_settlement_requests')->where('code', $code)->exists() => 'settlement',
            DB::table('supplier_rate_requests')->where('code', $code)->exists() => 'rate',
            default => null,
        };
    }

    private function authorize(User $actor, array $permissions): void
    {
        if (! collect($permissions)->contains(fn (string $permission): bool => $actor->can($permission))) {
            throw ApiException::forbidden(null, 'Tu rol no decide este tipo de solicitud.', $permissions);
        }
    }
}
