<?php

declare(strict_types=1);

namespace App\Domain\Portal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PassengerTripActions;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Support\SiteAccountDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class CustomerPortalController
{
    public function webSummary(Request $request, string $code, SiteAccountDirectory $directory): JsonResponse
    {
        $account = $this->customer($request);
        $reservation = $directory->reservation($account, $code);
        $id = $account->reservation($code)->id;
        $snapshot = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $id)->orderBy('service_date')->first();

        return response()->json(['data' => [
            'code' => $reservation['code'],
            'title' => $reservation['title'],
            'status' => $reservation['status'],
            'order' => $reservation['order'],
            'web' => $snapshot === null ? null : [
                'date' => $snapshot->service_date,
                'pax' => ['adt' => (int) $snapshot->pax_adt, 'chd' => (int) $snapshot->pax_chd, 'inf' => (int) $snapshot->pax_inf],
                'lines' => json_decode((string) $snapshot->lines, true) ?: [],
                'total' => Decimal::toApi((string) $snapshot->total),
                'currency' => $snapshot->charge_currency,
                'pickup' => ['point' => $snapshot->pickup_point, 'address' => $snapshot->pickup_address, 'flight' => $snapshot->pickup_flight, 'arrival' => $snapshot->pickup_arrival],
                'comments' => $snapshot->comments,
                'companions_pending' => (bool) $snapshot->companions_pending,
                'companions_due' => $snapshot->companions_due,
            ],
            'payment_plan' => $snapshot === null ? null : [
                'mode' => $snapshot->payment_mode,
                'deposit_pct' => $snapshot->deposit_pct !== null ? (float) $snapshot->deposit_pct : null,
                'deposit' => $snapshot->deposit !== null ? Decimal::toApi((string) $snapshot->deposit) : null,
                'balance' => $snapshot->balance !== null ? Decimal::toApi((string) $snapshot->balance) : null,
                'balance_due' => $snapshot->balance_due,
            ],
            'receivables' => array_values(array_filter($reservation['receivables'], fn (array $row): bool => in_array($row['status'], ['abierta', 'parcial', 'vencida'], true))),
            'passengers' => $reservation['passengers'],
        ]]);
    }

    public function companions(Request $request, string $code, PassengerTripActions $actions): JsonResponse
    {
        $account = $this->customer($request);
        $version = $request->header('If-Match');

        return response()->json(['data' => $actions->updateCompanions($account, $code, $request->only(['passengers', 'pickup']), is_numeric($version) ? (int) $version : null)]);
    }

    private function customer(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);
        $account = PortalAccount::of($user);

        if ($account->isPassenger()) {
            throw ApiException::forbidden('PORTAL_CUSTOMER_ONLY', 'Esta sección es para quien hizo la reserva.');
        }

        return $account;
    }
}
