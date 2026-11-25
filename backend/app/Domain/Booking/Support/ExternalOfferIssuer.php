<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Models\Reservation;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\TravelInventory;
use App\Domain\Quotes\Actions\ExternalOffers;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ExternalOfferIssuer
{
    public const FAILED = 'OFFER_ISSUE_FAILED';

    private const ISSUABLE = ['cotizada', 'retenida'];

    private const BLOCKING = ['cotizada', 'retenida', 'vencida', 'error'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly TravelInventory $inventory,
        private readonly AuditLogger $audit,
    ) {}

    public function pending(string $quoteId, bool $lock = false): Collection
    {
        $query = DB::table('quote_external_offers')->where('quote_id', $quoteId)->whereIn('status', self::BLOCKING)->orderBy('created_at');

        return ($lock ? $query->lock('for no key update') : $query)
            ->get(['id', 'provider', 'kind', 'offer_ref', 'summary', 'payload', 'net_amount', 'sell_amount', 'currency', 'offer_expires_at', 'status']);
    }

    public function assertIssuable(Collection $offers, string $currency): BigDecimal
    {
        foreach ($offers as $offer) {
            if ($problem = $this->problem($offer, $currency)) {
                throw ApiException::unprocessable($problem['code'], $problem['message'], ['offer_id' => $offer->id]);
            }
        }

        return $this->total($offers);
    }

    public function check(string $quoteId, string $currency): ?array
    {
        $offers = $this->pending($quoteId);

        if ($offers->isEmpty()) {
            return null;
        }

        $problem = $offers->map(fn (object $offer): ?array => $this->problem($offer, $currency))->filter()->first();
        $count = $offers->count();

        return [
            'total' => $this->total($offers),
            'check' => ['key' => 'external_offers', 'title' => 'Aéreo y hotel', 'ok' => $problem === null, 'detail' => $problem['message']
                ?? $count.' '.($count === 1 ? 'oferta se emite' : 'ofertas se emiten').' en el proveedor por '.Decimal::display($this->total($offers), $currency).' y '.($count === 1 ? 'entra' : 'entran').' como servicio de la reserva.'],
        ];
    }

    public function issue(Reservation $reservation, string $quoteCode, Collection $offers, string $fxRate, int $seq, string $idempotencyKey, User $actor): int
    {
        $issued = [];

        foreach ($offers->whereIn('status', self::ISSUABLE) as $offer) {
            $result = $this->inventory->issue((string) $offer->provider, (string) $offer->offer_ref, $idempotencyKey.':'.$offer->id);

            if (! $result->ok || $result->externalId === null) {
                foreach ($issued as [$done, $pnr]) {
                    $this->inventory->void((string) $done->provider, $pnr);
                }

                throw ApiException::unprocessable(self::FAILED, 'El proveedor no emitió «'.$offer->summary.'»: '.rtrim($result->message ?? 'sin respuesta', '. ').'. No se creó la reserva. Quita la oferta o búscala de nuevo y vuelve a convertir.', ['offer_id' => $offer->id, 'quote_code' => $quoteCode, 'summary' => $offer->summary]);
            }

            $issued[] = [$offer, mb_substr($result->externalId, 0, 20)];
        }

        $number = SequenceService::numberOf($reservation->code);
        $tenantId = $this->context->idOrFail();

        foreach ($issued as [$offer, $pnr]) {
            $seq++;
            $criteria = (array) (json_decode((string) $offer->payload, true)['criteria'] ?? []);
            DB::table('booking_reservation_services')->insert([
                'tenant_id' => $tenantId,
                'reservation_id' => $reservation->id,
                'code' => sprintf('RS-%d%02d', $number, $seq),
                'name' => mb_substr((ExternalOffers::KINDS[$offer->kind] ?? $offer->kind).' · '.$offer->summary, 0, 200),
                'service_date' => $this->date($criteria['f'] ?? null) ?? $reservation->travel_from,
                'pax' => isset($criteria['p']) ? (int) $criteria['p'] : null,
                'status' => 'confirmado',
                'currency' => $offer->currency,
                'fx_rate' => $fxRate,
                'cost_amount' => (string) Decimal::round2((string) $offer->net_amount),
                'price_amount' => (string) Decimal::round2((string) $offer->sell_amount),
                'is_required' => true,
                'requires_assignment' => false,
                'service_kind' => $offer->kind === 'hotel' ? 'alojamiento' : 'libre',
                'confirmation_code' => $pnr,
                'confirmed_by_name' => ucfirst((string) $offer->provider),
                'confirmed_by' => $actor->getKey(),
                'confirmed_at' => now(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            DB::table('quote_external_offers')->where('id', $offer->id)->update(['status' => 'emitida', 'pnr' => $pnr, 'reservation_id' => $reservation->id, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Reserva', (string) $reservation->code, 'emitir_oferta', $offer->status, 'emitida · '.$offer->summary.' · '.$pnr, evidence: ['offer_ref' => $offer->offer_ref, 'provider' => $offer->provider, 'idempotency_key' => $idempotencyKey], actor: $actor);
        }

        return $seq;
    }

    public function reportFailure(ApiException $exception): void
    {
        if ($exception->ruleCode !== self::FAILED || ! isset($exception->details['quote_code'])) {
            return;
        }

        $this->audit->logOutsideTransaction('Cotización', (string) $exception->details['quote_code'], 'emitir_oferta_fallida', (string) ($exception->details['summary'] ?? ''), mb_substr($exception->getMessage(), 0, 500));
    }

    private function problem(object $offer, string $currency): ?array
    {
        $expires = $offer->offer_expires_at !== null ? Carbon::parse((string) $offer->offer_expires_at) : null;

        if ($offer->status === 'vencida' || ($expires !== null && $expires->isPast())) {
            return ['code' => 'OFFER_EXPIRED', 'message' => 'La oferta «'.$offer->summary.'» venció'.($expires !== null ? ' el '.$expires->setTimezone($this->context->timezone())->format('d/m/Y H:i') : '').'. Quítala en «Aéreo y hotel» o crea una nueva versión y vuelve a buscarla.'];
        }

        if ($offer->status === 'error') {
            return ['code' => self::FAILED, 'message' => 'La oferta «'.$offer->summary.'» quedó con error del proveedor. Quítala en «Aéreo y hotel» antes de convertir.'];
        }

        if ($offer->currency !== $currency) {
            return ['code' => 'CURRENCY_MISMATCH', 'message' => 'La oferta «'.$offer->summary.'» está en '.$offer->currency.' y la versión aprobada en '.$currency.'. Quítala y búscala de nuevo.'];
        }

        return null;
    }

    private function total(Collection $offers): BigDecimal
    {
        return $offers->whereIn('status', self::ISSUABLE)->reduce(fn (BigDecimal $carry, object $offer): BigDecimal => $carry->plus((string) $offer->sell_amount), Decimal::round2('0'));
    }

    private function date(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : null;
    }
}
