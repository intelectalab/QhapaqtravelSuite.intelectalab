<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Platform\Support\OseCatalog;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class AgencyIntegrations
{
    public function __construct(
        private readonly AgencyMailbox $mailbox,
        private readonly WhatsappAccounts $whatsapp,
        private readonly OseCatalog $ose,
        private readonly TenantContext $context,
    ) {}

    public function items(): array
    {
        return array_map(fn (string $key): array => $this->item($key), array_keys(IntegrationCatalog::AGENCY));
    }

    public function item(string $key): array
    {
        $row = IntegrationCatalog::AGENCY[$key];
        [$status, $detail] = $this->state($key);
        $real = IntegrationReadiness::real($key);
        $enforced = IntegrationReadiness::enforced();
        $simulated = $enforced && ! ($status === 'conectado' && $real) && IntegrationReadiness::simulationAllowed($key);

        return [
            'key' => $key,
            'label' => $row['label'],
            'description' => $row['description'],
            'status' => $status,
            'detail' => $simulated ? IntegrationCatalog::TRIAL_SIMULATION[$key] : ($detail ?? ($status === 'conectado' ? null : $row['missing'])),
            'usable' => ! $enforced || ($status === 'conectado' && $real) || $simulated,
            'href' => $row['href'],
            'cta' => $status === 'conectado' ? 'Ver conexión' : $row['cta'],
        ];
    }

    public function usable(string $key): bool
    {
        return $this->item($key)['usable'];
    }

    public function assertReady(string $key): void
    {
        $item = $this->item($key);

        if (! $item['usable']) {
            throw IntegrationReadiness::exception($key, $item['status'] === 'conectado' ? IntegrationCatalog::missing($key) : (string) $item['detail']);
        }
    }

    private function state(string $key): array
    {
        return match ($key) {
            'email' => [$this->mailbox->active() ? 'conectado' : 'sin_configurar', null],
            'whatsapp' => [$this->whatsapp->connected() !== null ? 'conectado' : 'sin_configurar', null],
            'ose' => $this->oseState(),
            'payments' => [DB::table('fin_gateway_accounts')->where('status', 'activa')->whereNotNull('credentials_ref')->exists() ? 'conectado' : 'sin_configurar', null],
            default => ['sin_configurar', null],
        };
    }

    private function oseState(): array
    {
        $status = $this->ose->status($this->ose->tenant($this->context->idOrFail()));

        return match ($status['step']) {
            'conectado', 'adaptador_pendiente' => ['conectado', $status['step'] === 'conectado' ? null : $status['message']],
            'sin_ose', 'fuera_de_catalogo' => ['sin_configurar', null],
            default => ['en_proceso', (string) $status['message']],
        };
    }
}
