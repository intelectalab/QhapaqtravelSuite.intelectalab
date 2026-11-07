<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Platform\Support\TenantNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ExpireApiKeys extends PlatformJob
{
    public const QUEUE = 'low';

    protected function run(): string
    {
        $db = DB::connection('pgsql_platform');
        $today = $this->today()->toDateString();
        $expiring = $db->table('integration_api_keys')->where('status', 'active')->whereNotNull('expires_at')->get(['id', 'tenant_id', 'code', 'name', 'expires_at']);
        $expired = 0;
        $warned = 0;

        foreach ($expiring as $key) {
            if ($key->expires_at < $today) {
                $db->table('integration_api_keys')->where('id', $key->id)->where('status', 'active')->update(['status' => 'expired']);
                $expired++;
                app(TenantNotice::class)->send((string) $key->tenant_id, "La llave de API {$key->name} venció", "La llave {$key->code} venció el ".Carbon::parse($key->expires_at)->format('d/m/Y').' y ya no autoriza llamadas. Crea una nueva desde API y webhooks.');

                continue;
            }

            if ((int) Carbon::parse($today)->diffInDays(Carbon::parse($key->expires_at), false) === app(PlatformSettings::class)->notices()['api_key_days']) {
                $warned += app(TenantNotice::class)->send((string) $key->tenant_id, "La llave de API {$key->name} vence pronto", "La llave {$key->code} vence el ".Carbon::parse($key->expires_at)->format('d/m/Y').'. Crea una nueva y actualiza tus integraciones antes de esa fecha.') ? 1 : 0;
            }
        }

        $text = self::summary([
            $expired ? self::plural($expired, 'llave vencida', 'llaves vencidas') : null,
            $warned ? self::plural($warned, 'aviso de vencimiento', 'avisos de vencimiento') : null,
        ], 'Sin llaves por vencer');

        return $expired > 0 ? $this->warn($text) : $text;
    }
}
