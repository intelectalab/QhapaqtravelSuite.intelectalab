<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Events\PaymentApplied;
use App\Domain\Finance\Support\GiftCardDirectory;
use App\Domain\Finance\Support\GrowthFeatureGate;
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

final class GiftCards
{
    public const RULE = 'R-GIFT-CARDS';

    public const STATUSES = ['pendiente' => 'Pendiente', 'activa' => 'Activa', 'agotada' => 'Agotada', 'vencida' => 'Vencida', 'anulada' => 'Anulada'];

    public const KINDS = ['emision' => 'Emisión', 'canje' => 'Canje', 'reverso' => 'Reverso', 'ajuste' => 'Ajuste', 'anulacion' => 'Anulación', 'vencimiento' => 'Vencimiento'];

    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly ReceivableLedger $ledger,
        private readonly AuditLogger $audit,
        private readonly CardPayments $cards,
        private readonly MessagingChannel $messaging,
        private readonly GrowthFeatureGate $gate,
        private readonly GiftCardDirectory $directory,
    ) {}

    public static function issueRules(): array
    {
        return [
            'amount' => ['required', 'regex:/^\d{1,8}(\.\d{1,2})?$/'],
            'currency' => ['required', 'in:PEN,USD'],
            'buyer_client_id' => ['nullable', 'string', 'max:40'],
            'recipient_name' => ['nullable', 'string', 'max:160'],
            'recipient_email' => ['nullable', 'email:rfc', 'max:190'],
            'message' => ['nullable', 'string', 'max:500'],
            'deliver_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
        ];
    }

    public static function messages(): array
    {
        return [
            'amount.required' => 'Escribe el monto del vale.',
            'amount.regex' => 'Escribe el monto con hasta dos decimales.',
            'currency.*' => 'Elige la moneda: soles o dólares.',
            'recipient_name.max' => 'El nombre admite hasta 160 caracteres.',
            'recipient_email.*' => 'Escribe un correo válido para el destinatario.',
            'message.max' => 'El mensaje admite hasta 500 caracteres.',
            'deliver_at.date' => 'La fecha de entrega no es válida.',
            'expires_at.date' => 'La fecha de vencimiento no es válida.',
            'redeem_code.*' => 'Escribe el código de canje del vale.',
            'card_token.*' => 'Completa los datos de la tarjeta.',
            'buyer_name.*' => 'Escribe tu nombre.',
            'buyer_email.*' => 'Escribe un correo válido para enviarte el vale.',
        ];
    }

    public function issue(array $data, User $actor): array
    {
        $this->gate->require(self::RULE);
        $amount = $this->amount((string) $data['amount']);
        $expires = $this->expiry($data['expires_at'] ?? null);
        $buyer = null;

        if (! empty($data['buyer_client_id'])) {
            $key = (string) $data['buyer_client_id'];
            $buyer = DB::table('crm_clients')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->value('id') ?? throw ApiException::unprocessable('CLIENT_NOT_FOUND', 'El cliente comprador no existe.');
        }

        return DB::transaction(function () use ($data, $actor, $amount, $expires, $buyer): array {
            [$code, $redeem] = $this->create([
                'initial_amount' => (string) $amount,
                'currency' => $data['currency'],
                'buyer_client_id' => $buyer,
                'recipient_name' => $data['recipient_name'] ?? null,
                'recipient_email' => $data['recipient_email'] ?? null,
                'message' => $data['message'] ?? null,
                'deliver_at' => $data['deliver_at'] ?? null,
                'expires_at' => $expires,
            ], 'Emisión manual', $actor);

            $this->deliver($code, $redeem, $data['recipient_email'] ?? null);
            $this->audit->log('Vale de regalo', $code, 'emitir', after: 'Emisión manual · '.Decimal::display($amount, (string) $data['currency']).' · vence '.$expires);

            return [...($this->directory->find($code) ?? []), 'redeem_code' => $redeem];
        });
    }

    public function purchase(array $data): array
    {
        $this->gate->require(self::RULE);
        $amount = $this->amount((string) $data['amount']);
        $currency = (string) $data['currency'];
        $card = $this->cards->charge('gift_card', 'VALE-'.mb_strtoupper(Str::random(8)), (string) $amount, $currency, (string) $data['buyer_email'], (string) $data['card_token'], null);

        if (! $card['approved']) {
            throw ApiException::unprocessable('PAYMENT_DECLINED', (string) $card['message'], ['code' => $card['code']]);
        }

        return DB::transaction(function () use ($data, $amount, $currency, $card): array {
            $expires = $this->expiry(null);
            [$code, $redeem] = $this->create([
                'initial_amount' => (string) $amount,
                'currency' => $currency,
                'recipient_name' => $data['recipient_name'] ?? $data['buyer_name'],
                'recipient_email' => $data['recipient_email'] ?? $data['buyer_email'],
                'message' => $data['message'] ?? null,
                'expires_at' => $expires,
            ], 'Compra en el sitio · pasarela '.$card['txn'], null);

            $this->deliver($code, $redeem, $data['recipient_email'] ?? $data['buyer_email']);
            $this->audit->log('Vale de regalo', $code, 'emitir', after: 'Compra en el sitio · '.Decimal::display($amount, $currency).' · '.($card['masked'] ?? 'tarjeta'));

            return [
                'code' => $code,
                'redeem_code' => $redeem,
                'amount' => (string) $amount,
                'currency' => $currency,
                'expires_at' => $expires,
                'recipient_name' => $data['recipient_name'] ?? $data['buyer_name'],
                'message' => 'Listo. Enviamos el vale por correo; guarda el código de canje, solo se muestra esta vez.',
            ];
        });
    }

    public function balance(string $redeemCode): array
    {
        $this->expireDue();
        $card = DB::table('fin_gift_cards')->where('redeem_code_hash', self::hash($redeemCode))->first();

        if ($card === null) {
            throw ApiException::notFound('No encontramos un vale con ese código. Revisa que esté bien escrito.');
        }

        return [
            'code' => $card->code,
            'last4' => $card->redeem_code_last4,
            'status' => $card->status,
            'status_label' => self::STATUSES[$card->status],
            'balance' => (string) $card->balance,
            'initial_amount' => (string) $card->initial_amount,
            'currency' => $card->currency,
            'expires_at' => $card->expires_at,
        ];
    }

    public function redeem(string $code, array $data, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($code, $data, $actor): array {
            $card = DB::table('fin_gift_cards')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El vale no existe.');

            if (! hash_equals((string) $card->redeem_code_hash, self::hash((string) $data['redeem_code']))) {
                throw ApiException::unprocessable('GIFT_CARD_CODE_INVALID', 'El código de canje no corresponde a este vale.');
            }

            $today = Carbon::now($this->context->timezone())->toDateString();

            if ($card->status === 'activa' && (string) $card->expires_at < $today) {
                $this->expireCard($card);
                $card->status = 'vencida';
            }

            if ($card->status !== 'activa') {
                throw ApiException::unprocessable('GIFT_CARD_NOT_ACTIVE', 'El vale está '.mb_strtolower(self::STATUSES[$card->status]).' y no se puede canjear.');
            }

            $amount = Decimal::round2((string) $data['amount']);
            $balance = BigDecimal::of((string) $card->balance);

            if (! $amount->isPositive()) {
                throw ApiException::unprocessable('AMOUNT_INVALID', 'El monto a canjear debe ser mayor que cero.');
            }

            if ($amount->isGreaterThan($balance)) {
                throw ApiException::unprocessable('GIFT_CARD_INSUFFICIENT_BALANCE', 'El monto supera el saldo del vale ('.Decimal::display($balance, (string) $card->currency).').', ['balance' => (string) $balance]);
            }

            [$receivable, $reservation] = $this->redeemTarget($data);

            if ($receivable !== null && $receivable->currency !== $card->currency || $receivable === null && $reservation->currency !== $card->currency) {
                throw ApiException::unprocessable('CURRENCY_MISMATCH', 'El vale está en '.$card->currency.' y el cobro en otra moneda. Canjéalo contra una cuota en la misma moneda.');
            }

            if ($receivable !== null) {
                $open = BigDecimal::of((string) $receivable->amount)->minus((string) $receivable->paid_amount);

                if ($amount->isGreaterThan($open)) {
                    throw ApiException::unprocessable('AMOUNT_EXCEEDS_BALANCE', 'El monto supera el saldo de la cuota '.$receivable->code.' ('.Decimal::display($open, (string) $receivable->currency).').');
                }
            }

            $paymentId = (string) Str::uuid7();
            $paymentCode = $this->sequences->next('payment');
            DB::table('fin_payments')->insert([
                'id' => $paymentId,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $paymentCode,
                'reservation_id' => $reservation->id,
                'receivable_id' => $receivable?->id,
                'kind' => 'cobro',
                'source' => 'backoffice',
                'method' => 'vale_regalo',
                'amount' => (string) $amount,
                'currency' => $card->currency,
                'fx_rate' => $receivable->fx_rate ?? $reservation->fx_rate ?? null,
                'paid_on' => $today,
                'reference' => $card->code,
                'note' => 'Canje del vale '.$card->code.' (••••'.$card->redeem_code_last4.').',
                'status' => $receivable !== null ? 'aplicado' : 'confirmado',
                'registered_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);

            if ($receivable !== null) {
                DB::table('fin_payment_applications')->insert(['payment_id' => $paymentId, 'receivable_id' => $receivable->id, 'amount' => (string) $amount, 'applied_at' => now(), 'applied_by' => $actor->getKey()]);
                $this->ledger->recalculate((string) $receivable->id, $actor);
            }

            $after = Decimal::round2($balance->minus($amount));
            DB::table('fin_gift_cards')->where('id', $card->id)->update(['balance' => (string) $after, 'status' => $after->isZero() ? 'agotada' : 'activa', 'updated_by' => $actor->getKey()]);
            $this->movement((string) $card->id, 'canje', $amount->negated(), $after, $reservation->id, $receivable?->id, 'Pago '.$paymentCode, $actor);
            $this->audit->log('Vale de regalo', (string) $card->code, 'canjear', (string) $balance, (string) $after.' · '.$paymentCode.' · '.($receivable->code ?? $reservation->code), actor: $actor);

            if ($receivable !== null) {
                PaymentApplied::dispatch($paymentId, (string) $actor->getKey());
            }

            return [...($this->directory->find((string) $card->code) ?? []), 'payment' => $paymentCode];
        });
    }

    public function void(string $code, ?string $reason, User $actor): array
    {
        $this->gate->require(self::RULE);

        return DB::transaction(function () use ($code, $reason, $actor): array {
            $card = DB::table('fin_gift_cards')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El vale no existe.');

            if (! in_array($card->status, ['pendiente', 'activa'], true)) {
                throw ApiException::conflict('GIFT_CARD_NOT_ACTIVE', 'Solo se anulan vales pendientes o activos. Este vale está '.mb_strtolower(self::STATUSES[$card->status]).'.');
            }

            $redeemed = DB::table('fin_gift_card_movements')->where('gift_card_id', $card->id)->where('kind', 'canje')->exists();
            $balance = BigDecimal::of((string) $card->balance);
            DB::table('fin_gift_cards')->where('id', $card->id)->update(['status' => 'anulada', 'balance' => '0.00', 'updated_by' => $actor->getKey()]);

            if ($balance->isPositive()) {
                $this->movement((string) $card->id, 'anulacion', $balance->negated(), BigDecimal::zero(), null, null, $reason ? mb_substr($reason, 0, 300) : null, $actor);
            }

            $this->audit->log('Vale de regalo', (string) $card->code, 'anular', $card->status.' · saldo '.$balance, 'anulada'.($redeemed ? ' · sin devolución (tuvo canjes)' : ' · saldo devolvible').($reason ? ' · '.$reason : ''), actor: $actor);

            return [...($this->directory->find((string) $card->code) ?? []), 'refundable' => ! $redeemed && $balance->isPositive(), 'refundable_amount' => ! $redeemed ? (string) $balance : '0.00'];
        });
    }

    public function expireDue(): void
    {
        $today = Carbon::now($this->context->timezone())->toDateString();

        foreach (DB::table('fin_gift_cards')->where('status', 'activa')->where('expires_at', '<', $today)->limit(200)->get() as $card) {
            $this->expireCard($card);
        }
    }

    public static function hash(string $redeemCode): string
    {
        return hash('sha256', preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($redeemCode)) ?? '');
    }

    private function expireCard(object $card): void
    {
        $balance = BigDecimal::of((string) $card->balance);
        DB::table('fin_gift_cards')->where('id', $card->id)->update(['status' => 'vencida', 'balance' => '0.00']);

        if ($balance->isPositive()) {
            $this->movement((string) $card->id, 'ajuste', $balance->negated(), BigDecimal::zero(), null, null, 'Vencimiento del vale el '.$card->expires_at, null);
        }
    }

    private function create(array $values, string $note, ?User $actor): array
    {
        $redeem = $this->redeemCode();
        $id = (string) Str::uuid7();
        $code = $this->sequences->next('gift_card');

        DB::table('fin_gift_cards')->insert([
            ...$values,
            'id' => $id,
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'redeem_code_hash' => self::hash($redeem),
            'redeem_code_last4' => mb_substr(str_replace('-', '', $redeem), -4),
            'balance' => $values['initial_amount'],
            'status' => 'activa',
            'created_by' => $actor?->getKey(),
            'updated_by' => $actor?->getKey(),
        ]);
        $this->movement($id, 'emision', BigDecimal::of((string) $values['initial_amount']), BigDecimal::of((string) $values['initial_amount']), null, null, $note, $actor);

        return [$code, $redeem];
    }

    private function deliver(string $code, string $redeem, ?string $email): void
    {
        if ($email === null || $email === '') {
            return;
        }

        $card = DB::table('fin_gift_cards')->where('code', $code)->first(['initial_amount', 'currency', 'recipient_name', 'message', 'expires_at']);
        $this->messaging->send(new OutboundMessage(
            'email',
            $email,
            'Tienes un vale de regalo de '.$this->context->tenant()->commercial_name,
            'Hola '.($card->recipient_name ?? '').', recibiste un vale por '.Decimal::display((string) $card->initial_amount, (string) $card->currency).'. Código de canje: '.$redeem.'. Vence el '.Carbon::parse((string) $card->expires_at)->format('d/m/Y').'.'.($card->message ? ' Mensaje: '.$card->message : ''),
        ));
    }

    private function movement(string $cardId, string $kind, BigDecimal $amount, BigDecimal $after, ?string $reservationId, ?string $receivableId, ?string $note, ?User $actor): void
    {
        DB::table('fin_gift_card_movements')->insert([
            'tenant_id' => $this->context->idOrFail(),
            'gift_card_id' => $cardId,
            'kind' => $kind,
            'amount' => (string) Decimal::round2($amount),
            'balance_after' => (string) Decimal::round2($after),
            'reservation_id' => $reservationId,
            'receivable_id' => $receivableId,
            'note' => $note,
            'created_by' => $actor?->getKey(),
        ]);
    }

    private function redeemTarget(array $data): array
    {
        $key = (string) ($data['receivable_id'] ?? '');

        if ($key !== '') {
            $receivable = DB::table('fin_receivables')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->first();

            if ($receivable === null || in_array($receivable->status, ['pagada', 'cancelada'], true)) {
                throw ApiException::unprocessable('RECEIVABLE_NOT_PAYABLE', 'La cuota elegida no existe o ya no tiene saldo.');
            }

            return [$receivable, DB::table('booking_reservations')->where('id', $receivable->reservation_id)->first(['id', 'code', 'currency', 'fx_rate'])];
        }

        $key = (string) ($data['reservation_id'] ?? '');
        $reservation = $key === '' ? null : DB::table('booking_reservations')->whereNull('deleted_at')->where(Str::isUuid($key) ? 'id' : 'code', $key)->first(['id', 'code', 'currency', 'fx_rate', 'status']);

        if ($reservation === null || in_array($reservation->status, ['cancelada', 'borrador'], true)) {
            throw ApiException::unprocessable('RESERVATION_NOT_PAYABLE', 'Elige una cuota o una reserva vigente para el canje.');
        }

        return [null, $reservation];
    }

    private function amount(string $value): BigDecimal
    {
        $amount = Decimal::round2($value);

        if ($amount->isLessThan('20') || $amount->isGreaterThan('20000')) {
            throw ApiException::unprocessable('GIFT_CARD_AMOUNT_RANGE', 'El vale va de 20 a 20 000 en su moneda.');
        }

        return $amount;
    }

    private function expiry(?string $value): string
    {
        $today = Carbon::now($this->context->timezone())->startOfDay();

        if ($value === null || $value === '') {
            return $today->copy()->addYear()->toDateString();
        }

        $date = Carbon::parse($value, $this->context->timezone())->startOfDay();

        if ($date->lessThanOrEqualTo($today)) {
            throw ApiException::unprocessable('EXPIRY_IN_PAST', 'El vencimiento del vale debe ser una fecha futura.');
        }

        if ($date->greaterThan($today->copy()->addYears(3))) {
            throw ApiException::unprocessable('EXPIRY_TOO_FAR', 'El vale puede durar hasta 3 años.');
        }

        return $date->toDateString();
    }

    private function redeemCode(): string
    {
        $chars = '';

        for ($i = 0; $i < 16; $i++) {
            $chars .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return implode('-', str_split($chars, 4));
    }
}
