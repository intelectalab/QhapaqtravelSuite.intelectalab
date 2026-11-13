<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\FxRate;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class FxProviders
{
    public const STATUS = ['activo' => 'Activo', 'por_validar' => 'Por validar', 'inactivo' => 'Inactivo', 'error' => 'Con error'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly ManageCurrencies $currencies,
    ) {}

    public function list(): array
    {
        $rows = DB::table('fx_rate_providers')->orderByRaw("case status when 'activo' then 0 else 1 end")->orderBy('code')
            ->get(['id', 'code', 'name', 'kind', 'status', 'schedule_cron', 'last_run_at', 'last_error', 'note', 'updated_at']);
        $last = DB::table('fin_fx_rates')->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_date', 'source']);

        return [
            'providers' => $rows->map(fn (object $row): array => [
                'id' => $row->id,
                'code' => $row->code,
                'name' => $row->name,
                'kind' => $row->kind,
                'status' => $row->status,
                'status_label' => self::STATUS[$row->status] ?? $row->status,
                'active' => $row->status === 'activo',
                'schedule_cron' => $row->schedule_cron,
                'last_run_at' => $row->last_run_at,
                'last_error' => $row->last_error,
                'note' => $row->note,
            ])->values()->all(),
            'active' => $rows->firstWhere('status', 'activo')?->code,
            'adapter' => (string) config('integrations.drivers.fx', 'fake'),
            'simulated' => $this->simulated(),
            'last_rate' => $last ? ['date' => $last->rate_date, 'source' => $last->source] : null,
        ];
    }

    public function test(string $code, User $actor): array
    {
        $provider = $this->provider($code);

        if ($provider->status === 'por_validar') {
            [$ok, $result] = [false, 'Proveedor por validar: la prueba no envía credenciales (INT-BR-01).'];
        } else {
            try {
                $check = app(FxRateProvider::class)->healthcheck();
                [$ok, $result] = [$check->ok, $check->ok ? ($this->simulated() ? 'Respuesta correcta del proveedor simulado.' : 'Conexión correcta.') : ($check->message ?? 'El proveedor rechazó la prueba.')];
            } catch (Throwable $e) {
                [$ok, $result] = [false, mb_substr($e->getMessage(), 0, 240)];
            }
        }

        DB::table('fx_rate_providers')->where('id', $provider->id)->update(['last_error' => $ok ? null : $result, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Tipo de cambio', (string) $provider->code, 'probar_conexion', null, ($ok ? 'correcta' : 'fallida').' · '.mb_substr($result, 0, 200));

        return ['code' => $provider->code, 'ok' => $ok, 'result' => $result, 'tested_at' => now()->toIso8601String()];
    }

    public function refresh(User $actor): array
    {
        $provider = DB::table('fx_rate_providers')->where('status', 'activo')->orderBy('code')->first()
            ?? throw ApiException::conflict('FX-04', 'No hay un proveedor de tipo de cambio activo. Activa uno antes de actualizar.');
        $lock = Cache::lock("fx-refresh:{$this->context->idOrFail()}", 120);

        if (! $lock->get()) {
            throw ApiException::conflict('FX-REFRESH-RUNNING', 'Ya hay una actualización del tipo de cambio en curso. Espera un momento.');
        }

        try {
            return $this->pull($provider, $actor);
        } finally {
            $lock->release();
        }
    }

    private function pull(object $provider, User $actor): array
    {
        $today = Carbon::now($this->context->timezone())->toDateString();
        $codes = $this->currencies->all()->filter(fn (object $row): bool => (bool) $row->active && ! (bool) $row->is_base)->map(fn (object $row): string => trim((string) $row->code))->values()->all();

        try {
            $rates = app(FxRateProvider::class)->latest($codes, $today);
        } catch (Throwable $e) {
            DB::table('fx_rate_providers')->where('id', $provider->id)->update(['last_run_at' => now(), 'last_error' => mb_substr($e->getMessage(), 0, 500), 'updated_at' => now()]);

            throw ApiException::conflict('FX-PROVIDER-ERROR', 'El proveedor no respondió; se conserva el último tipo de cambio registrado.');
        }

        $alert = (float) $this->currencies->settings()['alert_pct'];

        return DB::transaction(fn (): array => $this->persist($provider, $rates, $alert, $today, $actor));
    }

    private function persist(object $provider, array $rates, float $alert, string $today, User $actor): array
    {
        $stored = [];

        foreach ($rates as $rate) {
            if ($rate instanceof FxRate) {
                $stored[] = $this->store($provider, $rate, $alert, $actor);
            }
        }

        $alerts = array_values(array_filter($stored, fn (array $row): bool => $row['alert_raised']));
        DB::table('fx_rate_providers')->where('id', $provider->id)->update(['last_run_at' => now(), 'last_error' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Tipo de cambio', (string) $provider->code, 'actualizar_desde_proveedor', null, "{$today} · ".implode(', ', array_map(fn (array $row): string => $row['currency'].' '.$row['rate'], $stored)));

        foreach ($alerts as $row) {
            app(StaffNotices::class)->toRoles(['finance', 'manager'], 'tipo_cambio.variacion', 'Tipo de cambio '.$row['currency'].' con variación de '.$row['daily_change_pct'].' %', 'Nuevo '.$row['rate'].' · anterior '.$row['previous'].' · '.$today, 'fin_fx_rate', null, null, [], (string) $actor->getKey());
        }

        return ['provider' => $provider->code, 'date' => $today, 'rates' => $stored, 'alerts' => count($alerts)];
    }

    private function store(object $provider, FxRate $rate, float $alert, User $actor): array
    {
        $code = strtoupper($rate->currencyCode);
        $previous = DB::table('fin_fx_rates')->where('currency_code', $code)->where('rate_date', '<', $rate->rateDate)->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen');
        $change = $previous !== null && (float) $previous > 0 ? round(((float) $rate->ratePen - (float) $previous) / (float) $previous * 100, 3) : null;
        $raised = $change !== null && abs($change) > $alert;
        $values = [
            'rate_pen' => $rate->ratePen,
            'buy' => $rate->buy,
            'sell' => $rate->sell,
            'previous_rate' => $previous,
            'source' => mb_substr($rate->source ?: (string) $provider->name, 0, 80),
            'effective_at' => now()->format('Y-m-d H:i:s.uP'),
            'daily_change_pct' => $change,
            'alert_raised' => $raised,
            'is_demo' => $this->simulated(),
        ];
        $replaced = DB::table('fin_fx_rates')->where('currency_code', $code)->where('rate_date', $rate->rateDate)->exists();
        DB::table('fin_fx_rates')->insert([...$values, 'id' => (string) Str::uuid7(), 'currency_code' => $code, 'base_currency' => 'PEN', 'rate_date' => $rate->rateDate, 'provider_id' => $provider->id, 'created_by' => $actor->getKey()]);

        return ['currency' => $code, 'rate' => (float) $rate->ratePen, 'previous' => $previous === null ? null : (float) $previous, 'daily_change_pct' => $change, 'alert_raised' => $raised, 'replaced' => $replaced];
    }

    private function provider(string $code): object
    {
        return DB::table('fx_rate_providers')->where(Str::isUuid($code) ? 'id' : 'code', $code)->first() ?? throw ApiException::notFound('El proveedor no existe.');
    }

    private function simulated(): bool
    {
        return (string) config('integrations.drivers.fx', 'fake') === 'fake';
    }
}
