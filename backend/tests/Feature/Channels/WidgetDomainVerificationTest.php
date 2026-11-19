<?php

use App\Domain\Integrations\Adapters\SystemDnsResolver;
use App\Domain\Integrations\Contracts\DnsResolver;
use App\Domain\Integrations\Fake\FakeDnsResolver;
use App\Domain\Shared\Jobs\JobCatalog;
use App\Jobs\VerifyWidgetDomain;
use Illuminate\Support\Facades\DB;

function widgetDns(): FakeDnsResolver
{
    $dns = app(DnsResolver::class);
    assert($dns instanceof FakeDnsResolver);

    return $dns;
}

function widgetDomainRow(string $domain): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('channel_widget_domains')->where('domain', $domain)->first());
}

function widgetDomainAdd(string $domain): object
{
    actingAsSeed('U01');
    test()->postJson('/api/v1/channels/widget/domains', ['domain' => $domain, 'cms' => 'WordPress'])->assertCreated();

    return widgetDomainRow($domain);
}

function widgetDomainOld(string $domain): object
{
    withinTenant(tenantA(), fn () => DB::table('channel_widget_domains')->insert([
        'domain' => $domain,
        'status' => 'pendiente',
        'verify_token' => 'kipucontrol-verify=antiguo1',
        'created_at' => DB::raw("now() - interval '80 hours'"),
        'updated_at' => DB::raw("now() - interval '80 hours'"),
    ]));

    return widgetDomainRow($domain);
}

function widgetDomainOrigin(string $domain)
{
    $key = (string) withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->value('public_key'));

    return withPlatformSeeingTenant(fn () => test()->getJson('/api/v1/public/products', ['X-KipuControl-Key' => $key, 'Origin' => "https://{$domain}"]));
}

function widgetDomainAudits(string $domain): array
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Dominio del widget', 'entity_id' => $domain, 'action' => 'verificar'])->get(['actor_id', 'evidence'])->all());
}

function widgetDomainJob(): string
{
    $runs = fn () => DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', VerifyWidgetDomain::class);
    $before = $runs()->pluck('id')->all();
    dispatch_sync((new VerifyWidgetDomain)->forTenant((string) tenantA()->getKey()));

    return (string) $runs()->whereNotIn('id', $before)->value('result');
}

it('WG-01: Verificar consulta el TXT del dominio y, si no está, lo deja pendiente y avisa que se seguirá revisando', function () {
    $row = widgetDomainAdd('reservas.wayraviajes.pe');

    $data = $this->postJson("/api/v1/channels/widget/domains/{$row->id}/verify")->assertOk()->json('data');

    expect($data['status'])->toBe('pendiente')
        ->and($data['message'])->toContain($row->verify_token)->toContain('cada 10 minutos durante 72 horas')
        ->and($data['checking_until'])->not->toBeNull()
        ->and(widgetDns()->lookups)->toContain('reservas.wayraviajes.pe')
        ->and(widgetDomainRow('reservas.wayraviajes.pe')->status)->toBe('pendiente')
        ->and(widgetDomainAudits('reservas.wayraviajes.pe'))->toBe([])
        ->and(widgetDomainOrigin('reservas.wayraviajes.pe'))->toBeApiError(403, 'WIDGET_ORIGIN_NOT_ALLOWED');
});

it('WG-01: un TXT con otro valor no verifica el dominio', function () {
    $row = widgetDomainAdd('reservas.wayraviajes.pe');
    widgetDns()->put('reservas.wayraviajes.pe', 'v=spf1 include:_spf.google.com ~all', 'kipucontrol-verify=otro-valor');

    $this->postJson("/api/v1/channels/widget/domains/{$row->id}/verify")->assertOk()->assertJsonPath('data.status', 'pendiente');

    expect(widgetDomainRow('reservas.wayraviajes.pe')->status)->toBe('pendiente');
});

it('WG-01: con el TXT publicado Verificar lo marca verificado, audita la evidencia y el widget responde desde ese origen', function () {
    $row = widgetDomainAdd('reservas.wayraviajes.pe');
    widgetDns()->put('reservas.wayraviajes.pe', 'v=spf1 -all', '"'.mb_strtoupper($row->verify_token).'"');

    $this->postJson("/api/v1/channels/widget/domains/{$row->id}/verify")->assertOk()
        ->assertJsonPath('data.status', 'verificado')->assertJsonPath('data.message', null);

    $audits = widgetDomainAudits('reservas.wayraviajes.pe');
    expect(widgetDomainRow('reservas.wayraviajes.pe')->status)->toBe('verificado')
        ->and(widgetDomainRow('reservas.wayraviajes.pe')->verified_at)->not->toBeNull()
        ->and($audits)->toHaveCount(1)
        ->and(json_decode((string) $audits[0]->evidence, true))->toMatchArray(['txt' => $row->verify_token, 'origin' => 'manual']);
    widgetDomainOrigin('reservas.wayraviajes.pe')->assertOk();
});

it('la pantalla muestra hasta cuándo se revisa sola un dominio pendiente', function () {
    widgetDomainAdd('reservas.wayraviajes.pe');

    $domain = collect($this->getJson('/api/v1/channels/widget')->assertOk()->json('data.domains'))->firstWhere('domain', 'reservas.wayraviajes.pe');

    expect($domain['status'])->toBe('pendiente')->and($domain['checking_until'])->not->toBeNull();
});

it('VerifyWidgetDomain verifica los pendientes con TXT, deja los demás y no revisa los que pasaron las 72 horas', function () {
    $ready = widgetDomainAdd('reservas.wayraviajes.pe');
    widgetDomainAdd('blog.wayraviajes.pe');
    $old = widgetDomainOld('viejo.wayraviajes.pe');
    widgetDns()->put('reservas.wayraviajes.pe', $ready->verify_token)->put('viejo.wayraviajes.pe', $old->verify_token);
    widgetDns()->lookups = [];

    $result = widgetDomainJob();

    expect($result)->toContain('1 dominio verificado')->toContain('sin registro TXT')
        ->and(widgetDomainRow('reservas.wayraviajes.pe')->status)->toBe('verificado')
        ->and(widgetDomainRow('blog.wayraviajes.pe')->status)->toBe('pendiente')
        ->and(widgetDomainRow('viejo.wayraviajes.pe')->status)->toBe('pendiente')
        ->and(widgetDns()->lookups)->not->toContain('viejo.wayraviajes.pe')
        ->and(json_decode((string) widgetDomainAudits('reservas.wayraviajes.pe')[0]->evidence, true)['origin'])->toBe('job');
});

it('pulsar Verificar sin TXT reinicia la ventana de 72 horas del job', function () {
    $row = widgetDomainOld('viejo.wayraviajes.pe');
    widgetDns()->put('viejo.wayraviajes.pe', $row->verify_token);
    expect(widgetDomainJob())->not->toContain('dominio verificado');
    widgetDns()->forget('viejo.wayraviajes.pe');

    actingAsSeed('U01');
    $this->postJson("/api/v1/channels/widget/domains/{$row->id}/verify")->assertOk()->assertJsonPath('data.status', 'pendiente');
    widgetDns()->put('viejo.wayraviajes.pe', $row->verify_token);

    expect(widgetDomainJob())->toContain('1 dominio verificado')
        ->and(widgetDomainRow('viejo.wayraviajes.pe')->status)->toBe('verificado');
});

it('VerifyWidgetDomain queda en el catálogo cada 10 minutos en la cola low', function () {
    expect(JobCatalog::TENANT['JOB-WEB-1'])->toMatchArray(['class' => VerifyWidgetDomain::class, 'cron' => '*/10 * * * *', 'queue' => 'low'])
        ->and(VerifyWidgetDomain::QUEUE)->toBe('low');
});

it('el resolvedor DNS real es el predeterminado y el falso solo se elige por configuración', function () {
    expect((string) file_get_contents(config_path('integrations.php')))->toContain("'dns' => env('DNS_RESOLVER', 'dns')");

    app()->forgetInstance(DnsResolver::class);
    config(['integrations.drivers.dns' => 'dns']);
    expect(app(DnsResolver::class))->toBeInstanceOf(SystemDnsResolver::class);

    app()->forgetInstance(DnsResolver::class);
    config(['integrations.drivers.dns' => 'fake']);
    expect(app(DnsResolver::class))->toBeInstanceOf(FakeDnsResolver::class);
});
