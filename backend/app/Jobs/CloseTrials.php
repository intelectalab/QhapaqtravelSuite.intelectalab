<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Actions\ChangeTenantStatus;
use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Platform\Actions\ManageTrial;
use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Platform\Support\ReadOnlyWindow;
use App\Domain\Platform\Support\TenantNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CloseTrials extends PlatformJob
{
    public const QUEUE = 'default';

    protected function run(): string
    {
        $db = DB::connection('pgsql_platform');
        $today = Carbon::parse($this->today()->toDateString(), 'America/Lima');
        $trials = $db->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->where('s.status', 'trialing')->orderBy('s.trial_ends_at')
            ->get(['s.id', 's.tenant_id', 's.trial_ends_at', 't.code']);
        $count = ['notices' => 0, 'converted' => 0, 'readonly' => 0, 'suspended' => 0, 'failed' => 0];

        foreach ($trials as $trial) {
            $ends = Carbon::parse($trial->trial_ends_at, 'America/Lima');
            $left = (int) $today->diffInDays($ends, false);

            if ($left >= 0) {
                if (in_array($left, app(PlatformSettings::class)->notices()['trial_days'], true)) {
                    $card = $this->hasCard($trial->tenant_id);
                    $count['notices'] += app(TenantNotice::class)->send((string) $trial->tenant_id, $left === 1 ? 'Tu prueba termina mañana' : "Tu prueba termina en {$left} días",
                        "Tu periodo de prueba termina el {$ends->format('d/m/Y')}. ".($card ? 'Ese día activaremos tu plan y lo cobraremos con la tarjeta registrada.' : 'Registra una tarjeta para seguir usando la plataforma sin interrupciones; sin ella, la cuenta quedará en solo lectura por '.ReadOnlyWindow::TRIAL_DAYS.' días.')) ? 1 : 0;
                }

                continue;
            }

            if ($this->hasCard($trial->tenant_id)) {
                $invoice = app(ManageTrial::class)->convert((string) $trial->code, null);
                $charge = $db->transaction(fn (): array => app(CollectInvoice::class)->collect($invoice['id']));
                $count['converted']++;
                $count['failed'] += $charge['result'] === 'succeeded' ? 0 : 1;

                continue;
            }

            $db->transaction(function () use ($db, $trial): void {
                $db->table('subscriptions')->where('id', $trial->id)->where('status', 'trialing')->update(['status' => 'suspended', 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
                app(PlatformSession::class)->log('Tenant', (string) $trial->code, 'cerrar_trial', 'prueba', 'solo lectura '.ReadOnlyWindow::TRIAL_DAYS.' días · sin tarjeta');
            });
            app(TenantNotice::class)->send((string) $trial->tenant_id, 'Tu prueba terminó', 'Tu periodo de prueba terminó y la cuenta quedó en solo lectura por '.ReadOnlyWindow::TRIAL_DAYS.' días porque no tiene un medio de pago registrado. Puedes consultar y exportar tus datos; registra una tarjeta en Suscripción para activar tu plan.');
            $count['readonly']++;
        }

        $readOnly = $db->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->where('s.status', 'suspended')->whereNotNull('s.trial_ends_at')->where('t.status', '<>', 'suspendido')
            ->get(['s.id', 's.tenant_id', 's.status', 's.trial_ends_at', 's.current_period_end', 't.code']);

        foreach ($readOnly as $trial) {
            if ($this->hasCard($trial->tenant_id)) {
                $invoice = app(ManageTrial::class)->convert((string) $trial->code, null);
                $charge = $db->transaction(fn (): array => app(CollectInvoice::class)->collect($invoice['id']));
                $count['converted']++;
                $count['failed'] += $charge['result'] === 'succeeded' ? 0 : 1;

                continue;
            }

            if (! ReadOnlyWindow::expired($trial, $today)) {
                continue;
            }

            $db->transaction(function () use ($trial, $db): void {
                $db->table('subscriptions')->where('id', $trial->id)->where('status', 'suspended')->update(['status' => 'canceled', 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
                $tenant = Tenant::on('pgsql_platform')->find($trial->tenant_id);

                if ($tenant !== null && ! $tenant->isSuspended()) {
                    app(ChangeTenantStatus::class)->suspend($tenant, 'La prueba terminó sin un medio de pago y venció el periodo de solo lectura.');
                }

                app(PlatformSession::class)->log('Tenant', (string) $trial->code, 'cerrar_trial', 'solo lectura', 'suscripción cancelada · agencia suspendida · sin tarjeta');
            });
            app(TenantNotice::class)->send((string) $trial->tenant_id, 'Tu cuenta quedó suspendida', 'Terminó el periodo de solo lectura de tu prueba sin un medio de pago registrado. Tus datos se conservan: escríbenos para activar tu plan.');
            $count['suspended']++;
        }

        $text = self::summary([
            $count['notices'] ? self::plural($count['notices'], 'aviso de fin de prueba', 'avisos de fin de prueba') : null,
            $count['converted'] ? self::plural($count['converted'], 'prueba convertida a plan pagado', 'pruebas convertidas a plan pagado') : null,
            $count['failed'] ? self::plural($count['failed'], 'primer cobro rechazado', 'primeros cobros rechazados') : null,
            $count['readonly'] ? self::plural($count['readonly'], 'prueba en solo lectura sin tarjeta', 'pruebas en solo lectura sin tarjeta') : null,
            $count['suspended'] ? self::plural($count['suspended'], 'agencia suspendida sin tarjeta', 'agencias suspendidas sin tarjeta') : null,
        ], 'Sin pruebas por avisar ni por cerrar');

        return $count['failed'] + $count['suspended'] + $count['readonly'] > 0 ? $this->warn($text) : $text;
    }

    private function hasCard(string $tenantId): bool
    {
        return DB::connection('pgsql_platform')->table('payment_methods')->where('tenant_id', $tenantId)->where('status', 'active')->exists();
    }
}
