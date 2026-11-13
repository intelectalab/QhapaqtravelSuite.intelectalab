<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\RecipientUnsubscribe;
use App\Domain\Marketing\Support\CampaignDirectory;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

final class CampaignDetailController
{
    public function show(Request $request, string $code, CampaignDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->detail($code, $this->user($request))]);
    }

    public function audience(Request $request, string $code, CampaignDirectory $directory): JsonResponse
    {
        $at = $request->query('at');

        try {
            $when = is_string($at) && $at !== '' ? Carbon::parse($at) : null;
        } catch (Throwable) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La fecha de referencia no es válida.');
        }

        return response()->json(['data' => $directory->audienceOf($code, $when)]);
    }

    public function recipients(Request $request, string $code, RecipientUnsubscribe $recipients): JsonResponse
    {
        $campaign = DB::table('mkt_campaigns')->where('code', $code)->first(['id']) ?? throw ApiException::notFound('La campaña no existe.');
        $filters = CursorPage::filters($request);
        $status = $filters['status'] ?? null;

        if ($status !== null && ! array_key_exists($status, CampaignDirectory::RECIPIENT_STATUSES) && $status !== 'baja') {
            throw ApiException::unprocessable('FILTER_INVALID', 'Filtra por un estado de la lista.');
        }

        $query = DB::table('mkt_campaign_recipients')->where('campaign_id', $campaign->id)
            ->when($status === 'baja', fn ($builder) => $builder->whereNotNull('unsubscribed_at'))
            ->when($status !== null && $status !== 'baja', fn ($builder) => $builder->where('status', $status))
            ->when(isset($filters['q']), fn ($builder) => $builder->where('address', 'ilike', '%'.addcslashes((string) $filters['q'], '%_\\').'%'));

        return response()->json(CursorPage::respond($request, $query, ['created_at' => 'created_at', 'address' => 'address', 'status' => 'status'], 'address', fn (object $row): array => $recipients->present($row)));
    }

    public function unsubscribe(Request $request, string $code, string $id, RecipientUnsubscribe $recipients): JsonResponse
    {
        return response()->json(['data' => $recipients->manual($code, $id, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
