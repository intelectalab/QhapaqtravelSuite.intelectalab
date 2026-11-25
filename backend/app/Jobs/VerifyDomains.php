<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Showcase\Actions\ManageSiteBrand;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class VerifyDomains extends TenantJob
{
    protected function run(): string
    {
        $pending = DB::table('cms_site_domains')->where('status', 'pendiente_dns')->orderBy('created_at')->get();
        $unsigned = DB::table('cms_site_domains')->where('status', 'verificado')->where('ssl_status', 'pendiente')->orderBy('created_at')->get();

        if ($pending->isEmpty() && $unsigned->isEmpty()) {
            return 'Sin dominios por verificar';
        }

        if (! IntegrationReadiness::usable('domains')) {
            return $this->warn('Sin proveedor real de dominios: no se verificó ningún dominio');
        }

        $brand = app(ManageSiteBrand::class);
        $deadline = Carbon::now()->subHours(ManageSiteBrand::DNS_WAIT_HOURS);
        $counts = ['verificado' => 0, 'pendiente_dns' => 0, 'error' => 0, 'sin_ssl' => 0];

        foreach ($pending as $domain) {
            $counts[$brand->recheck($domain, Carbon::parse($domain->created_at)->lessThan($deadline))]++;
        }

        foreach ($unsigned as $domain) {
            $counts[$brand->certify($domain, 'emitir_ssl') ? 'verificado' : 'sin_ssl']++;
        }

        $summary = self::summary([
            $counts['verificado'] > 0 ? self::plural($counts['verificado'], 'dominio con SSL emitido', 'dominios con SSL emitido') : null,
            $counts['pendiente_dns'] > 0 ? self::plural($counts['pendiente_dns'], 'dominio sigue esperando el DNS', 'dominios siguen esperando el DNS') : null,
            $counts['error'] > 0 ? self::plural($counts['error'], 'dominio sin DNS tras '.ManageSiteBrand::DNS_WAIT_HOURS.' h', 'dominios sin DNS tras '.ManageSiteBrand::DNS_WAIT_HOURS.' h') : null,
            $counts['sin_ssl'] > 0 ? self::plural($counts['sin_ssl'], 'dominio verificado sin SSL', 'dominios verificados sin SSL') : null,
        ], 'Sin dominios por verificar');

        return $counts['error'] > 0 || $counts['sin_ssl'] > 0 ? $this->warn($summary) : $summary;
    }
}
