<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\TravelInventory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ExternalOffers
{
    public const RULE = 'R-GDS-OFFERS';

    public const KINDS = ['aereo' => 'Aéreo', 'hotel' => 'Hotel', 'auto' => 'Auto', 'seguro' => 'Seguro'];

    public const STATUSES = ['cotizada' => 'Cotizada', 'retenida' => 'Retenida', 'emitida' => 'Emitida', 'vencida' => 'Vencida', 'cancelada' => 'Quitada', 'error' => 'Error'];

    private const EDITABLE = ['borrador', 'enviada', 'vista', 'negociacion'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly TravelInventory $inventory,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
    ) {}

    public function search(string $quoteKey, array $criteria, User $actor): array
    {
        $this->gate->require(self::RULE);
        $quote = $this->quote($quoteKey, $actor);
        $from = (string) ($criteria['date_from'] ?? $quote->travel_from);
        $to = (string) ($criteria['date_to'] ?? $quote->travel_to);

        if ($to < $from) {
            throw ApiException::unprocessable('DATES_INVALID', 'La fecha de regreso debe ser igual o posterior a la de salida.');
        }

        $offers = $this->inventory->search([
            'kind' => $criteria['kind'],
            'origin' => $criteria['origin'] ?? null,
            'destination' => $criteria['destination'],
            'date_from' => $from,
            'date_to' => $criteria['kind'] === 'aereo' && empty($criteria['date_to']) ? null : $to,
            'pax' => (int) ($criteria['pax'] ?? ((int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf)),
            'currency' => $quote->currency,
        ]);

        return [...$this->state($quote), 'results' => array_map(fn (array $offer) => [...$offer, 'kind_label' => self::KINDS[$offer['kind']]], $offers)];
    }

    public function add(string $quoteKey, array $data, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($quoteKey, $data, $actor): array {
            $quote = $this->quote($quoteKey, $actor, true);
            $offer = $this->inventory->find((string) $data['provider'], (string) $data['offer_ref']);

            if ($offer === null) {
                throw ApiException::unprocessable('OFFER_NOT_FOUND', 'La oferta ya no está disponible en el proveedor. Vuelve a buscar.');
            }

            if (Carbon::parse($offer['offer_expires_at'])->isPast()) {
                throw ApiException::unprocessable('OFFER_EXPIRED', 'La oferta venció. Vuelve a buscar para ver el precio vigente.');
            }

            if ($offer['currency'] !== $quote->currency) {
                throw ApiException::unprocessable('CURRENCY_MISMATCH', 'La oferta está en otra moneda que la cotización.');
            }

            $existing = DB::table('quote_external_offers')->where('provider', $offer['provider'])->where('offer_ref', $offer['offer_ref'])->first(['id', 'quote_id', 'status']);

            if ($existing !== null && ((string) $existing->quote_id !== (string) $quote->id || ! in_array($existing->status, ['cancelada', 'vencida', 'error'], true))) {
                throw ApiException::conflict('OFFER_ALREADY_ADDED', 'Esta oferta ya está en '.((string) $existing->quote_id === (string) $quote->id ? 'la cotización' : 'otra cotización').'.');
            }

            $values = [
                'version_id' => $quote->current_version_id,
                'kind' => $offer['kind'],
                'summary' => mb_substr($offer['summary'], 0, 300),
                'payload' => json_encode($offer['payload'], JSON_UNESCAPED_UNICODE),
                'net_amount' => $offer['net_amount'],
                'sell_amount' => $offer['sell_amount'],
                'currency' => $offer['currency'],
                'offer_expires_at' => $offer['offer_expires_at'],
                'status' => 'cotizada',
                'updated_by' => $actor->getKey(),
            ];

            if ($existing !== null) {
                DB::table('quote_external_offers')->where('id', $existing->id)->update($values);
            } else {
                DB::table('quote_external_offers')->insert([...$values, 'id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'provider' => $offer['provider'], 'offer_ref' => $offer['offer_ref'], 'created_by' => $actor->getKey()]);
            }

            $this->audit->log('Cotización', (string) $quote->code, 'agregar_oferta', after: self::KINDS[$offer['kind']].' · '.$offer['summary'].' · '.Decimal::display($offer['sell_amount'], $offer['currency']), actor: $actor);

            return $this->state($quote);
        });
    }

    public function remove(string $quoteKey, string $offerKey, User $actor): void
    {
        $this->gate->require(self::RULE);

        DB::transaction(function () use ($quoteKey, $offerKey, $actor): void {
            $quote = $this->quote($quoteKey, $actor, true);
            $offer = DB::table('quote_external_offers')->where('quote_id', $quote->id)->where(Str::isUuid($offerKey) ? 'id' : 'offer_ref', $offerKey)->first(['id', 'status', 'summary']);

            if ($offer === null || $offer->status === 'cancelada') {
                throw ApiException::notFound('La oferta no está en esta cotización.');
            }

            if ($offer->status === 'emitida') {
                throw ApiException::conflict('OFFER_ISSUED', 'La oferta ya fue emitida en el proveedor y no se puede quitar. Anúlala desde la reserva.');
            }

            DB::table('quote_external_offers')->where('id', $offer->id)->update(['status' => 'cancelada', 'updated_by' => $actor->getKey()]);
            $this->audit->log('Cotización', (string) $quote->code, 'quitar_oferta', $offer->summary, null, actor: $actor);
        });
    }

    private function quote(string $key, User $actor, bool $lock = false): object
    {
        $query = DB::table('quote_quotes')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key);
        $quote = ($lock ? $query->lock('for no key update') : $query)->first(['id', 'code', 'status', 'owner_id', 'currency', 'travel_from', 'travel_to', 'pax_adt', 'pax_chd', 'pax_inf', 'current_version_id', 'current_version_no', 'title', 'client_id', 'lock_version', 'valid_until', 'fx_rate']);

        if ($quote === null) {
            throw ApiException::notFound('La cotización no existe.');
        }

        if (Portfolio::ownOnly($actor) && (string) $quote->owner_id !== (string) $actor->getKey()) {
            throw ApiException::forbidden('SEC-BR-09', 'Esta cotización pertenece a la cartera de otro asesor. Pide a tu gerente que te la reasigne.', ['crm.records.reassign']);
        }

        if ($lock && ! in_array($quote->status, self::EDITABLE, true)) {
            throw ApiException::unprocessable('QUOTE_NOT_EDITABLE', 'La cotización está '.$quote->status.'; las ofertas de aéreo y hotel solo se cambian antes de aprobarla.');
        }

        return $quote;
    }

    private function state(object $quote): array
    {
        DB::table('quote_external_offers')->where('quote_id', $quote->id)->whereIn('status', ['cotizada', 'retenida'])->where('offer_expires_at', '<', now())->update(['status' => 'vencida']);
        $offers = DB::table('quote_external_offers')->where('quote_id', $quote->id)->where('status', '<>', 'cancelada')->orderBy('created_at')
            ->get(['id', 'provider', 'kind', 'offer_ref', 'summary', 'net_amount', 'sell_amount', 'currency', 'offer_expires_at', 'pnr', 'status']);
        $active = $offers->whereIn('status', ['cotizada', 'retenida', 'emitida']);

        return [
            'id' => $quote->id,
            'code' => $quote->code,
            'client_id' => $quote->client_id,
            'owner_id' => $quote->owner_id,
            'title' => $quote->title,
            'status' => $quote->status,
            'current_version_no' => (int) $quote->current_version_no,
            'current_version_id' => $quote->current_version_id,
            'travel_from' => $quote->travel_from,
            'travel_to' => $quote->travel_to,
            'valid_until' => $quote->valid_until,
            'currency' => $quote->currency,
            'fx_rate' => (string) $quote->fx_rate,
            'pax_adt' => (int) $quote->pax_adt,
            'pax_chd' => (int) $quote->pax_chd,
            'pax_inf' => (int) $quote->pax_inf,
            'lock_version' => (int) $quote->lock_version,
            'editable' => in_array($quote->status, self::EDITABLE, true),
            'external_offers' => $offers->map(fn (object $row) => [
                'id' => $row->id,
                'provider' => $row->provider,
                'kind' => $row->kind,
                'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
                'offer_ref' => $row->offer_ref,
                'summary' => $row->summary,
                'net_amount' => (string) $row->net_amount,
                'sell_amount' => (string) $row->sell_amount,
                'currency' => $row->currency,
                'offer_expires_at' => $row->offer_expires_at ? Carbon::parse((string) $row->offer_expires_at)->toIso8601String() : null,
                'pnr' => $row->pnr,
                'status' => $row->status,
                'status_label' => self::STATUSES[$row->status] ?? $row->status,
            ])->values()->all(),
            'external_total' => (string) $active->reduce(fn ($carry, object $row) => $carry->plus((string) $row->sell_amount), Decimal::round2('0')),
        ];
    }
}
