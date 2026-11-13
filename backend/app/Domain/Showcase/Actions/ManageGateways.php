<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Contracts\GatewayCredentialVault;
use App\Domain\Showcase\Contracts\GatewaySettlementSource;
use App\Domain\Showcase\Support\GatewayFees;
use Brick\Math\RoundingMode;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageGateways
{
    public const PROVIDERS = ['pasarela_local' => 'Pasarela local (tarjetas)', 'paypal' => 'PayPal', 'yape' => 'Yape', 'plin' => 'Plin', 'otro' => 'Otra pasarela'];

    public const ADDONS = ['paypal' => 'paypal_gateway'];

    public function __construct(
        private readonly GatewayCredentialVault $vault,
        private readonly GatewaySettlementSource $settlements,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function create(array $data, User $actor): string
    {
        $addon = self::ADDONS[$data['provider']] ?? null;

        if ($addon !== null && ! $this->hasAddon($addon)) {
            throw ApiException::unprocessable('VT-ADDON', 'Para cobrar con PayPal contrata el add-on «Cobros con PayPal» desde Suscripción y uso.');
        }

        $id = (string) Str::uuid7();
        $credentials = $this->storeCredentials($id, $data['credentials'] ?? null);
        $this->assertProduction($data['status'] ?? 'pendiente', $data['mode'] ?? 'sandbox', $credentials);

        try {
            DB::table('fin_gateway_accounts')->insert([
                'id' => $id,
                'provider' => $data['provider'],
                'label' => trim((string) ($data['label'] ?? self::PROVIDERS[$data['provider']])),
                'account_ref' => trim((string) $data['account_ref']),
                'status' => $data['status'] ?? 'pendiente',
                'mode' => $data['mode'] ?? 'sandbox',
                'currency' => $data['currency'],
                'fee_currency' => $data['fee_currency'] ?? $data['currency'],
                'credentials_ref' => $credentials,
                'addon_required' => $addon,
                'created_by' => $actor->getKey(),
                ...$this->terms($data),
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                throw ApiException::conflict('VT-GATEWAY', 'Esa cuenta ya está conectada para esta pasarela.');
            }

            throw $e;
        }

        $this->audit->log('Pasarela', $id, 'conectar', null, self::PROVIDERS[$data['provider']].' · '.$data['account_ref'].' · '.$this->termsLabel($data).($credentials ? ' · credenciales en el vault' : ''));

        return $id;
    }

    public function update(string $id, array $data): void
    {
        $account = $this->find($id);
        $credentials = array_key_exists('credentials', $data) && $data['credentials'] ? $this->storeCredentials($account->id, $data['credentials']) : $account->credentials_ref;
        $status = $data['status'] ?? $account->status;
        $mode = $data['mode'] ?? $account->mode;
        $this->assertProduction($status, $mode, $credentials);
        $merged = [
            'fee_pct' => $data['fee_pct'] ?? $account->fee_pct,
            'fee_fixed' => $data['fee_fixed'] ?? $account->fee_fixed,
            'fx_spread_pct' => $data['fx_spread_pct'] ?? $account->fx_spread_pct,
            'tax_on_fee' => $data['tax_on_fee'] ?? $account->tax_on_fee,
            'settle_days' => $data['settle_days'] ?? $account->settle_days,
            'pass_fee_to_customer' => $data['pass_fee_to_customer'] ?? $account->pass_fee_to_customer,
        ];

        DB::table('fin_gateway_accounts')->where('id', $account->id)->update([
            ...$this->terms($merged),
            'label' => trim((string) ($data['label'] ?? $account->label)),
            'account_ref' => trim((string) ($data['account_ref'] ?? $account->account_ref)),
            'status' => $status,
            'mode' => $mode,
            'credentials_ref' => $credentials,
            'updated_at' => now(),
        ]);
        $this->audit->log('Pasarela', $account->id, 'configurar', "{$account->status} · ".$this->termsLabel((array) $account), "{$status} · ".$this->termsLabel($merged).($credentials !== $account->credentials_ref ? ' · credenciales renovadas' : ''));
    }

    public function import(array $data): array
    {
        $account = $this->find((string) $data['gateway']);
        $lines = $data['lines'] ?? null;

        if ($lines === null) {
            $pending = DB::table('fin_payment_fees')->where('gateway_account_id', $account->id)->where('status', 'estimado')->get(['payment_id', 'fee', 'fee_tax', 'fx_spread', 'created_at'])
                ->map(fn (object $row) => (array) $row)->all();
            $lines = array_map(fn (array $line) => [...$line, 'payment' => null], $this->settlements->settlement($account, $pending));
        }

        $summary = ['settled' => 0, 'adjusted' => 0, 'created' => 0, 'unchanged' => 0];

        foreach ($lines as $line) {
            $summary[$this->apply($account, $line)]++;
        }

        $this->audit->log('Pasarela', $account->id, 'importar_liquidacion', null, "{$summary['settled']} liquidados · {$summary['adjusted']} ajustados · {$summary['created']} nuevos");

        return $summary;
    }

    private function apply(object $account, array $line): string
    {
        $payment = isset($line['payment_id'])
            ? DB::table('fin_payments')->where('id', $line['payment_id'])->first(['id', 'code', 'amount', 'currency'])
            : DB::table('fin_payments')->where('code', $line['payment'])->first(['id', 'code', 'amount', 'currency']);

        if ($payment === null) {
            throw ApiException::unprocessable('VT-08', 'El cobro '.($line['payment'] ?? '').' no existe en KipuControl.', ['field' => 'lines']);
        }

        $existing = DB::table('fin_payment_fees')->where('payment_id', $payment->id)->first();
        $gross = Decimal::money($line['gross'] ?? $existing->gross ?? $payment->amount);
        $totals = GatewayFees::totals($gross, Decimal::money($line['fee']), Decimal::money($line['fee_tax'] ?? 0), Decimal::money($line['fx_spread'] ?? 0));

        if (Decimal::of($totals['net'])->isNegative()) {
            throw ApiException::unprocessable('VT-08', "La comisión del cobro {$payment->code} supera el monto cobrado.", ['field' => 'lines']);
        }

        $settled = $line['settled_on'] ?? Carbon::today('America/Lima')->toDateString();
        $values = [...$totals, 'external_ref' => $line['external_ref'] ?? null, 'settled_on' => $settled, 'updated_at' => now()];

        if ($existing === null) {
            DB::table('fin_payment_fees')->insert(['id' => (string) Str::uuid7(), 'payment_id' => $payment->id, 'gateway_account_id' => $account->id, 'currency' => $payment->currency, 'status' => 'liquidado', 'passed_to_customer' => (bool) $account->pass_fee_to_customer, 'created_at' => now(), ...$values]);

            return 'created';
        }

        if ($existing->status === 'estimado') {
            DB::table('fin_payment_fees')->where('id', $existing->id)->update([...$values, 'status' => 'liquidado']);

            return 'settled';
        }

        if ((string) $existing->fee === $totals['fee'] && (string) $existing->fee_tax === $totals['fee_tax'] && (string) $existing->fx_spread === $totals['fx_spread']) {
            return 'unchanged';
        }

        DB::table('fin_payment_fees')->where('id', $existing->id)->update([...$values, 'status' => 'ajustado']);

        return 'adjusted';
    }

    private function find(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La pasarela no existe.');
        }

        return DB::table('fin_gateway_accounts')->where('id', $id)->first() ?? throw ApiException::notFound('La pasarela no existe.');
    }

    private function storeCredentials(string $id, ?array $credentials): ?string
    {
        $secrets = array_filter((array) $credentials, fn ($v) => is_string($v) && $v !== '');

        if ($secrets === []) {
            return null;
        }

        $reference = 'vault://gateways/'.$this->context->idOrFail().'/'.$id.'/'.now()->format('YmdHis');
        $this->vault->put($reference, $secrets);

        return $reference;
    }

    private function assertProduction(string $status, string $mode, ?string $credentials): void
    {
        if ($status === 'activa' && $mode === 'produccion' && $credentials === null) {
            throw ApiException::unprocessable('VT-10', 'Para activar la pasarela en producción registra sus credenciales. Se guardan cifradas y nunca se muestran.', ['field' => 'credentials']);
        }
    }

    private function terms(array $data): array
    {
        return [
            'fee_pct' => (string) Decimal::of($data['fee_pct'] ?? 0)->toScale(2, RoundingMode::HALF_UP),
            'fee_fixed' => (string) Decimal::money($data['fee_fixed'] ?? 0),
            'fx_spread_pct' => (string) Decimal::of($data['fx_spread_pct'] ?? 0)->toScale(2, RoundingMode::HALF_UP),
            'tax_on_fee' => (bool) ($data['tax_on_fee'] ?? false),
            'settle_days' => (int) ($data['settle_days'] ?? 0),
            'pass_fee_to_customer' => (bool) ($data['pass_fee_to_customer'] ?? false),
        ];
    }

    private function termsLabel(array $data): string
    {
        return ($data['fee_pct'] ?? 0).' % + '.($data['fee_fixed'] ?? 0).(! empty($data['tax_on_fee']) ? ' + IGV' : '').(! empty($data['pass_fee_to_customer']) ? ' · trasladada al cliente' : '');
    }

    private function hasAddon(string $addon): bool
    {
        $tenantId = $this->context->idOrFail();
        $db = DB::connection('pgsql_platform');

        if ($db->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $tenantId)->value('p.code') === 'enterprise') {
            return true;
        }

        return $db->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')
            ->where('s.tenant_id', $tenantId)->where('s.status', '<>', 'canceled')->where('i.addon_code', $addon)
            ->where(fn ($q) => $q->whereNull('i.ends_at')->orWhere('i.ends_at', '>', now()))->exists();
    }
}
