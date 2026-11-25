<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments;

use App\Domain\Integrations\Contracts\PaymentConnector;
use App\Domain\Integrations\Contracts\PaymentGateway;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Showcase\Contracts\GatewayCredentialVault;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AgencyPaymentGateways
{
    private array $resolved = [];

    public function __construct(
        private readonly PaymentGateway $fallback,
        private readonly GatewayCredentialVault $vault,
        private readonly TenantContext $context,
    ) {}

    public function gateway(?string $currency = null): PaymentGateway
    {
        $account = $this->account($currency);

        return $account === null ? $this->fallback : $this->connector($account);
    }

    public function account(?string $currency = null): ?GatewayAccount
    {
        $tenant = $this->context->id();

        if ($tenant === null) {
            return null;
        }

        $key = $tenant.'|'.($currency ?? '*');

        if (! array_key_exists($key, $this->resolved)) {
            $row = DB::table('fin_gateway_accounts')->where('status', 'activa')->whereIn('provider', ConnectorCatalog::providers())->whereNotNull('credentials_ref')
                ->when($currency !== null, fn ($q) => $q->orderByRaw('case when currency = ? then 0 else 1 end', [$currency]))
                ->orderByDesc('updated_at')->first();
            $this->resolved[$key] = $row === null ? null : $this->fromRow($row);
        }

        return $this->resolved[$key];
    }

    public function find(string $id): ?GatewayAccount
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        $row = DB::table('fin_gateway_accounts')->where('id', $id)->whereIn('provider', ConnectorCatalog::providers())->first();

        return $row === null ? null : $this->fromRow($row);
    }

    public function connector(GatewayAccount $account): PaymentConnector
    {
        $class = ConnectorCatalog::CONNECTORS[$account->provider]['class'];

        return new $class($account);
    }

    public function name(?string $currency = null): string
    {
        return $this->account($currency)->provider ?? (string) config('integrations.drivers.payments', 'fake');
    }

    public function connected(): bool
    {
        return $this->account() !== null;
    }

    public function forget(): void
    {
        $this->resolved = [];
    }

    public static function webhookUrl(string $provider, string $accountId, string $subdomain): string
    {
        return route('webhooks.payments', ['gateway' => $provider, 'agencia' => $subdomain, 'cuenta' => $accountId]);
    }

    private function fromRow(object $row): ?GatewayAccount
    {
        $secrets = $row->credentials_ref === null ? null : $this->vault->get((string) $row->credentials_ref);

        if ($secrets === null) {
            return null;
        }

        $subdomain = (string) DB::connection('pgsql_platform')->table('tenants')->where('id', $row->tenant_id)->value('subdomain');

        return new GatewayAccount((string) $row->id, (string) $row->tenant_id, (string) $row->provider, (string) $row->mode, (string) $row->currency, $secrets, $subdomain === '' ? null : self::webhookUrl((string) $row->provider, (string) $row->id, $subdomain));
    }
}
