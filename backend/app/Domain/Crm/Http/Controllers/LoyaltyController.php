<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Support\LoyaltySegments;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LoyaltyController
{
    public function __construct(private readonly LoyaltySegments $segments) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'filter' => ['nullable', 'array'],
            'filter.segment' => ['nullable', 'string', 'max:40'],
            'filter.last_purchase' => ['nullable', 'in:'.implode(',', array_keys(LoyaltySegments::RECENCY))],
            'filter.destination' => ['nullable', 'string', 'max:120'],
        ], ['filter.last_purchase.in' => 'Elige un rango de última compra válido.'])['filter'] ?? [];
        $viewer = $this->user($request);
        $all = $this->segments->rows($viewer);
        $rows = $filters === [] ? $all : $this->segments->rows($viewer, $filters);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'total' => $rows->count(),
                'segments' => $all->pluck('segment')->filter()->unique()->sort()->values(),
                'destinations' => $all->pluck('destinations')->flatten()->unique()->sort()->values(),
                'recency' => collect(LoyaltySegments::RECENCY)->map(fn (string $label, string $value): array => ['value' => (string) $value, 'label' => $label])->values(),
                'can' => ['rebuy' => $viewer->can('crm.opportunities.manage')],
            ],
        ]);
    }

    public function proposal(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->segments->proposal($this->user($request), $code)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
