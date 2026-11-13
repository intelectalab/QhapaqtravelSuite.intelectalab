<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CheckinPasses
{
    public const RULE = 'R-QR-CHECKIN';

    public const KINDS = ['tour', 'traslado', 'actividad', 'excursion', 'tren', 'entrada', 'transporte'];

    public const STATUSES = ['emitido' => 'Por ingresar', 'usado' => 'Ingresó', 'anulado' => 'Anulado'];

    private const CLOSED_SERVICES = ['cancelado', 'rechazado', 'anulado', 'reemplazado'];

    public function __construct(private readonly TenantContext $context) {}

    public function ensure(string $reservationId): void
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->whereNull('deleted_at')->first(['id', 'status']);

        if ($reservation === null || in_array($reservation->status, ['borrador', 'cancelada'], true)) {
            return;
        }

        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->whereIn('service_kind', self::KINDS)->whereNotIn('status', self::CLOSED_SERVICES)->pluck('id');
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservationId)->where('is_placeholder', false)->pluck('id');

        if ($services->isEmpty() || $passengers->isEmpty()) {
            return;
        }

        $existing = DB::table('ops_checkin_passes')->where('reservation_id', $reservationId)->where('status', '<>', 'anulado')->get(['service_id', 'passenger_id'])
            ->map(fn (object $row) => $row->service_id.'|'.$row->passenger_id)->flip();
        $rows = [];

        foreach ($services as $service) {
            foreach ($passengers as $passenger) {
                if ($existing->has($service.'|'.$passenger)) {
                    continue;
                }

                $id = (string) Str::uuid7();
                $rows[] = [
                    'id' => $id,
                    'tenant_id' => $this->context->idOrFail(),
                    'reservation_id' => $reservationId,
                    'passenger_id' => $passenger,
                    'service_id' => $service,
                    'token_hash' => DerivedTokens::hash(self::token($id)),
                    'status' => 'emitido',
                ];
            }
        }

        if ($rows !== []) {
            DB::table('ops_checkin_passes')->insertOrIgnore($rows);
        }

        $closed = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->whereIn('status', self::CLOSED_SERVICES)->pluck('id');

        if ($closed->isNotEmpty()) {
            DB::table('ops_checkin_passes')->whereIn('service_id', $closed)->where('status', 'emitido')->update(['status' => 'anulado']);
        }
    }

    public static function token(string $passId): string
    {
        return 'KPQ'.DerivedTokens::for('checkin-pass', $passId);
    }

    public function activeTemplate(): ?object
    {
        return DB::table('ops_waiver_templates')->where('active', true)->orderByDesc('created_at')->orderByDesc('version')->first(['id', 'code', 'name', 'lang', 'version', 'body', 'requires_guardian_for_minors']);
    }

    public function waiverRequired(?object $template): bool
    {
        return $template !== null;
    }

    public function signatures(string $reservationId, ?object $template): Collection
    {
        if ($template === null) {
            return collect();
        }

        return DB::table('ops_waiver_signatures')->where('reservation_id', $reservationId)->where('template_id', $template->id)->where('template_version', $template->version)
            ->get(['passenger_id', 'signed_name', 'guardian_name', 'signed_at'])->keyBy('passenger_id');
    }

    public static function isMinor(object $passenger, string $onDate): bool
    {
        if ($passenger->birth_date) {
            return Carbon::parse((string) $passenger->birth_date)->diffInYears(Carbon::parse($onDate)) < 18;
        }

        if ($passenger->age !== null) {
            return (int) $passenger->age < 18;
        }

        return in_array($passenger->pax_type, ['CHD', 'INF'], true);
    }

    public static function waiverState(object $passenger, ?object $template, Collection $signatures, string $onDate): string
    {
        if ($template === null) {
            return 'no_aplica';
        }

        $signature = $signatures->get($passenger->id);

        if ($signature === null) {
            return 'pendiente';
        }

        if ($template->requires_guardian_for_minors && self::isMinor($passenger, $onDate) && ! $signature->guardian_name) {
            return 'falta_tutor';
        }

        return 'firmado';
    }
}
