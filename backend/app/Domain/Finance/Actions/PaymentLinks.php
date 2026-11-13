<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Support\DerivedTokens;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Finance\Support\PaymentLinkDirectory;
use App\Domain\Finance\Support\ReceivableLedger;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Site\Support\CardPayments;
use Brick\Math\BigDecimal;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaymentLinks
{
    public const RULE = 'R-PAY-LINKS';

    public const METHODS = ['card' => 'Tarjeta', 'yape' => 'Yape', 'plin' => 'Plin', 'mercadopago' => 'Mercado Pago', 'transfer' => 'Transferencia', 'pagoefectivo' => 'PagoEfectivo', 'paypal' => 'PayPal'];

    public const STATUSES = ['activo' => 'Activo', 'pagado' => 'Pagado', 'vencido' => 'Vencido', 'anulado' => 'Anulado'];

    private const DEFAULT_HOURS = 72;

    private const MAX_DAYS = 30;

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly ReceivableLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly CardPayments $cards,
        private readonly MessagingChannel $messaging,
        private readonly GrowthFeatureGate $gate,
        private readonly PaymentLinkDirectory $directory,
    ) {}

    public static function rules(): array
    {
        return [
            'receivable_id' => ['nullable', 'string', 'max:40', 'required_without:reservation_id'],
            'reservation_id' => ['nullable', 'string', 'max:40', 'required_without:receivable_id'],
            'gift_card_id' => ['prohibited'],
            'amount' => ['nullable', 'regex:/^\d{1,12}(\.\d{1,2})?$/'],
            'methods' => ['required', 'array', 'min:1'],
            'methods.*' => ['string', 'distinct', 'in:'.implode(',', array_keys(self::METHODS))],
            'installments_max' => ['nullable', 'integer', 'between:1,24'],
            'expires_at' => ['nullable', 'date'],
        ];
    }

    public static function messages(): array
    {
        return [
            'receivable_id.required_without' => 'Elige la cuota o la reserva que se cobra con el link.',
            'reservation_id.required_without' => 'Elige la cuota o la reserva que se cobra con el link.',
            'gift_card_id.prohibited' => 'Los vales de regalo se venden desde el sitio con pago en línea; el link de pago cobra cuotas o reservas.',
            'amount.regex' => 'Escribe el monto con hasta dos decimales.',
            'methods.required' => 'Elige al menos un medio de pago.',
            'methods.min' => 'Elige al menos un medio de pago.',
            'methods.*.in' => 'Ese medio de pago no está disponible.',
            'methods.*.distinct' => 'Cada medio de pago va una sola vez.',
            'installments_max.between' => 'Las cuotas van de 1 a 24.',
            'expires_at.date' => 'La fecha de vencimiento no es válida.',
        ];
    }

    public function create(array $data, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($data, $actor): array {
            $target = $this->target($data, $actor);
            $amount = isset($data['amount']) ? Decimal::round2((string) $data['amount']) : $target['open'];

            if (! $amount->isPositive()) {
                throw ApiException::unprocessable('NOTHING_TO_COLLECT', 'No hay saldo pendiente por cobrar en '.$target['label'].'.');
            }

            if ($amount->isGreaterThan($target['open'])) {
                throw ApiException::unprocessable('AMOUNT_EXCEEDS_BALANCE', 'El monto supera el saldo pendiente de '.$target['label'].' ('.Decimal::display($target['open'], $target['currency']).').', ['open' => (string) $target['open']]);
            }

            $methods = array_values(array_unique($data['methods']));
            $installments = in_array('card', $methods, true) ? (int) ($data['installments_max'] ?? 1) : 1;
            $expires = $this->expiry($data['expires_at'] ?? null);
            $id = (string) Str::uuid7();
            $token = DerivedTokens::for('payment-link', $id);
            $code = $this->sequences->next('payment_link');

            DB::table('fin_payment_links')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'reservation_id' => $target['reservation_id'],
                'receivable_id' => $target['receivable_id'],
                'amount' => (string) $amount,
                'currency' => $target['currency'],
                'methods' => '{'.implode(',', $methods).'}',
                'installments_max' => $installments,
                'provider' => $this->cards->gatewayName(),
                'url' => DerivedTokens::siteUrl('pagar/'.$token),
                'token_hash' => DerivedTokens::hash($token),
                'expires_at' => $expires,
                'status' => 'activo',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);

            $this->audit->log('Link de pago', $code, 'crear', after: $target['label'].' · '.Decimal::display($amount, $target['currency']).' · '.implode(', ', array_map(fn (string $method) => self::METHODS[$method], $methods)));

            return $this->directory->find($code, $actor) ?? throw ApiException::notFound('El link de pago no existe.');
        });
    }

    public function send(string $code, array $data, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($code, $data, $actor): array {
            $link = $this->open($code, $actor);

            if ($link->status !== 'activo') {
                throw ApiException::conflict('PAYMENT_LINK_NOT_ACTIVE', 'Solo se envían links activos. Este link está '.mb_strtolower(self::STATUSES[$link->status]).'.');
            }

            $via = (string) $data['via'];
            $client = $this->client($link);
            $to = trim((string) ($data['to'] ?? '')) ?: ($via === 'email' ? (string) ($client->email ?? '') : (string) ($client->phone ?? ''));

            if ($via !== 'copia') {
                if ($to === '' || ($via === 'email' && ! filter_var($to, FILTER_VALIDATE_EMAIL))) {
                    throw ApiException::unprocessable('RECIPIENT_REQUIRED', $via === 'email' ? 'El cliente no tiene correo registrado. Escribe el correo de destino.' : 'El cliente no tiene teléfono registrado. Escribe el número de WhatsApp.');
                }

                $amount = Decimal::display((string) $link->amount, (string) $link->currency);
                $result = $this->messaging->send(new OutboundMessage(
                    $via,
                    $to,
                    $via === 'email' ? 'Link de pago '.$link->code.' · '.$this->context->tenant()->commercial_name : null,
                    $via === 'email' ? 'Hola '.($client->name ?? '').', puedes pagar '.$amount.' en este enlace seguro: '.$link->url.' . Vence el '.Carbon::parse((string) $link->expires_at)->timezone($this->context->timezone())->format('d/m/Y H:i').'.' : null,
                    $via === 'whatsapp' ? 'link_pago' : null,
                    $via === 'whatsapp' ? ['cliente' => (string) ($client->name ?? ''), 'monto' => $amount, 'enlace' => (string) $link->url] : [],
                ));

                if (! $result->ok) {
                    throw ApiException::unprocessable('MESSAGE_NOT_SENT', $result->message ?? 'No pudimos enviar el mensaje. Intenta de nuevo o copia el enlace.');
                }
            }

            DB::table('fin_payment_links')->where('id', $link->id)->update(['sent_via' => $via, 'updated_by' => $actor->getKey()]);
            $this->audit->log('Link de pago', (string) $link->code, 'enviar', after: $via === 'copia' ? 'Enlace copiado' : $via.' · ***'.mb_substr($to, -4));

            return $this->directory->find((string) $link->code, $actor) ?? throw ApiException::notFound('El link de pago no existe.');
        });
    }

    public function cancel(string $code, ?string $reason, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($code, $reason, $actor): array {
            $link = $this->open($code, $actor);

            if ($link->status !== 'activo') {
                throw ApiException::conflict('PAYMENT_LINK_NOT_ACTIVE', 'Solo se anulan links activos. Este link está '.mb_strtolower(self::STATUSES[$link->status]).'.');
            }

            DB::table('fin_payment_links')->where('id', $link->id)->update(['status' => 'anulado', 'updated_by' => $actor->getKey()]);
            $this->audit->log('Link de pago', (string) $link->code, 'anular', 'activo', 'anulado'.($reason ? ' · '.$reason : ''));

            return $this->directory->find((string) $link->code, $actor) ?? throw ApiException::notFound('El link de pago no existe.');
        });
    }

    public function publicView(string $token): array
    {
        $this->expireDue();
        $link = $this->byToken($token);
        $reservation = $this->reservation($link);
        $receivable = $link->receivable_id ? DB::table('fin_receivables')->where('id', $link->receivable_id)->first(['code', 'concept']) : null;
        $tenant = $this->context->tenant();

        return [
            'code' => $link->code,
            'status' => $link->status,
            'status_label' => self::STATUSES[$link->status],
            'agency' => (string) $tenant->commercial_name,
            'concept' => $receivable?->concept ? (string) $receivable->concept : 'Pago de tu reserva',
            'reservation' => ['code' => $reservation->code, 'title' => $reservation->title, 'travel_from' => $reservation->travel_from],
            'client_name' => $this->client($link)->name ?? null,
            'amount' => (string) $link->amount,
            'currency' => (string) $link->currency,
            'methods' => array_map(fn (string $method) => ['key' => $method, 'label' => self::METHODS[$method]], $this->methods($link)),
            'installments_max' => (int) $link->installments_max,
            'expires_at' => Carbon::parse((string) $link->expires_at)->toIso8601String(),
            'paid_at' => $link->paid_at ? Carbon::parse((string) $link->paid_at)->toIso8601String() : null,
            'gateway' => $this->cards->gatewayName(),
        ];
    }

    public function checkout(string $token, array $data): array
    {
        $this->expireDue();
        $link = $this->byToken($token);

        if ($link->status !== 'activo') {
            throw ApiException::conflict('PAYMENT_LINK_NOT_ACTIVE', match ($link->status) {
                'pagado' => 'Este link ya fue pagado. Gracias.',
                'vencido' => 'Este link venció. Pide a la agencia uno nuevo.',
                default => 'Este link fue anulado por la agencia.',
            });
        }

        $method = (string) $data['method'];

        if (! in_array($method, $this->methods($link), true)) {
            throw ApiException::unprocessable('PAYMENT_METHOD_NOT_ALLOWED', 'Ese medio de pago no está habilitado para este link.');
        }

        if ($method === 'card' && (int) ($data['installments'] ?? 1) > (int) $link->installments_max) {
            throw ApiException::unprocessable('INSTALLMENTS_NOT_ALLOWED', 'Este link permite hasta '.$link->installments_max.' cuotas.');
        }

        $this->ensureBalance($link);
        $email = (string) ($data['email'] ?? ($this->client($link)->email ?? ''));

        if ($method !== 'card') {
            $session = $this->cards->openSession('payment_link', (string) $link->code, (string) $link->amount, (string) $link->currency, $email, (string) $link->url);
            DB::table('fin_payment_links')->where('id', $link->id)->update(['provider_ref' => $session['gateway_session']]);

            return [
                'result' => 'pendiente',
                'method' => $method,
                'gateway_session' => $session['gateway_session'],
                'expires_at' => $session['expires_at'],
                'message' => 'Completa el pago con '.self::METHODS[$method].'. Confirmaremos el link apenas la pasarela nos avise.',
            ];
        }

        $card = $this->cards->charge('payment_link', (string) $link->code, (string) $link->amount, (string) $link->currency, $email, (string) $data['card_token'], null);

        if (! $card['approved']) {
            $this->audit->log('Link de pago', (string) $link->code, 'pago_rechazado', after: 'Tarjeta '.($card['masked'] ?? '').' · código '.$card['code']);

            throw ApiException::unprocessable('PAYMENT_DECLINED', (string) $card['message'], ['code' => $card['code']]);
        }

        return $this->settle((string) $link->code, 'card', (string) $card['txn'], null);
    }

    public function settle(string $code, string $method, ?string $txn, ?User $actor): array
    {
        return DB::transaction(function () use ($code, $method, $txn, $actor): array {
            $link = DB::table('fin_payment_links')->where('code', $code)->lockForUpdate()->first();

            if ($link === null) {
                throw ApiException::notFound('El link de pago no existe.');
            }

            if ($link->status === 'pagado') {
                $payment = DB::table('fin_payments')->where('id', $link->payment_id)->value('code');

                return ['result' => 'aprobado', 'duplicate' => true, 'code' => $link->code, 'payment' => $payment, 'amount' => (string) $link->amount, 'currency' => (string) $link->currency, 'message' => 'Este link ya estaba pagado. No se registró un cobro adicional.'];
            }

            if ($link->status !== 'activo') {
                throw ApiException::conflict('PAYMENT_LINK_NOT_ACTIVE', 'El link no está activo; el cobro no se registró.');
            }

            $this->ensureBalance($link);
            $reservation = $this->reservation($link);
            $receivable = $link->receivable_id ? DB::table('fin_receivables')->where('id', $link->receivable_id)->first() : null;
            $paymentId = (string) Str::uuid7();
            $paymentCode = $this->sequences->next('payment');
            $applied = $receivable !== null;

            DB::table('fin_payments')->insert([
                'id' => $paymentId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $paymentCode,
                'reservation_id' => $reservation->id,
                'receivable_id' => $receivable?->id,
                'kind' => 'cobro',
                'source' => 'ecommerce',
                'method' => $method === 'card' ? 'tarjeta_e_commerce' : $method,
                'amount' => (string) $link->amount,
                'currency' => $link->currency,
                'fx_rate' => $receivable->fx_rate ?? $reservation->fx_rate ?? null,
                'paid_on' => Carbon::now($this->context->timezone())->toDateString(),
                'reference' => $txn,
                'note' => 'Cobro con el link '.$link->code.' ('.self::METHODS[$method].').',
                'status' => $applied ? 'aplicado' : 'confirmado',
                'registered_by' => $actor?->getKey(),
            ]);

            if ($applied) {
                DB::table('fin_payment_applications')->insert(['payment_id' => $paymentId, 'receivable_id' => $receivable->id, 'amount' => (string) $link->amount, 'applied_at' => now()]);
                $this->ledger->recalculate((string) $receivable->id, $actor);
            }

            DB::table('fin_payment_links')->where('id', $link->id)->update(['status' => 'pagado', 'paid_at' => now(), 'payment_id' => $paymentId, 'provider_ref' => $txn ?? $link->provider_ref]);
            $this->audit->log('Link de pago', (string) $link->code, 'pagar', 'activo', 'pagado · '.$paymentCode.' · '.Decimal::display((string) $link->amount, (string) $link->currency), actor: $actor);

            if ($applied) {
                PaymentApplied::dispatch($paymentId, $actor?->getKey());
            }

            return ['result' => 'aprobado', 'duplicate' => false, 'code' => $link->code, 'payment' => $paymentCode, 'amount' => (string) $link->amount, 'currency' => (string) $link->currency, 'message' => 'Pago aprobado. Gracias, la agencia ya recibió la confirmación.'];
        });
    }

    public function expireDue(): int
    {
        return DB::table('fin_payment_links')->where('status', 'activo')->where('expires_at', '<', now())->update(['status' => 'vencido']);
    }

    private function target(array $data, User $actor): array
    {
        $key = (string) ($data['receivable_id'] ?? '');

        if ($key !== '') {
            $receivable = DB::table('fin_receivables')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->first();

            if ($receivable === null) {
                throw ApiException::unprocessable('RECEIVABLE_NOT_FOUND', 'La cuota elegida no existe.');
            }

            if (in_array($receivable->status, ['pagada', 'cancelada'], true)) {
                throw ApiException::unprocessable('RECEIVABLE_CLOSED', 'La cuota '.$receivable->code.' ya está '.$receivable->status.'.');
            }

            $this->assertPortfolio($receivable->reservation_id, $actor);
            $pending = (string) (DB::table('fin_payments')->where('receivable_id', $receivable->id)->where('status', 'pendiente')->sum('amount') ?: '0');
            $open = BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount)->minus($pending);

            return ['reservation_id' => $receivable->reservation_id, 'receivable_id' => $receivable->id, 'currency' => (string) $receivable->currency, 'open' => Decimal::round2($open->isPositive() ? $open : BigDecimal::zero()), 'label' => 'la cuota '.$receivable->code];
        }

        $key = (string) $data['reservation_id'];
        $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->first();

        if ($reservation === null) {
            throw ApiException::unprocessable('RESERVATION_NOT_FOUND', 'La reserva elegida no existe.');
        }

        if (in_array($reservation->status, ['cancelada', 'borrador'], true)) {
            throw ApiException::unprocessable('RESERVATION_NOT_PAYABLE', 'La reserva '.$reservation->code.' está '.$reservation->status.' y no admite cobros.');
        }

        $this->assertPortfolio((string) $reservation->id, $actor);

        return ['reservation_id' => $reservation->id, 'receivable_id' => null, 'currency' => (string) $reservation->currency, 'open' => $this->reservationOpen($reservation), 'label' => 'la reserva '.$reservation->code];
    }

    private function reservationOpen(object $reservation): BigDecimal
    {
        $paid = (string) (DB::table('fin_payments')->where('reservation_id', $reservation->id)->where('kind', 'cobro')->whereIn('status', ['pendiente', 'confirmado', 'aplicado'])->sum('amount') ?: '0');
        $open = BigDecimal::of((string) $reservation->total_amount)->minus($paid);

        return Decimal::round2($open->isPositive() ? $open : BigDecimal::zero());
    }

    private function ensureBalance(object $link): void
    {
        if ($link->receivable_id) {
            $receivable = DB::table('fin_receivables')->where('id', $link->receivable_id)->first();
            $pending = (string) (DB::table('fin_payments')->where('receivable_id', $link->receivable_id)->where('status', 'pendiente')->sum('amount') ?: '0');
            $open = BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount)->minus($pending);
        } else {
            $open = $this->reservationOpen($this->reservation($link));
        }

        if (BigDecimal::of((string) $link->amount)->isGreaterThan($open)) {
            throw ApiException::unprocessable('AMOUNT_EXCEEDS_BALANCE', 'El monto del link supera el saldo pendiente. Pide a la agencia un link actualizado.');
        }
    }

    private function assertPortfolio(string $reservationId, User $actor): void
    {
        if (! Portfolio::ownOnly($actor)) {
            return;
        }

        $owner = DB::table('booking_reservations')->where('id', $reservationId)->value('owner_id');

        if ((string) $owner !== (string) $actor->getKey()) {
            throw ApiException::forbidden('SEC-BR-09', 'Esta reserva pertenece a la cartera de otro asesor. Pide a tu gerente que te la reasigne.', ['crm.records.reassign']);
        }
    }

    private function expiry(?string $value): string
    {
        $now = Carbon::now();

        if ($value === null || $value === '') {
            return $now->copy()->addHours(self::DEFAULT_HOURS)->toIso8601String();
        }

        $at = Carbon::parse($value);

        if ($at->lessThanOrEqualTo($now)) {
            throw ApiException::unprocessable('EXPIRY_IN_PAST', 'El vencimiento debe ser una fecha futura.');
        }

        if ($at->greaterThan($now->copy()->addDays(self::MAX_DAYS))) {
            throw ApiException::unprocessable('EXPIRY_TOO_FAR', 'El link puede durar hasta '.self::MAX_DAYS.' días.');
        }

        return $at->utc()->toIso8601String();
    }

    private function open(string $code, User $actor): object
    {
        $link = DB::table('fin_payment_links')->where('code', $code)->lockForUpdate()->first();

        if ($link === null) {
            throw ApiException::notFound('El link de pago no existe.');
        }

        $this->assertPortfolio((string) ($link->reservation_id ?? DB::table('fin_receivables')->where('id', $link->receivable_id)->value('reservation_id')), $actor);

        return $link;
    }

    private function byToken(string $token): object
    {
        $link = strlen($token) >= 20 && strlen($token) <= 64 ? DB::table('fin_payment_links')->where('token_hash', DerivedTokens::hash($token))->first() : null;

        return $link ?? throw ApiException::notFound('Este link de pago no existe o ya no está disponible.');
    }

    private function reservation(object $link): object
    {
        $id = $link->reservation_id ?? DB::table('fin_receivables')->where('id', $link->receivable_id)->value('reservation_id');

        return DB::table('booking_reservations')->where('id', $id)->first(['id', 'code', 'title', 'travel_from', 'client_id', 'currency', 'fx_rate', 'total_amount', 'owner_id']);
    }

    private function client(object $link): object
    {
        $reservation = $this->reservation($link);

        return DB::table('crm_clients')->where('id', $reservation->client_id)->first(['name', 'email', 'phone']) ?? (object) [];
    }

    private function methods(object $link): array
    {
        return array_values(array_filter(explode(',', trim((string) $link->methods, '{}'))));
    }
}
