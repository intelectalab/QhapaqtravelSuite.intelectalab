<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\FxRateProvider;
use App\Domain\Integrations\Data\FxRate;
use App\Domain\Integrations\Support\FxAdapters;
use App\Domain\Platform\Support\FxProviderCatalog;
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
    public const STATUS = ['activo' => 'En uso', 'disponible' => 'Validado', 'por_validar' => 'Por validar', 'inactivo' => 'Inactivo', 'error' => 'Con error'];

    private const COLUMNS = ['id', 'code', 'name', 'kind', 'status', 'schedule_cron', 'last_run_at', 'last_error', 'note', 'updated_at'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly ManageCurrencies $currencies,
        private readonly FxProviderCatalog $catalog,
        private readonly FxAdapters $adapters,
        private readonly TenantSettings $settings,
    ) {}

    public function list(): array
    {
        $rows = DB::table('fx_rate_providers')->orderBy('code')->get(self::COLUMNS)->keyBy('code');
        $active = $rows->firstWhere('status', 'activo')?->code;
        $catalog = $this->catalog->all();
        $platformCodes = array_column($catalog, 'code');
        $last = DB::table('fin_fx_rates')->orderByDesc('rate_date')->orderByDesc('effective_at')->first(['rate_date', 'source']);
        $providers = collect($catalog)->map(function (array $provider) use ($rows, $active): array {
            $row = $rows->get($provider['code']);
            $validated = $provider['status'] === 'validado';
            $status = $active === $provider['code'] ? ($validated ? 'activo' : 'error') : ($validated ? 'disponible' : 'por_validar');

            return [
                'id' => $row?->id,
                'code' => $provider['code'],
                'name' => $provider['name'],
                'kind' => $this->catalog->kind($provider),
                'status' => $status,
                'status_label' => $status === 'error' ? 'Ya no está validado' : self::STATUS[$status],
                'active' => $active === $provider['code'],
                'selectable' => $validated,
                'platform' => true,
                'schedule_cron' => $row?->schedule_cron,
                'last_run_at' => $row?->last_run_at,
                'last_error' => $row?->last_error,
                'note' => $provider['note'],
            ];
        });
        $legacy = $rows->reject(fn (object $row): bool => in_array($row->code, $platformCodes, true))->map(fn (object $row): array => [
            'id' => $row->id,
            'code' => $row->code,
            'name' => $row->name,
            'kind' => $row->kind,
            'status' => $row->status,
            'status_label' => self::STATUS[$row->status] ?? $row->status,
            'active' => $row->status === 'activo',
            'selectable' => false,
            'platform' => false,
            'schedule_cron' => $row->schedule_cron,
            'last_run_at' => $row->last_run_at,
            'last_error' => $row->last_error,
            'note' => $row->note,
        ]);

        return [
            'providers' => $providers->concat($legacy->values())->sortBy(fn (array $row): int => $row['active'] ? 0 : ($row['selectable'] ? 1 : 2))->values()->all(),
            'active' => $active,
            'manual_always' => true,
            'adapter' => (string) config('integrations.drivers.fx', 'fake'),
            'simulated' => $this->simulated(),
            'last_rate' => $last ? ['date' => $last->rate_date, 'source' => $last->source] : null,
        ];
    }

    public function select(?string $code, User $actor): array
    {
        DB::transaction(function () use ($code, $actor): void {
            $current = DB::table('fx_rate_providers')->where('status', 'activo')->orderBy('code')->first(['id', 'code']);

            if ($code === null) {
                if ($current === null) {
                    throw ApiException::unprocessable('CFG-BR-01', 'Ya trabajas solo con carga manual.');
                }

                DB::table('fx_rate_providers')->where('status', 'activo')->update(['status' => 'inactivo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $this->remember(null, $actor);
                $this->audit->log('Tipo de cambio', (string) $current->code, 'elegir_proveedor', (string) $current->code, 'solo carga manual');

                return;
            }

            $provider = $this->catalog->find($code) ?? throw ApiException::notFound('El proveedor no existe.');

            if ($provider['status'] !== 'validado') {
                throw ApiException::unprocessable('FX-05', 'Este proveedor aún no está validado por la plataforma. Elige uno validado o registra el tipo de cambio a mano.');
            }

            if ($current?->code === $provider['code']) {
                throw ApiException::unprocessable('CFG-BR-01', 'Ese proveedor ya está en uso.');
            }

            DB::table('fx_rate_providers')->where('status', 'activo')->update(['status' => 'inactivo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $values = ['name' => mb_substr($provider['name'], 0, 120), 'kind' => $this->catalog->kind($provider), 'status' => 'activo', 'note' => $provider['note'], 'updated_by' => $actor->getKey(), 'updated_at' => now()];
            $id = DB::table('fx_rate_providers')->where('code', $provider['code'])->value('id');

            if ($id === null) {
                $id = (string) Str::uuid7();
                DB::table('fx_rate_providers')->insert([...$values, 'id' => $id, 'code' => $provider['code'], 'created_by' => $actor->getKey()]);
            } else {
                DB::table('fx_rate_providers')->where('id', $id)->update($values);
            }

            $this->remember((string) $id, $actor);
            $this->audit->log('Tipo de cambio', $provider['code'], 'elegir_proveedor', $current->code ?? 'solo carga manual', $provider['code']);
        });

        return $this->list();
    }

    public function test(string $code, User $actor): array
    {
        $platform = Str::isUuid($code) ? null : $this->catalog->find($code);
        $row = DB::table('fx_rate_providers')->where(Str::isUuid($code) ? 'id' : 'code', $platform['code'] ?? $code)->first();

        if ($platform === null && $row === null) {
            throw ApiException::notFound('El proveedor no existe.');
        }

        $platform ??= $this->catalog->find((string) $row->code);
        $pending = $platform !== null ? $platform['status'] !== 'validado' : $row?->status === 'por_validar';

        if ($pending) {
            [$ok, $result] = [false, 'Proveedor por validar: la prueba no envía credenciales (INT-BR-01).'];
        } else {
            try {
                $check = ($platform !== null ? $this->adapters->for($platform) : app(FxRateProvider::class))->healthcheck();
                [$ok, $result] = [$check->ok, $check->ok ? ($this->simulated() ? 'Respuesta correcta del proveedor simulado.' : 'Conexión correcta.') : ($check->message ?? 'El proveedor rechazó la prueba.')];
            } catch (Throwable $e) {
                [$ok, $result] = [false, mb_substr($e->getMessage(), 0, 240)];
            }
        }

        $providerCode = (string) ($platform['code'] ?? $row?->code);

        if ($row !== null) {
            DB::table('fx_rate_providers')->where('id', $row->id)->update(['last_error' => $ok ? null : $result, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        }

        $this->audit->log('Tipo de cambio', $providerCode, 'probar_conexion', null, ($ok ? 'correcta' : 'fallida').' · '.mb_substr($result, 0, 200));

        return ['code' => $providerCode, 'ok' => $ok, 'result' => $result, 'tested_at' => now()->toIso8601String()];
    }

    public function refresh(User $actor): array
    {
        $provider = DB::table('fx_rate_providers')->where('status', 'activo')->orderBy('code')->first()
            ?? throw ApiException::conflict('FX-04', 'No hay un proveedor de tipo de cambio elegido. Elige uno validado o registra el tipo de cambio a mano.');
        $adapter = $this->adapter($provider);
        $lock = Cache::lock("fx-refresh:{$this->context->idOrFail()}", 120);

        if (! $lock->get()) {
            throw ApiException::conflict('FX-REFRESH-RUNNING', 'Ya hay una actualización del tipo de cambio en curso. Espera un momento.');
        }

        try {
            return $this->pull($provider, $adapter, $actor);
        } finally {
            $lock->release();
        }
    }

    private function adapter(object $provider): FxRateProvider
    {
        $platform = $this->catalog->find((string) $provider->code);

        if ($platform === null) {
            return app(FxRateProvider::class);
        }

        if ($platform['status'] !== 'validado') {
            throw ApiException::conflict('FX-05', 'El proveedor elegido ya no está validado por la plataforma. Elige otro o registra el tipo de cambio a mano.');
        }

        return $this->adapters->for($platform);
    }

    private function remember(?string $providerId, User $actor): void
    {
        $values = $this->settings->section('ecommerce');
        $this->settings->save('ecommerce', [...$values, 'rate_provider_id' => $providerId], $actor);
    }

    private function pull(object $provider, FxRateProvider $adapter, User $actor): array
    {
        $today = Carbon::now($this->context->timezone())->toDateString();
        $codes = $this->currencies->all()->filter(fn (object $row): bool => (bool) $row->active && ! (bool) $row->is_base)->map(fn (object $row): string => trim((string) $row->code))->values()->all();

        try {
            $rates = $adapter->latest($codes, $today);
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

    private function simulated(): bool
    {
        return (string) config('integrations.drivers.fx', 'fake') === 'fake';
    }
}
