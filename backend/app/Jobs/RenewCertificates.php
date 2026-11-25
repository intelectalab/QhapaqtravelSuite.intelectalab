<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Showcase\Actions\ManageSiteBrand;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class RenewCertificates extends TenantJob
{
    use NotifiesStaff;

    protected function run(): string
    {
        $limit = Carbon::now()->addDays(ManageSiteBrand::RENEW_DAYS);
        $due = DB::table('cms_site_domains')->where('status', 'verificado')
            ->where(fn ($query) => $query->where('ssl_status', 'error')->orWhere(fn ($inner) => $inner->where('ssl_status', 'emitido')->where('ssl_expires_at', '<=', $limit)))
            ->orderBy('ssl_expires_at')->get();

        if ($due->isEmpty()) {
            return 'Certificados SSL al día';
        }

        if (! IntegrationReadiness::usable('domains')) {
            return $this->warn('Sin proveedor real de dominios: '.self::plural($due->count(), 'certificado por renovar', 'certificados por renovar').' sin renovar');
        }

        $brand = app(ManageSiteBrand::class);
        $renewed = 0;
        $failed = 0;

        foreach ($due as $domain) {
            if ($brand->certify($domain, 'renovar_ssl')) {
                $renewed++;

                continue;
            }

            $failed++;
            $expires = $domain->ssl_expires_at !== null ? 'Vence el '.Carbon::parse($domain->ssl_expires_at)->format('d/m/Y').'.' : 'El sitio aún no tiene certificado.';

            foreach ($this->managers() as $userId) {
                $this->notifyOnce('dominio.ssl_error', $userId, 'cms_site_domain', (string) $domain->id, "No pudimos renovar el SSL de {$domain->host}",
                    "{$expires} Revisa que el CNAME siga apuntando a KipuControl en Canales › Dominio y SEO; lo volvemos a intentar mañana.", true);
            }
        }

        $summary = self::summary([
            $renewed > 0 ? self::plural($renewed, 'certificado renovado', 'certificados renovados') : null,
            $failed > 0 ? self::plural($failed, 'certificado con error', 'certificados con error') : null,
        ], 'Certificados SSL al día');

        return $failed > 0 ? $this->warn($summary) : $summary;
    }
}
