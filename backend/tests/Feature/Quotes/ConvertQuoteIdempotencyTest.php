<?php

use App\Domain\Booking\Actions\ConvertQuoteToReservation;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\DatabaseTransactionsManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Tests\Support\CommittedSnapshot;
use Tests\Support\TestDatabase;

beforeEach(function () {
    $this->quote = approvedQuote('COT-2026-00188');
    actingAsSeed('U03');
});

function convert(object $quote, string $key, ?int $lock = null, array $body = [])
{
    return test()->postJson("/api/v1/quotes/{$quote->code}/convert", $body, critical($lock ?? (int) $quote->lock_version, $key));
}

function reservationsOf(object $quote): int
{
    return withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('quote_id', $quote->id)->count());
}

it('T-R01: convierte en 201 con reserva confirmada, cotización convertida y oportunidad ganada', function () {
    $code = convert($this->quote, idem('conv'))->assertCreated()->json('data.code');
    $quote = rowOf('quote_quotes', $this->quote->code);
    $reservation = rowOf('booking_reservations', (string) $code);

    expect($code)->toMatch('/^RES-2026-\d{6}$/')
        ->and($reservation->status)->toBe('confirmada')
        ->and($reservation->quote_id)->toBe($this->quote->id)
        ->and($quote->status)->toBe('convertida')
        ->and($quote->reservation_id)->toBe($reservation->id)
        ->and($this->quote->opportunity_id)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_opportunities')->where('id', $this->quote->opportunity_id)->value('stage')))->toBe('ganada');
});

it('T-R01: la respuesta de la conversión es la BookingReservation del contrato', function () {
    $data = convert($this->quote, idem('conv'))->assertCreated()->json('data');
    $reservation = rowOf('booking_reservations', (string) $data['code']);

    expect($data['id'] ?? null)->toBe($reservation->id)
        ->and($data['status'] ?? null)->toBe('confirmada')
        ->and($data['quote_id'] ?? null)->toBe($this->quote->id)
        ->and($data['total_amount'] ?? null)->toBe(bcadd((string) $reservation->total_amount, '0', 2));
});

it('T-R01: los servicios de la reserva suman el total vendido de la versión aprobada', function () {
    $code = convert($this->quote, idem('conv'))->assertCreated()->json('data.code');
    $reservation = rowOf('booking_reservations', $code);
    $version = withinTenant(tenantA(), fn () => DB::table('quote_versions')->where('id', $this->quote->current_version_id)->first());
    $services = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->get());

    expect($services)->not->toBeEmpty()
        ->and(number_format((float) $services->sum('price_amount'), 2, '.', ''))->toBe(number_format((float) $version->sale_total, 2, '.', ''))
        ->and(number_format((float) $services->sum('cost_amount'), 2, '.', ''))->toBe(number_format((float) $version->cost_total, 2, '.', ''));
});

it('T-R01: CxC 40/60 con vencimientos exactos (04 §4.3 paso 14)', function () {
    $code = convert($this->quote, idem('conv'))->assertCreated()->json('data.code');
    $reservation = rowOf('booking_reservations', $code);
    $today = CarbonImmutable::parse(BUSINESS_TODAY);
    $travel = CarbonImmutable::parse($this->quote->travel_from);
    $firstDue = $today->addDays(3)->min($travel->max($today))->toDateString();
    $secondDue = $travel->subDays(15)->max($today)->toDateString();

    $receivables = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $reservation->id)->orderBy('due_date')->get());

    expect($receivables)->toHaveCount(2)
        ->and((string) $receivables[0]->due_date)->toStartWith($firstDue)
        ->and((string) $receivables[1]->due_date)->toStartWith($secondDue)
        ->and(bcadd((string) $receivables[0]->amount, (string) $receivables[1]->amount, 2))->toBe(bcadd((string) $reservation->total_amount, '0', 2))
        ->and(bcadd((string) $receivables[0]->amount, '0', 2))->toBe(number_format(round((float) $reservation->total_amount * 0.40, 2), 2, '.', ''));
});

it('T-R02: misma Idempotency-Key devuelve la misma respuesta y una sola reserva', function () {
    $key = idem('conv');
    $first = convert($this->quote, $key)->assertCreated();
    $second = convert($this->quote, $key);

    expect($second->status())->toBe(201)
        ->and($second->json('data.code'))->toBe($first->json('data.code'))
        ->and($second->headers->get('Idempotent-Replayed'))->toBe('true')
        ->and(reservationsOf($this->quote))->toBe(1);
});

it('X-13: misma Idempotency-Key con cuerpo distinto responde 422', function () {
    $key = idem('conv');
    convert($this->quote, $key)->assertCreated();

    convert($this->quote, $key, body: ['notes' => 'otro cuerpo'])->assertUnprocessable();
});

it('T-R02: key distinta sobre una cotización ya convertida responde 200 con la reserva existente y audita convertir_idempotente', function () {
    $first = convert($this->quote, idem('conv'))->assertCreated();
    $second = convert(rowOf('quote_quotes', $this->quote->code), idem('conv2'));

    $second->assertOk();
    expect($second->json('data.code'))->toBe($first->json('data.code'))
        ->and(reservationsOf($this->quote))->toBe(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('action', 'convertir_idempotente')->where('entity_id', $this->quote->code)->exists()))->toBeTrue();
});

it('sin Idempotency-Key responde 422 IDEMPOTENCY_KEY_REQUIRED y no crea nada', function () {
    $this->postJson("/api/v1/quotes/{$this->quote->code}/convert", [], ['If-Match' => (string) $this->quote->lock_version])
        ->assertStatus(422)
        ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REQUIRED');

    expect(reservationsOf($this->quote))->toBe(0);
});
it('sin If-Match responde 428 o 409 y no crea nada (CONVENCIONES §3)', function () {
    $response = $this->postJson("/api/v1/quotes/{$this->quote->code}/convert", [], ['Idempotency-Key' => idem('conv')]);

    expect($response->status())->toBeIn([409, 428])
        ->and(reservationsOf($this->quote))->toBe(0);
});

it('T-R02: 10 solicitudes concurrentes con keys distintas crean una sola reserva', function () {
    if (! function_exists('pcntl_fork')) {
        $this->markTestSkipped('Esta prueba necesita la extensión pcntl para lanzar procesos reales.');
    }

    $code = 'COT-2026-00190';
    $actor = seedUser('U01');
    $tenant = tenantA();
    $results = [];
    $restored = [];

    $ran = TestDatabase::exclusively(180, function () use ($code, $actor, $tenant, &$results, &$restored) {
        $snapshot = CommittedSnapshot::take();

        try {
            $owner = DB::connection('pgsql_owner');
            $quote = $owner->table('quote_quotes')->where('tenant_id', $tenant->getKey())->where('code', $code)->first();
            $owner->table('quote_versions')->where('id', $quote->current_version_id)->update(['status' => 'aprobada']);
            $owner->table('quote_quotes')->where('id', $quote->id)->update(['status' => 'aprobada', 'approved_at' => now(), 'approved_by_name' => 'Cliente de prueba', 'approval_channel' => 'Email']);
            $lock = (int) $owner->table('quote_quotes')->where('id', $quote->id)->value('lock_version');

            $results = concurrentConversions((string) $quote->id, $lock, $actor, $tenant, 10);
            $results['reservations'] = $owner->table('booking_reservations')->where('quote_id', $quote->id)->pluck('code')->all();
            $results['quote'] = $owner->table('quote_quotes')->where('id', $quote->id)->first(['status', 'reservation_id']);
        } finally {
            $restored = $snapshot->restore();
        }
    });

    if (! $ran) {
        $this->markTestSkipped('Otras pruebas siguieron usando kipucontrol_test durante 3 minutos; esta prueba necesita la base sola para comprometer datos.');
    }

    $workers = collect($results['workers']);
    $created = $workers->where('created', true);
    $codes = $workers->pluck('code')->filter()->unique();

    expect($workers)->toHaveCount(10)
        ->and($workers->pluck('crash')->filter()->all())->toBe([])
        ->and($results['reservations'])->toHaveCount(1)
        ->and($created)->toHaveCount(1)
        ->and($codes->values()->all())->toBe($results['reservations'])
        ->and($workers->whereNull('code')->pluck('rule')->unique()->diff(['STALE_VERSION', 'QUOTE_CONVERSION_IN_PROGRESS'])->all())->toBe([])
        ->and($results['quote']->status)->toBe('convertida')
        ->and($restored)->toContain('booking_reservations', 'quote_quotes')
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereIn('code', $results['reservations'])->exists()))->toBeFalse();
})->group('base-sola');

function concurrentConversions(string $quoteId, int $lockVersion, User $actor, Tenant $tenant, int $count): array
{
    $dir = sys_get_temp_dir().'/kipu-tr02-'.getmypid().'-'.bin2hex(random_bytes(4));
    mkdir($dir);
    $go = "{$dir}/go";
    $pids = [];

    foreach (range(1, $count) as $worker) {
        $pid = pcntl_fork();

        if ($pid === -1) {
            throw new RuntimeException('No se pudo lanzar el proceso de conversión.');
        }

        if ($pid === 0) {
            runConversionWorker($quoteId, $worker % 2 === 0 ? null : $lockVersion, $actor, $tenant, $go, "{$dir}/{$worker}.json");
        }

        $pids[$worker] = $pid;
    }

    touch($go);
    $deadline = microtime(true) + 90;

    while ($pids !== [] && microtime(true) < $deadline) {
        foreach ($pids as $worker => $pid) {
            if (pcntl_waitpid($pid, $status, WNOHANG) !== 0) {
                unset($pids[$worker]);
            }
        }

        usleep(20000);
    }

    foreach ($pids as $pid) {
        posix_kill($pid, SIGKILL);
        pcntl_waitpid($pid, $status);
    }

    $workers = collect(range(1, $count))->map(fn (int $worker): array => is_file("{$dir}/{$worker}.json") ? (array) json_decode((string) file_get_contents("{$dir}/{$worker}.json"), true) : ['crash' => "El proceso {$worker} no terminó."])->all();
    array_map('unlink', glob("{$dir}/*") ?: []);
    rmdir($dir);

    return ['workers' => $workers];
}

function runConversionWorker(string $quoteId, ?int $lockVersion, User $actor, Tenant $tenant, string $go, string $out): never
{
    $keep = [];

    try {
        foreach (TestDatabase::CONNECTIONS as $name) {
            $connection = DB::connection($name);
            $keep[] = $connection->getRawPdo();
            $keep[] = $connection->getRawReadPdo();
        }

        $keep[] = app('redis');
        $keep[] = app('cache');
        app()->instance('db.transactions', new DatabaseTransactionsManager);

        foreach (TestDatabase::CONNECTIONS as $name) {
            DB::purge($name);
        }

        app()->forgetInstance('redis');
        app()->forgetInstance('redis.connection');
        app()->forgetInstance('cache');
        app()->forgetInstance('cache.store');
        Facade::clearResolvedInstances();

        while (! is_file($go)) {
            usleep(1000);
        }

        app(TenantContext::class)->set($tenant);
        $reservation = app(ConvertQuoteToReservation::class)->handle($quoteId, idem('conc'), $lockVersion, $actor);
        $result = ['code' => $reservation->getAttribute('code'), 'created' => $reservation->wasRecentlyCreated];
    } catch (ApiException $exception) {
        $result = ['code' => null, 'status' => $exception->status, 'rule' => $exception->ruleCode];
    } catch (Throwable $exception) {
        $result = ['code' => null, 'crash' => $exception::class.': '.$exception->getMessage()];
    }

    file_put_contents($out, json_encode($result));
    posix_kill(posix_getpid(), SIGKILL);

    exit(1);
}

it('T-R04: convertir una cotización enviada responde 409 RT-3', function () {
    $sent = rowOf('quote_quotes', 'COT-2026-00189');
    withinTenant(tenantA(), fn () => DB::table('quote_quotes')->where('id', $sent->id)->update(['status' => 'enviada']));

    expect(convert(rowOf('quote_quotes', 'COT-2026-00189'), idem('conv')))->toBeApiError(409, 'RT-3');
});

it('If-Match desactualizado responde 409 STALE_VERSION y no crea nada', function () {
    expect(convert($this->quote, idem('conv'), (int) $this->quote->lock_version + 5))->toBeApiError(409, 'STALE_VERSION')
        ->and(reservationsOf($this->quote))->toBe(0);
});

it('SEC-BR-09: Ventas no convierte cotizaciones ajenas (403)', function () {
    actingAsSeed('U04');

    expect(convert($this->quote, idem('conv')))->toBeApiError(403, 'SEC-BR-09');
    expect(reservationsOf($this->quote))->toBe(0);
});

it('Operaciones no tiene reservations.create y no convierte', function () {
    actingAsSeed('U05');

    expect(convert($this->quote, idem('conv')))->toBeApiError(403);
    expect(reservationsOf($this->quote))->toBe(0);
});
