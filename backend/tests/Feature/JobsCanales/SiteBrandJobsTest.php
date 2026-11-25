<?php

use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\RenewCertificates;
use App\Jobs\SeoNightlyAudit;
use App\Jobs\VerifyDomains;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

require_once __DIR__.'/JobsCanalesHelpers.php';

beforeEach(function () {
    lockScheduledJobs();
    Queue::fake(canalesSideJobs());
});

function siteJobDomain(string $host, array $values = []): string
{
    return withinTenant(tenantA(), function () use ($host, $values): string {
        $id = (string) Str::uuid7();
        DB::table('cms_site_domains')->insert(['id' => $id, 'host' => $host, 'purpose' => 'reservas', 'status' => 'pendiente_dns', 'verify_token' => Str::lower(Str::random(24)), 'ssl_status' => 'pendiente', ...$values]);

        return $id;
    });
}

function siteJobRow(string $id): object
{
    return withinTenant(tenantA(), fn () => DB::table('cms_site_domains')->where('id', $id)->first());
}

it('JOB-WEB-2 verifica el DNS pendiente, emite el SSL y deja esperando el que aún no tiene registros', function () {
    $suffix = Str::lower(Str::random(6));
    $ok = siteJobDomain("reservas-{$suffix}.example.com");
    $waiting = siteJobDomain("sin-dns.nuevo-{$suffix}.example.com");
    $stale = siteJobDomain("sin-dns.viejo-{$suffix}.example.com", ['created_at' => now()->subDays(4)]);

    $run = canalesJobRun(new VerifyDomains);

    $verified = siteJobRow($ok);
    expect($verified->status)->toBe('verificado')
        ->and($verified->ssl_status)->toBe('emitido')
        ->and(Carbon::parse($verified->ssl_expires_at)->isAfter(now()->addDays(60)))->toBeTrue()
        ->and(siteJobRow($waiting)->status)->toBe('pendiente_dns')
        ->and(siteJobRow($waiting)->last_error)->toContain('kipu-verify=')
        ->and(siteJobRow($stale)->status)->toBe('error')
        ->and($run->status)->toBe('advertencia')
        ->and($run->result)->toContain('SSL emitido')->toContain('esperando el DNS')->toContain('sin DNS tras 72 h')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Dominio')->where('entity_id', "reservas-{$suffix}.example.com")->pluck('action')->sort()->values()->all()))->toBe(['emitir_ssl', 'verificar']);
});

it('JOB-WEB-2 en producción sin proveedor real de dominios no verifica nada ni inventa certificados', function () {
    config(['integrations.require_real' => true, 'integrations.drivers.domains' => 'fake']);
    $id = siteJobDomain('reservas-'.Str::lower(Str::random(6)).'.example.com');

    $run = canalesJobRun(new VerifyDomains);

    expect($run->status)->toBe('advertencia')
        ->and($run->result)->toContain('Sin proveedor real')
        ->and(siteJobRow($id)->status)->toBe('pendiente_dns')
        ->and(siteJobRow($id)->ssl_status)->toBe('pendiente');
});

it('JOB-WEB-3 renueva el SSL que vence en menos de 30 días y deja en paz el que sigue vigente', function () {
    $suffix = Str::lower(Str::random(6));
    $due = siteJobDomain("vence-{$suffix}.example.com", ['status' => 'verificado', 'verified_at' => now()->subMonths(3), 'ssl_status' => 'emitido', 'ssl_expires_at' => now()->addDays(10)]);
    $fresh = siteJobDomain("vigente-{$suffix}.example.com", ['status' => 'verificado', 'verified_at' => now()->subMonth(), 'ssl_status' => 'emitido', 'ssl_expires_at' => now()->addDays(60)]);

    $run = canalesJobRun(new RenewCertificates);

    expect($run->result)->toContain('1 certificado renovado')
        ->and(siteJobRow($due)->ssl_status)->toBe('emitido')
        ->and(Carbon::parse(siteJobRow($due)->ssl_expires_at)->isAfter(now()->addDays(60)))->toBeTrue()
        ->and(Carbon::parse(siteJobRow($fresh)->ssl_expires_at)->toDateString())->toBe(now()->addDays(60)->toDateString())
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', "vence-{$suffix}.example.com")->where('action', 'renovar_ssl')->count()))->toBe(1)
        ->and(canalesJobRun(new RenewCertificates)->result)->not->toContain('renovado');
});

it('JOB-WEB-4 recalcula el puntaje y los pendientes de cada página publicada', function () {
    $id = withinTenant(tenantA(), function (): string {
        $id = (string) Str::uuid7();
        DB::table('cms_seo_pages')->insert(['id' => $id, 'path' => '/pest-'.Str::lower(Str::random(6)), 'title' => 'Tour al Valle Sagrado', 'meta_description' => null, 'h1_count' => 0, 'word_count' => 40, 'score' => null]);

        return $id;
    });

    $run = canalesJobRun(new SeoNightlyAudit);
    $page = withinTenant(tenantA(), fn () => DB::table('cms_seo_pages')->where('id', $id)->first(['score', 'issues', 'audited_at']));

    expect($run->status)->toBe('ok')
        ->and($run->result)->toContain('páginas auditadas')->toContain('puntaje medio')
        ->and($page->score)->not->toBeNull()
        ->and($page->audited_at)->not->toBeNull()
        ->and(json_decode((string) $page->issues, true))->not->toBeEmpty();
});

it('los jobs de dominio y SEO quedan en el catálogo con la cola y la hora de la spec 22', function () {
    expect(JobCatalog::TENANT['JOB-WEB-2'])->toMatchArray(['class' => VerifyDomains::class, 'cron' => '*/10 * * * *', 'queue' => 'default'])
        ->and(JobCatalog::TENANT['JOB-WEB-3'])->toMatchArray(['class' => RenewCertificates::class, 'queue' => 'default'])
        ->and(JobCatalog::TENANT['JOB-WEB-4'])->toMatchArray(['class' => SeoNightlyAudit::class, 'cron' => '0 2 * * *', 'queue' => 'reports']);
});
