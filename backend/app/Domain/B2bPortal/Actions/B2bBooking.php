<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Actions;

use App\Domain\B2bPortal\Support\B2bAccount;
use App\Domain\B2bPortal\Support\B2bCatalog;
use App\Domain\Booking\Actions\Support\ServicesFromQuoteItem;
use App\Domain\Channels\Support\B2bCredit;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Operations\Actions\VoucherWorkflow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class B2bBooking
{
    public const CREDIT_DAYS = 15;

    public const PREPAY_DAYS = 1;

    public const DOC_TYPES = ['DNI', 'Pasaporte', 'CE'];

    public function __construct(
        private readonly B2bCatalog $catalog,
        private readonly ServicesFromQuoteItem $services,
        private readonly CodeSequence $sequence,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly VoucherWorkflow $vouchers,
        private readonly B2bCredit $credit,
    ) {}

    public function simulate(B2bAccount $account, array $data): array
    {
        $product = $this->catalog->product($account, $data['product']);

        return $this->catalog->price($account, $product, $data['date'], (int) $data['adults'], (int) ($data['children'] ?? 0));
    }

    public function create(B2bAccount $account, array $data): string
    {
        $denied = null;

        try {
            return DB::transaction(function () use ($account, $data, &$denied): string {
                $agency = DB::table('channel_b2b_agencies')->where('id', $account->agency->id)->lockForUpdate()->first();
                $account = new B2bAccount($account->user, $agency, $account->client, $account->today);
                $departureId = DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
                    ->where('p.code', $data['product'])->where('d.departure_date', $data['date'])->where('d.status', '<>', 'cancelada')
                    ->lock('for update of d')->value('d.id');
                $product = $this->catalog->product($account, $data['product']);
                $quote = $this->catalog->price($account, $product, $data['date'], (int) $data['adults'], (int) ($data['children'] ?? 0));

                if (! $quote['ok']) {
                    throw ApiException::unprocessable('B2B-BR-05', $quote['errors'][0], ['errors' => ['date' => $quote['errors']]]);
                }

                $mode = $data['pay_mode'];

                if ($mode === 'credito' && ! $quote['credit']['allowed']) {
                    $denied = BigDecimal::of($quote['credit']['amount'])->isGreaterThan($quote['credit']['available']) ? $quote : null;

                    throw ApiException::unprocessable($denied ? 'B2B-BR-04' : 'B2B-BR-03', (string) $quote['credit']['reason']);
                }

                $departureId = $quote['availability']['departure'] ? $departureId : null;

                return $this->book($account, $product, $quote, $departureId, $data);
            }, 3);
        } finally {
            if ($denied !== null) {
                $this->audit->logOutsideTransaction('Agencia B2B', (string) $account->agency->code, 'credito_excedido', (string) $denied['credit']['available'], "{$denied['product']} · {$denied['credit']['currency']} {$denied['credit']['amount']}");
            }
        }
    }

    private function book(B2bAccount $account, stdClass $product, array $quote, ?string $departureId, array $data): string
    {
        $user = $account->user;
        $mode = $data['pay_mode'];
        $today = Carbon::parse($account->today);
        $status = $mode === 'credito' ? $quote['outcome']['credito'] : $quote['outcome']['prepago'];
        $currency = $quote['currency'];
        $fx = $quote['fx'];
        $clientId = $this->client($account, $data['client'] ?? null);
        $owner = $this->owner($account);
        $sede = DB::table('iam_users')->where('id', $owner)->value('sede_id') ?? DB::table('iam_sedes')->whereNull('deleted_at')->orderByDesc('is_main')->value('id');
        $code = $this->sequences->next('reservation');
        $reference = isset($data['agency_ref']) ? trim((string) $data['agency_ref']) : null;
        $terms = [
            'price_list' => DB::table('channel_b2b_price_lists')->where('id', $account->agency->price_list_id)->value('name'),
            'commission_pct' => $quote['commission_pct'],
            'pay_mode' => $mode,
            'agency_ref' => $reference ?: null,
            'net_unit' => $quote['net_unit'],
            'pvp_total' => $quote['pvp_total'],
        ];

        $reservationId = (string) DB::table('booking_reservations')->insertGetId([
            'code' => $code,
            'client_id' => $clientId,
            'agency_id' => $account->agency->id,
            'owner_id' => $owner,
            'sede_id' => $sede,
            'title' => $product->name,
            'status' => $status,
            'channel' => 'B2B',
            'travel_from' => $quote['date'],
            'travel_to' => $quote['end'],
            'currency' => $currency,
            'fx_rate' => $fx,
            'total_amount' => $quote['net_total'],
            'snapshot_label' => Str::limit("Portal B2B {$account->agency->code} · {$product->name} · {$quote['date']}", 295),
            'catalog_snapshot' => json_encode(['product' => $product->code, 'net_unit' => $quote['net_unit'], 'seats' => $quote['seats'], 'adults' => $quote['adults'], 'children' => $quote['children']], JSON_UNESCAPED_UNICODE),
            'policies_snapshot' => json_encode((array) (DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund']) ?? []), JSON_UNESCAPED_UNICODE),
            'notes' => trim("Reserva creada desde el portal B2B por {$user->name}.".($reference ? " Referencia de la agencia: {$reference}." : '').(empty($data['notes']) ? '' : ' '.trim((string) $data['notes']))),
            'b2b_terms' => json_encode($terms, JSON_UNESCAPED_UNICODE),
            'created_by' => $user->getKey(),
            'updated_by' => $user->getKey(),
        ]);

        $serviceCodes = $this->createServices($reservationId, $code, $product, $quote, $departureId, $status === 'confirmada', $user->getKey());
        $this->createPassengers($reservationId, $quote, $data['passengers'] ?? [], $user->getKey());
        $this->createReceivable($reservationId, $account, $clientId, $product, $quote, $mode, $today, $user->getKey());
        $this->createCommission($reservationId, $account, $quote, $user->getKey());

        if ($mode === 'credito') {
            $this->chargeCredit($account, $reservationId, $code, $quote, $user->getKey());
        }

        if ($status === 'confirmada') {
            foreach ($serviceCodes as $serviceCode) {
                try {
                    $this->vouchers->issue($serviceCode, $product->main_provider_id, 'Emitido automáticamente al confirmar la reserva B2B.', $user);
                } catch (ApiException) {
                    continue;
                }
            }
        }

        $this->audit->log('Reserva', $code, 'crear_b2b', null, "{$status} · {$account->agency->code} · {$currency} {$quote['net_total']} · {$mode}");

        return $code;
    }

    private function createServices(string $reservationId, string $code, stdClass $product, array $quote, ?string $departureId, bool $confirmed, string $userId): array
    {
        $cost = $this->unitCost($product->id, $quote['currency'], (string) $quote['fx']);
        $item = (object) ['id' => null, 'product_id' => $product->id, 'service_date' => $quote['date'], 'pax' => $quote['seats'], 'qty' => 1, 'unit_cost' => (string) $cost, 'unit_price' => (string) $quote['net_unit']];
        $version = (object) ['discount_pct' => 0, 'currency' => $quote['currency'], 'fx_rate' => $quote['fx']];
        $reference = $departureId ? DB::table('catalog_product_departures')->where('id', $departureId)->value('ref') : null;
        $number = (int) substr($code, -6);
        $codes = [];

        foreach ($this->services->build($item, (string) $version->discount_pct, (string) $version->currency, (string) $version->fx_rate, $departureId, $product->main_provider_id) as $index => $row) {
            $serviceCode = sprintf('RS-%d%02d', $number, $index + 1);
            $serviceId = (string) DB::table('booking_reservation_services')->insertGetId([
                ...$row,
                'reservation_id' => $reservationId,
                'code' => $serviceCode,
                'pax_detail' => json_encode(['adt' => $quote['adults'], 'chd' => $quote['children'], 'inf' => 0]),
                'status' => $confirmed ? 'confirmado' : 'solicitado',
                'confirmation_code' => $confirmed ? $reference : null,
                'confirmed_by_name' => $confirmed ? 'Cupo propio (salida programada)' : null,
                'confirmed_at' => $confirmed ? now() : null,
                'requested_at' => now(),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
            $codes[] = $serviceCode;

            if ($departureId && $index === 0) {
                DB::table('booking_inventory_holds')->insert(['departure_id' => $departureId, 'reservation_id' => $reservationId, 'booking_service_id' => $serviceId, 'pax' => $quote['seats'], 'status' => 'confirmada', 'created_by' => $userId, 'updated_by' => $userId]);
            }
        }

        if ($departureId) {
            $pax = (int) $quote['seats'];
            DB::table('catalog_product_departures')->where('id', $departureId)->update([
                'sold' => DB::raw("sold + {$pax}"),
                'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"),
                'updated_by' => $userId,
            ]);
        }

        return $codes;
    }

    private function createPassengers(string $reservationId, array $quote, array $names, string $userId): void
    {
        $types = [...array_fill(0, $quote['adults'], 'ADT'), ...array_fill(0, $quote['children'], 'CHD')];
        $rows = [];

        foreach ($types as $index => $type) {
            $given = $names[$index] ?? null;
            $name = trim((string) ($given['name'] ?? ''));
            $doc = trim((string) ($given['doc_number'] ?? ''));
            $rows[] = [
                'reservation_id' => $reservationId,
                'seq' => $index + 1,
                'full_name' => $name !== '' ? Str::limit($name, 145) : 'Pasajero '.($index + 1).' (por nominar)',
                'doc_type' => $doc !== '' ? ($given['doc_type'] ?? 'DNI') : null,
                'doc_number' => $doc !== '' ? Str::upper($doc) : null,
                'pax_type' => $type,
                'nationality' => $given['nationality'] ?? null,
                'is_lead' => $index === 0,
                'is_placeholder' => $name === '',
                'pending' => $name === '' || $doc === '',
                'created_by' => $userId,
                'updated_by' => $userId,
            ];
        }

        DB::table('booking_passengers')->insert($rows);
    }

    private function createReceivable(string $reservationId, B2bAccount $account, string $clientId, stdClass $product, array $quote, string $mode, Carbon $today, string $userId): void
    {
        $code = $this->sequences->next('receivable');
        DB::table('fin_receivables')->insert([
            'code' => $code,
            'reservation_id' => $reservationId,
            'client_id' => $account->client->id ?? $clientId,
            'kind' => 'b2b',
            'concept' => Str::limit(($mode === 'credito' ? 'Reserva B2B a crédito '.self::CREDIT_DAYS.' d — ' : 'Prepago B2B — ').$product->name, 250),
            'amount' => $quote['net_total'],
            'currency' => $quote['currency'],
            'fx_rate' => $quote['fx'],
            'due_date' => $today->copy()->addDays($mode === 'credito' ? self::CREDIT_DAYS : self::PREPAY_DAYS)->toDateString(),
            'status' => 'abierta',
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
        $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$quote['currency']} {$quote['net_total']}");
    }

    private function createCommission(string $reservationId, B2bAccount $account, array $quote, string $userId): void
    {
        if (! BigDecimal::of($quote['commission'])->isPositive()) {
            return;
        }

        DB::table('fin_commissions')->insert([
            'code' => $this->sequences->next('commission'),
            'reservation_id' => $reservationId,
            'kind' => 'agencia_b2b',
            'beneficiary_agency_id' => $account->agency->id,
            'rule_id' => DB::table('fin_commission_rules')->where('condition', 'b2b_convenio')->value('id'),
            'rule_description' => "Convenio B2B: {$quote['commission_pct']} % sobre el total neto",
            'base_amount' => $quote['net_total'],
            'pct' => $quote['commission_pct'],
            'amount' => $quote['commission'],
            'currency' => $quote['currency'],
            'fx_rate' => $quote['fx'],
            'status' => 'calculada',
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
    }

    private function chargeCredit(B2bAccount $account, string $reservationId, string $code, array $quote, string $userId): void
    {
        $fx = $quote['currency'] === $quote['credit']['currency'] ? null : (string) $quote['fx'];
        $this->credit->chargeReservation((string) $account->agency->id, $reservationId, $code, (string) $quote['credit']['amount'], (string) $quote['net_total'], (string) $quote['currency'], $fx, $userId);
    }

    private function unitCost(string $productId, string $currency, string $fx): string
    {
        $rate = DB::table('catalog_rates')->where('product_id', $productId)->where('status', 'vigente')->whereIn('segment', ['Adulto', 'Pasajero'])
            ->orderByRaw("case when channel = 'B2B' then 0 else 1 end")->first(['cost', 'currency']);

        if ($rate === null) {
            return '0.00';
        }

        return (string) Decimal::round2(Decimal::convert((string) ($rate->cost ?? '0'), (string) $rate->currency, $currency, number_format((float) $fx, 6, '.', '')));
    }

    private function client(B2bAccount $account, ?array $data): string
    {
        if (empty($data['name'])) {
            return $account->client->id ?? throw ApiException::unprocessable('B2B-BR-17', 'Indica el cliente final de la reserva.');
        }

        $docType = $data['doc_type'] === 'Pasaporte' ? 'PASAPORTE' : $data['doc_type'];
        $docNumber = Str::upper((string) preg_replace('/\s+/', '', (string) $data['doc_number']));
        $existing = DB::table('crm_clients')->whereNull('deleted_at')->where('doc_type', $docType)->where('doc_number', $docNumber)->value('id');

        if ($existing) {
            return (string) $existing;
        }

        $code = $this->sequence->next('crm_clients', 'CLI-');
        $id = (string) DB::table('crm_clients')->insertGetId([
            'code' => $code,
            'kind' => 'persona',
            'name' => trim((string) $data['name']),
            'doc_type' => $docType,
            'doc_number' => $docNumber,
            'email' => isset($data['email']) ? Str::lower(trim((string) $data['email'])) : null,
            'phone' => $data['phone'] ?? null,
            'country' => $data['country'] ?? 'Perú',
            'segment_code' => 'B2B',
            'owner_id' => $this->owner($account),
            'b2b_agency_id' => $account->agency->id,
            'tags' => '{B2B}',
            'created_by' => $account->user->getKey(),
            'updated_by' => $account->user->getKey(),
        ]);
        $this->audit->log('Cliente', $code, 'crear_desde_portal_b2b', after: "{$account->agency->code} · B2B");

        return $id;
    }

    private function owner(B2bAccount $account): string
    {
        $owner = $account->client->owner_id ?? null;

        if ($owner && DB::table('iam_users')->where('id', $owner)->whereNull('deleted_at')->where('status', 'activo')->exists()) {
            return (string) $owner;
        }

        $id = DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('u.client_id')->whereNull('u.agency_id')->where('p.name', 'channels.b2b.manage')
            ->orderBy('u.code')->value('u.id');

        return $id ? (string) $id : throw ApiException::conflict('B2B_OWNER', 'La agencia aún no tiene un responsable del canal B2B.');
    }
}
