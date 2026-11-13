<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Support\FunnelRecorder;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\ShowcaseDirectory;
use App\Domain\Showcase\Support\ShowcaseRules;
use App\Domain\Showcase\Support\ShowcaseSequence;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ShowcaseBookings
{
    public function __construct(
        private readonly ShowcaseDirectory $directory,
        private readonly ShowcaseSequence $sequence,
        private readonly FunnelRecorder $funnel,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function book(string $slug, array $data): array
    {
        $result = $this->db()->transaction(function () use ($slug, $data): array {
            $listing = $this->db()->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')
                ->where('l.slug', $slug)->where('l.status', 'publicado')->where('a.status', 'activa')
                ->lock('for no key update of l')
                ->first(['l.id', 'l.code', 'l.title', 'l.model', 'l.price', 'l.currency', 'l.capacity', 'l.agency_id', 'a.tenant_id', DB::raw('array_to_json(l.languages) as languages'), DB::raw('array_to_json(l.start_times) as times')])
                ?? throw ApiException::notFound('La publicación no existe o ya no recibe reservas.');
            $this->assertSlot($listing, $data);
            $email = Str::lower(trim((string) $data['email']));
            $taken = $this->db()->table('platform_showcase_bookings')->where('listing_id', $listing->id)->where('service_date', $data['date'])->where('start_time', $data['time'])->where('status', '<>', 'cancelada');

            if ((clone $taken)->where('traveler_email', $email)->exists()) {
                throw ApiException::conflict('VT-02', 'Ya tiene una reserva con este correo para esa salida. Revise su correo de confirmación.');
            }

            $left = (int) $listing->capacity - (int) (clone $taken)->sum('pax');

            if ((int) $data['pax'] > $left) {
                throw ApiException::conflict('VT-02', $left > 0 ? "Quedan {$left} cupos para esa salida." : 'Esa salida ya no tiene cupos. Elija otro horario o fecha.', ['available' => max(0, $left)]);
            }

            $fee = $this->fee($listing, (int) $data['pax'], (string) $data['date']);
            $code = $this->sequence->next(ShowcaseSequence::BOOKING);
            $token = Str::random(40);
            $this->db()->table('platform_showcase_bookings')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                'listing_id' => $listing->id,
                'service_date' => $data['date'],
                'start_time' => $data['time'],
                'traveler_name' => trim((string) $data['name']),
                'traveler_email' => $email,
                'pax' => (int) $data['pax'],
                'language' => Str::lower((string) $data['language']),
                'status' => 'confirmada',
                'currency' => $listing->currency,
                'marketing_consent' => (bool) ($data['marketing_consent'] ?? false),
                'source' => isset($data['utm_source']) ? mb_substr((string) $data['utm_source'], 0, 40) : 'Vitrina',
                'cancel_token' => $token,
                'created_at' => now(),
                'updated_at' => now(),
                ...$fee,
            ]);
            $this->funnel->record('reserva', $listing->agency_id, $listing->tenant_id, $listing->id, FunnelRecorder::utm($data));
            $this->audit->log('Vitrina reserva', $code, 'reservar', null, "{$listing->code} · {$data['date']} {$data['time']} · {$data['pax']} pax", connection: 'pgsql_platform');

            return ['code' => $code, 'cancel_token' => $token, 'status' => 'confirmada', 'listing' => ['code' => $listing->code, 'title' => $listing->title], 'date' => $data['date'], 'time' => $data['time'], 'pax' => (int) $data['pax'], 'free' => $listing->model === 'propina', 'amount' => $fee['amount'], 'currency' => $listing->currency];
        });

        return $result;
    }

    public function cancel(string $token): array
    {
        return $this->db()->transaction(function () use ($token): array {
            $booking = $this->db()->table('platform_showcase_bookings')->where('cancel_token', $token)->lock('for no key update')->first() ?? throw ApiException::notFound('No encontramos la reserva. Revise el enlace de su correo.');

            if ($booking->status !== 'confirmada') {
                throw ApiException::conflict('VT-CANCEL', $booking->status === 'cancelada' ? 'La reserva ya estaba cancelada.' : 'La salida ya pasó y no se puede cancelar.');
            }

            if ((string) $booking->service_date < Carbon::today('America/Lima')->toDateString()) {
                throw ApiException::conflict('VT-CANCEL', 'La salida ya pasó y no se puede cancelar.');
            }

            $this->db()->table('platform_showcase_bookings')->where('id', $booking->id)->update(['status' => 'cancelada', 'updated_at' => now()]);
            $this->audit->log('Vitrina reserva', $booking->code, 'cancelar', 'confirmada', 'cancelada · viajero', connection: 'pgsql_platform');

            return ['code' => $booking->code, 'status' => 'cancelada'];
        });
    }

    public function attendance(string $code, string $status): array
    {
        $agency = $this->directory->agencyFor($this->context->idOrFail()) ?? throw ApiException::notFound('La reserva no existe.');

        $result = $this->db()->transaction(function () use ($code, $status, $agency): array {
            $booking = $this->db()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
                ->where('b.code', $code)->where('l.agency_id', $agency->id)->lock('for no key update of b')->first(['b.*'])
                ?? throw ApiException::notFound('La reserva no existe.');

            if ($booking->status !== 'confirmada') {
                throw ApiException::conflict('VT-ATTENDANCE', 'La asistencia ya se marcó o la reserva está cancelada.');
            }

            if ((string) $booking->service_date > Carbon::today('America/Lima')->toDateString()) {
                throw ApiException::unprocessable('VT-ATTENDANCE', 'La asistencia se marca desde el día de la salida.');
            }

            $changes = ['status' => $status, 'updated_at' => now()];

            if ($status === 'no_show' && $booking->fee_basis === 'por_asistente') {
                $changes['fee_amount'] = '0';
            }

            $this->db()->table('platform_showcase_bookings')->where('id', $booking->id)->update($changes);

            return ['code' => $code, 'status' => $status, 'before' => $booking->status];
        });
        $this->audit->log('Vitrina reserva', $code, 'asistencia', $result['before'], $status);

        return ['code' => $code, 'status' => $status];
    }

    public function fee(object $listing, int $pax, string $date): array
    {
        $plan = ShowcaseRules::planOf($listing->tenant_id);

        if ($listing->model === 'pago') {
            $pct = ShowcaseRules::commissionFor($plan);
            $amount = Decimal::money($listing->price)->multipliedBy($pax)->toScale(2);

            return ['fee_basis' => 'comision', 'commission_pct' => $pct, 'amount' => (string) $amount, 'fee_amount' => (string) $amount->multipliedBy($pct)->dividedBy(100, 2, RoundingMode::HALF_UP)];
        }

        if ($plan !== 'none') {
            return ['fee_basis' => 'plan', 'commission_pct' => null, 'amount' => null, 'fee_amount' => '0'];
        }

        $month = Carbon::parse($date);
        $used = $this->db()->table('platform_showcase_bookings as b')->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
            ->where('l.agency_id', $listing->agency_id)->where('b.status', '<>', 'cancelada')
            ->whereBetween('b.service_date', [$month->copy()->startOfMonth()->toDateString(), $month->copy()->endOfMonth()->toDateString()])->count();

        if ($used < ShowcaseRules::FREE_MONTHLY_BOOKINGS) {
            return ['fee_basis' => 'cupo_gratis', 'commission_pct' => null, 'amount' => null, 'fee_amount' => '0'];
        }

        return ['fee_basis' => 'por_asistente', 'commission_pct' => null, 'amount' => null, 'fee_amount' => (string) Decimal::money(ShowcaseRules::FEE_PER_ATTENDEE)->multipliedBy($pax)->toScale(2)];
    }

    private function assertSlot(object $listing, array $data): void
    {
        if ((string) $data['date'] < Carbon::today('America/Lima')->toDateString()) {
            throw ApiException::unprocessable('VT-02', 'Elija una fecha desde hoy.', ['field' => 'date']);
        }

        if (! in_array($data['time'], PgArray::parse($listing->times), true)) {
            throw ApiException::unprocessable('VT-02', 'Elija uno de los horarios de salida del tour.', ['field' => 'time']);
        }

        if (! in_array(Str::lower((string) $data['language']), PgArray::parse($listing->languages), true)) {
            throw ApiException::unprocessable('VT-02', 'Elija uno de los idiomas en que se ofrece el tour.', ['field' => 'language']);
        }
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
