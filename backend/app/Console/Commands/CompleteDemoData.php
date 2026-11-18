<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Quotes\Actions\QuoteAccessTokens;
use App\Domain\Shared\Tenancy\TenantContext;
use Database\Seeders\Modules\ChannelsB2bSeeder;
use Database\Seeders\Modules\ChannelsCmsSeeder;
use Database\Seeders\Modules\FinanceInvoicesSeeder;
use Database\Seeders\Modules\PlatformBillingSeeder;
use Database\Support\KitSeeds;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Spatie\Permission\PermissionRegistrar;

final class CompleteDemoData extends Command
{
    protected $signature = 'demo:completar {--simular : Muestra lo que haría y deshace todo al final}';

    protected $description = 'Completa los datos de demostración que faltan sin borrar ni cambiar lo que ya existe';

    private const KIT_TODAY = '2026-09-29';

    public function handle(TenantContext $context): int
    {
        DB::setDefaultConnection('pgsql_owner');
        $tenant = Tenant::query()->where('code', 'TNT-0001')->first();

        if ($tenant === null) {
            $this->error('No existe la agencia de demostración TNT-0001.');

            return self::FAILURE;
        }

        $context->set($tenant);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());
        $shift = $this->shift();
        $this->line("Desfase de fechas de la demo: {$shift} días.");

        try {
            DB::transaction(function () use ($tenant, $shift): void {
                $tenants = (new PlatformBillingSeeder($tenant))->useShift($shift)->completeTenants();
                $this->line('Suscripciones, facturas y consumo completados: '.($tenants === [] ? 'ninguna agencia' : implode(', ', $tenants)));
                $this->line('Movimientos de crédito B2B agregados: '.(new ChannelsB2bSeeder($tenant))->useShift($shift)->completeCredit());
                $this->line('Envíos al OSE agregados: '.(new FinanceInvoicesSeeder($tenant))->useShift($shift)->completeFiscalEvents());
                $this->line('Servicios futuros corregidos: '.$this->services());
                $this->line('Enlaces de cotización creados: '.$this->quoteLinks($tenant));
                $this->line('Plazos de contenidos actualizados: '.(new ChannelsCmsSeeder($tenant))->useShift($shift)->completeDeadlines());

                if ($this->option('simular')) {
                    throw new RuntimeException('simulacion');
                }
            });
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() !== 'simulacion') {
                throw $exception;
            }

            $this->warn('Simulación: no se guardó nada.');
            $context->clear();

            return self::SUCCESS;
        }

        Entitlements::flush();
        $context->clear();
        $this->info('Datos de demostración completos.');

        return self::SUCCESS;
    }

    private function shift(): int
    {
        $date = DB::table('booking_reservation_services')->where('code', 'RS-35016')->value('service_date');

        return $date
            ? (int) Carbon::parse('2026-10-11')->diffInDays(Carbon::parse((string) $date), false)
            : (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today('America/Lima'), false);
    }

    private function services(): int
    {
        $codes = collect(KitSeeds::read('reservations'))->flatMap(fn (array $reservation): array => $reservation['services'] ?? [])
            ->filter(fn (array $service): bool => $service['status'] === 'confirmado' && ($service['confirmationCode'] ?? '') === '')->pluck('id')->all();

        return DB::table('booking_reservation_services')->whereIn('code', $codes)->where('status', 'completado')->whereNull('confirmation_code')
            ->where('service_date', '>=', Carbon::today('America/Lima')->toDateString())
            ->update(['status' => 'confirmado', 'confirmation_code' => 'Compra directa']);
    }

    private function quoteLinks(Tenant $tenant): int
    {
        $codes = collect(KitSeeds::read('quotes'))->pluck('id')->all();
        $tokens = app(QuoteAccessTokens::class);
        $quotes = DB::table('quote_quotes as q')->whereNull('q.deleted_at')->whereIn('q.code', $codes)->whereNotIn('q.status', ['borrador', 'convertida', 'rechazada', 'cancelada'])
            ->whereExists(fn ($query) => $query->from('quote_sends as s')->whereColumn('s.quote_id', 'q.id'))
            ->whereNotExists(fn ($query) => $query->from('quote_access_tokens as a')->whereColumn('a.quote_id', 'q.id')->whereNull('a.revoked_at'))
            ->get(['q.id', 'q.owner_id', 'q.valid_until']);

        foreach ($quotes as $quote) {
            $sent = DB::table('quote_sends')->where('quote_id', $quote->id)->orderByDesc('sent_at')->first(['sent_at', 'sent_by']);
            $id = (string) Str::uuid7();
            DB::table('quote_access_tokens')->insert([
                'id' => $id,
                'tenant_id' => $tenant->getKey(),
                'quote_id' => $quote->id,
                'token_hash' => QuoteAccessTokens::hash($tokens->plain($id, (string) $quote->id)),
                'expires_at' => $quote->valid_until,
                'created_by' => $sent->sent_by ?? $quote->owner_id,
                'created_at' => $sent->sent_at ?? now(),
            ]);
        }

        return $quotes->count();
    }
}
