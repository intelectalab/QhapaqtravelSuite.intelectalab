<?php

use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Integrations\Mail\AgencyMailer;
use App\Domain\Integrations\Mail\RoutedMessagingChannel;
use App\Domain\Integrations\Mail\SmtpConnector;
use App\Domain\Marketing\Support\CampaignTracking;
use App\Jobs\SendCampaign;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

const SEGUIMIENTO_OFERTA = 'https://andestravel.pe/ofertas/diciembre';

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function seguimientoEnviando(object $test): string
{
    Queue::fake();
    actingAsSeed('U01');
    $code = $test->postJson('/api/v1/marketing/campaigns', [
        'name' => 'Ofertas de diciembre',
        'channel' => 'email',
        'segment' => 'SEG-001',
        'template' => 'TPL-01',
        'subject' => 'Ofertas de diciembre',
        'body' => "Hola {{nombre}}:\nMira las ofertas en ".SEGUIMIENTO_OFERTA.".\n{{enlace_baja}}",
    ])->assertCreated()->json('data.code');
    $test->postJson("/api/v1/marketing/campaigns/{$code}/test-send", [], critical())->assertCreated();
    $test->postJson("/api/v1/marketing/campaigns/{$code}/send", [], critical((int) rowOf('mkt_campaigns', $code)->lock_version))->assertStatus(202);

    return $code;
}

function seguimientoEnviar(string $code, ?array $connection): array
{
    $captured = [];
    $mailbox = Mockery::mock(AgencyMailbox::class);
    $mailbox->shouldReceive('connection')->andReturn($connection);
    $mailer = Mockery::mock(AgencyMailer::class);
    $mailer->shouldReceive('deliver')->andReturnUsing(function (array $connection, string $to, ?string $name, string $subject, string $body, ?string $html = null) use (&$captured): string {
        $captured[] = ['to' => $to, 'body' => $body, 'html' => $html];

        return '<'.count($captured).'@andestravel.pe>';
    });
    $fake = new FakeMessagingChannel;
    $channel = new RoutedMessagingChannel($fake, $mailbox, $mailer, new SmtpConnector);

    withinTenant(tenantA(), fn () => app()->call([new SendCampaign((string) rowOf('mkt_campaigns', $code)->id), 'handle'], ['channel' => $channel, 'mailbox' => $mailbox]));

    return [$captured, $fake->sent];
}

function seguimientoConexion(): array
{
    return ['host' => 'smtp.gmail.com', 'port' => 465, 'encryption' => 'ssl', 'username' => 'reservas@andestravel.pe', 'password' => 'x', 'from_address' => 'reservas@andestravel.pe', 'from_name' => 'Andes Travel'];
}

function seguimientoTenant(): string
{
    return (string) tenantA()->getKey();
}

function seguimientoRuta(string $url): string
{
    return (string) parse_url($url, PHP_URL_PATH);
}

function seguimientoDestinatario(string $id): object
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('id', $id)->first());
}

it('con el correo de la agencia reescribe los enlaces, agrega el píxel y deja intacto el enlace de baja', function () {
    $code = seguimientoEnviando($this);

    [$captured, $fakeSent] = seguimientoEnviar($code, seguimientoConexion());

    $first = $captured[0];
    expect($captured)->not->toBeEmpty()
        ->and($fakeSent)->toBeEmpty()
        ->and($first['body'])->toContain('/api/v1/public/campaigns/click/')
        ->and($first['body'])->not->toContain(SEGUIMIENTO_OFERTA)
        ->and($first['body'])->toContain('/boletin/baja?token=c')
        ->and($first['html'])->toContain('/api/v1/public/campaigns/open/')
        ->and($first['html'])->toContain('>'.SEGUIMIENTO_OFERTA.'</a>')
        ->and(rowOf('mkt_campaigns', $code)->status)->toBe('enviada');
});

it('sin correo propio de la agencia el mensaje sale sin seguimiento propio', function () {
    $code = seguimientoEnviando($this);

    [$captured, $fakeSent] = seguimientoEnviar($code, null);

    expect($captured)->toBeEmpty()
        ->and($fakeSent)->not->toBeEmpty()
        ->and($fakeSent[0]->body)->toContain(SEGUIMIENTO_OFERTA)
        ->and($fakeSent[0]->body)->not->toContain('/api/v1/public/campaigns/')
        ->and($fakeSent[0]->html)->toBeNull();
});

it('el píxel registra solo la primera apertura y la métrica de la campaña la cuenta', function () {
    $code = seguimientoEnviando($this);
    seguimientoEnviar($code, seguimientoConexion());
    $recipient = withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('campaign_id', rowOf('mkt_campaigns', $code)->id)->orderBy('id')->first());
    $path = seguimientoRuta(CampaignTracking::openUrl(seguimientoTenant(), (string) $recipient->id));

    expect($path)->toBe('/api/v1/public/campaigns/open/'.CampaignTracking::openToken(seguimientoTenant(), (string) $recipient->id));
    $response = $this->get($path)->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('image/gif')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($response->getContent())->toBe(base64_decode(CampaignTracking::PIXEL));

    $opened = seguimientoDestinatario((string) $recipient->id);
    expect($opened->opened_at)->not->toBeNull()
        ->and($opened->delivered_at)->not->toBeNull()
        ->and($opened->status)->toBe('entregado')
        ->and($opened->clicked_at)->toBeNull();

    $this->travel(2)->hours();
    $this->get($path)->assertOk();
    expect(seguimientoDestinatario((string) $recipient->id)->opened_at)->toBe($opened->opened_at)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Campaña')->where('entity_id', $code)->where('action', 'acuse_envio')->count()))->toBe(1);

    $metrics = $this->getJson("/api/v1/marketing/campaigns/{$code}")->assertOk()->json('data.metrics');
    expect($metrics['opened'])->toBe(1)->and($metrics['clicked'])->toBe(0);
});

it('el enlace registra el clic y redirige solo al enlace original de la campaña', function () {
    $code = seguimientoEnviando($this);
    seguimientoEnviar($code, seguimientoConexion());
    $recipient = withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('campaign_id', rowOf('mkt_campaigns', $code)->id)->orderBy('id')->first());
    $id = (string) $recipient->id;

    $this->get('/api/v1/public/campaigns/click/'.CampaignTracking::clickToken(seguimientoTenant(), $id, 0))->assertRedirect(SEGUIMIENTO_OFERTA);

    $clicked = seguimientoDestinatario($id);
    expect($clicked->clicked_at)->not->toBeNull()->and($clicked->opened_at)->not->toBeNull();

    $this->get('/api/v1/public/campaigns/click/'.CampaignTracking::clickToken(seguimientoTenant(), $id, 0))->assertRedirect(SEGUIMIENTO_OFERTA);
    expect(seguimientoDestinatario($id)->clicked_at)->toBe($clicked->clicked_at);

    $signature = substr(CampaignTracking::clickToken(seguimientoTenant(), $id, 0), -64);
    expect($this->getJson('/api/v1/public/campaigns/click/'.seguimientoTenant().".{$id}.1.{$signature}"))->toBeApiError(404);
    expect($this->getJson('/api/v1/public/campaigns/click/'.CampaignTracking::clickToken((string) tenantB()->getKey(), $id, 0)))->toBeApiError(404);
    expect($this->getJson('/api/v1/public/campaigns/click/'.CampaignTracking::clickToken(seguimientoTenant(), $id, 3)))->toBeApiError(404);
    expect($this->getJson('/api/v1/public/campaigns/click/no-es-un-token?u=https://malicioso.example'))->toBeApiError(404);

    $metrics = $this->getJson("/api/v1/marketing/campaigns/{$code}")->assertOk()->json('data.metrics');
    expect($metrics['clicked'])->toBe(1)->and($metrics['opened'])->toBe(1);
});

it('un píxel con token alterado devuelve la imagen sin registrar nada', function () {
    $code = seguimientoEnviando($this);
    seguimientoEnviar($code, seguimientoConexion());
    $recipient = withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('campaign_id', rowOf('mkt_campaigns', $code)->id)->orderBy('id')->first());
    $forged = seguimientoTenant().'.'.$recipient->id.'.'.str_repeat('a', 64);
    $this->get('/api/v1/public/campaigns/open/'.CampaignTracking::openToken((string) tenantB()->getKey(), (string) $recipient->id))->assertOk();

    $this->get("/api/v1/public/campaigns/open/{$forged}")->assertOk()->assertHeader('Content-Type', 'image/gif');
    $this->get('/api/v1/public/campaigns/open/cualquier-cosa')->assertOk();

    expect(seguimientoDestinatario((string) $recipient->id)->opened_at)->toBeNull();
});
