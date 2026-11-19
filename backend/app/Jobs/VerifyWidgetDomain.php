<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Channels\Support\WidgetDomainVerifier;
use Illuminate\Support\Facades\DB;

final class VerifyWidgetDomain extends TenantJob
{
    public const QUEUE = 'low';

    protected function run(): string
    {
        $verifier = app(WidgetDomainVerifier::class);
        $pending = DB::table('channel_widget_domains')->where('status', 'pendiente')
            ->whereRaw('updated_at >= now() - make_interval(hours => ?)', [WidgetDomainVerifier::RETRY_HOURS])
            ->orderBy('created_at')->get(['id', 'domain', 'verify_token']);

        if ($pending->isEmpty()) {
            return 'Sin dominios del widget por verificar';
        }

        $verified = $pending->filter(fn (object $row): bool => $verifier->check($row, null, 'job'))->count();
        $waiting = $pending->count() - $verified;

        return self::summary([
            $verified > 0 ? self::plural($verified, 'dominio verificado', 'dominios verificados') : null,
            $waiting > 0 ? self::plural($waiting, 'dominio sigue sin registro TXT', 'dominios siguen sin registro TXT') : null,
        ], 'Sin dominios del widget por verificar');
    }
}
