<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Support\TenantBootstrap;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\SupplierPortal\Actions\SupplierRateRequests;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use App\Domain\SupplierPortal\Support\SupplierDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SupplierContractController
{
    public function __construct(private readonly SupplierDirectory $directory) {}

    public function me(Request $request): JsonResponse
    {
        $account = $this->account($request);
        $session = $this->directory->session($account);

        return $this->json([
            ...$session,
            'provider' => [...$session['provider'], 'id' => $account->id(), 'currency' => $account->provider->currency, 'payment_terms' => $account->provider->payment_terms, 'status' => $account->provider->status],
            'user' => [...$session['user'], 'code' => $account->user->code],
            'permissions' => collect(TenantBootstrap::SUPPLIER_PERMISSIONS)->filter(fn (string $permission): bool => $account->user->can($permission))->values(),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $home = $this->directory->home($this->account($request));

        return $this->json(['today' => $home['today'], 'kpis' => $home['kpis'], 'alerts' => $home['alerts']]);
    }

    public function contract(Request $request): JsonResponse
    {
        $company = $this->directory->company($this->account($request));

        return $this->json([
            'provider' => $company['provider'],
            'conditions' => ['currency' => $company['provider']['currency'], 'payment_terms' => $company['provider']['payment_terms']],
            'contract' => $company['contract'],
            'contacts' => $company['contacts'],
            'agency' => $company['agency'],
        ]);
    }

    public function rateRequests(Request $request, SupplierRateRequests $requests): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $rows = collect($this->directory->rates($this->account($request), $requests)['requests'])
            ->when($filters['status'] ?? null, fn ($rows, string $status) => $rows->whereIn('status', explode(',', $status)))
            ->when($filters['service'] ?? null, fn ($rows, string $service) => $rows->where('service_ref', $service))
            ->values()
            ->all();

        return response()->json(CursorPage::respondItems($request, $rows));
    }

    private function account(Request $request): SupplierAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return SupplierAccount::of($user);
    }

    private function json(array $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }
}
