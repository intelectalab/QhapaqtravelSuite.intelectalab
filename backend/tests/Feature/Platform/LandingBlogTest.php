<?php

use App\Domain\Landing\Support\Visitor;
use App\Jobs\SendPlainMail;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;

const LANDING_POST = 'como-cotizar-un-paquete-a-cusco-en-10-minutos';

function landingComment(array $overrides = []): array
{
    return [...['name' => 'Gisela Mamani', 'email' => 'gisela@lagoazul.pe', 'body' => '¿El cotizador sirve para paquetes al lago Titicaca?', 'consent' => true], ...$overrides];
}

function landingRow(string $table, array $where): ?object
{
    return DB::connection('pgsql_platform')->table($table)->where($where)->first();
}

function landingAudit(string $entity, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity', $entity)->where('action', $action)->orderByDesc('code')->first();
}

beforeEach(function () {
    RateLimiter::clear('landing-comment:'.Visitor::ipHash(request()));
    Queue::fake();
});

it('el blog lista los artículos de KipuControl y Rutas Libres con filtros, destacado y más leídos', function () {
    $all = $this->getJson('/api/v1/public/landing/blog')->assertOk()->json('data');
    $kipu = $this->getJson('/api/v1/public/landing/blog?site=kipucontrol&category=ventas&order=leidos')->assertOk()->json('data');
    $search = $this->getJson('/api/v1/public/landing/blog?q=sunat')->assertOk()->json('data');

    expect(collect($all['items'])->pluck('site')->unique()->sort()->values()->all())->toBe(['kipucontrol', 'rutaslibres'])
        ->and(collect($all['items'])->pluck('slug'))->not->toContain('precios-dinamicos-temporada-alta')
        ->and($all['featured']['slug'])->toBe(LANDING_POST)
        ->and($all['popular'])->toHaveCount(3)
        ->and(collect($all['categories'])->firstWhere('value', 'ventas')['count'])->toBe(2)
        ->and(collect($kipu['items'])->pluck('slug')->all())->toBe(['embudo-de-ventas-por-whatsapp', LANDING_POST])
        ->and($kipu['featured'])->toBeNull()
        ->and(collect($search['items'])->pluck('slug')->all())->toBe(['guia-sunat-2026-facturacion-electronica-tours-receptivos'])
        ->and(collect($all['items'])->firstWhere('site', 'rutaslibres')['href'])->toStartWith('/vitrina/blog/');
});

it('el artículo trae índice, preguntas, comentarios aprobados con una respuesta del equipo y relacionados', function () {
    $post = $this->getJson('/api/v1/public/landing/blog/'.LANDING_POST)->assertOk()->json('data');

    expect($post['body'])->toContain('## El cuello de botella tradicional')
        ->and($post['faq'])->toHaveCount(3)
        ->and($post['comment_count'])->toBe(3)
        ->and(collect($post['comments'])->pluck('code')->all())->toBe(['CMT-0001', 'CMT-0003'])
        ->and($post['comments'][0]['replies'][0]['staff'])->toBeTrue()
        ->and(json_encode($post))->not->toContain('rosa@cuscoandino.pe')
        ->and($post['related'])->toHaveCount(3)
        ->and($post['related'][0]['category'])->toBe('ventas');

    $this->getJson('/api/v1/public/landing/blog/precios-dinamicos-temporada-alta')->assertNotFound();
    $this->getJson('/api/v1/public/landing/blog/free-tours-en-lima-guia')->assertNotFound();
});

it('LND-11: el primer comentario queda pendiente, el correo con uno aprobado se publica solo y el correo no se guarda en claro', function () {
    $first = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment())->assertStatus(202)->json('data');
    $trusted = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['name' => 'Rosa Huamán', 'email' => 'ROSA@cuscoandino.pe', 'body' => 'Gracias por la respuesta, nos sirvió mucho.']))->assertStatus(202)->json('data');
    $row = landingRow('platform_blog_comments', ['code' => $first['code']]);

    expect($first['status'])->toBe('pendiente')
        ->and($trusted['status'])->toBe('aprobado')
        ->and($row->email)->not->toContain('gisela')
        ->and(Crypt::decryptString($row->email))->toBe('gisela@lagoazul.pe')
        ->and($row->consent_at)->not->toBeNull()
        ->and(strlen((string) $row->ip_hash))->toBe(64);
});

it('LND-11: dos enlaces van a spam, el campo trampa se descarta sin aviso y hay 3 comentarios por hora por IP', function () {
    $spam = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['body' => 'Mira https://uno.example y www.dos.example ahora']))->assertStatus(202)->json('data');
    $trap = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['website' => 'https://bot.example']))->assertStatus(202)->json('data');

    expect(landingRow('platform_blog_comments', ['code' => $spam['code']])->status)->toBe('spam')
        ->and($trap['status'])->toBe('recibido')
        ->and(DB::connection('pgsql_platform')->table('platform_blog_comments')->where('body', landingComment()['body'])->exists())->toBeFalse();

    $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment())->assertStatus(202);
    $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment())->assertStatus(202);
    expect($this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment()))->toBeApiError(429);
});

it('LND-11 y LND-12: pide consentimiento, valida el largo y las respuestas tienen un solo nivel', function () {
    $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['consent' => false, 'body' => 'corto']))->assertStatus(422)->assertJsonValidationErrors(['consent', 'body']);

    $root = landingRow('platform_blog_comments', ['code' => 'CMT-0001']);
    $reply = landingRow('platform_blog_comments', ['code' => 'CMT-0002']);
    $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['parent_id' => $root->id]))->assertStatus(202);
    expect($this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/comments', landingComment(['parent_id' => $reply->id])))->toBeApiError(422, 'LND-12');
});

it('LND-12: «Útil» cuenta una vez por visitante en comentarios y artículos, y las lecturas una vez al día', function () {
    $comment = landingRow('platform_blog_comments', ['code' => 'CMT-0003']);

    $once = $this->postJson("/api/v1/public/landing/comments/{$comment->id}/useful")->assertOk()->json('data');
    $twice = $this->postJson("/api/v1/public/landing/comments/{$comment->id}/useful")->assertOk()->json('data');
    $rating = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/rating', ['useful' => true])->assertOk()->json('data');
    $again = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/rating', ['useful' => false])->assertOk()->json('data');
    $read = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/read')->assertOk()->json('data');
    $reread = $this->postJson('/api/v1/public/landing/blog/como-cotizar-un-paquete-a-cusco-en-10-minutos/read')->assertOk()->json('data');

    expect($once['useful'])->toBe(5)->and($twice['counted'])->toBeFalse()->and($twice['useful'])->toBe(5)
        ->and($rating['yes'])->toBe(1)->and($again['counted'])->toBeFalse()->and($again['no'])->toBe(0)
        ->and($read['reads'])->toBe(2401)->and($reread['counted'])->toBeFalse();
});

it('LND-14: el boletín pide doble confirmación y se da de baja en un clic', function () {
    $sent = $this->postJson('/api/v1/public/landing/newsletter', ['email' => 'Nuevo@Agencia.pe', 'source' => 'scroll_60'])->assertStatus(202)->json('data');
    $token = null;
    Queue::assertPushed(SendPlainMail::class, function (SendPlainMail $job) use (&$token): bool {
        preg_match('#/software/boletin/confirmar/([A-Za-z0-9]+)#', $job->body, $match);
        $token = $match[1] ?? null;

        return $job->to === 'nuevo@agencia.pe' && str_contains($job->body, '/software/boletin/baja/');
    });

    expect($sent['status'])->toBe('pendiente')->and($token)->not->toBeNull();

    $this->postJson('/api/v1/public/landing/newsletter', ['email' => 'nuevo@agencia.pe', 'source' => 'pie'])->assertStatus(202);
    Queue::assertPushed(SendPlainMail::class, 1);

    $this->postJson("/api/v1/public/landing/newsletter/confirm/{$token}")->assertOk()->assertJsonPath('data.status', 'confirmado')->assertJsonPath('data.email', 'nu•••@agencia.pe');
    $this->postJson('/api/v1/public/landing/newsletter', ['email' => 'nuevo@agencia.pe', 'source' => 'pie'])->assertStatus(202)->assertJsonPath('data.status', 'confirmado');
    $this->postJson('/api/v1/public/landing/newsletter/unsubscribe', ['token' => $token])->assertOk()->assertJsonPath('data.status', 'baja');
    expect($this->postJson("/api/v1/public/landing/newsletter/confirm/{$token}"))->toBeApiError(409, 'NEWSLETTER_UNSUBSCRIBED')
        ->and(landingAudit('Boletín landing', 'baja'))->not->toBeNull()
        ->and($this->postJson('/api/v1/public/landing/newsletter/confirm/'.str_repeat('x', 48)))->toBeApiError(404);
});

it('LND-13: solo se sirven los popups activos de la página y se cuentan vistas y conversiones', function () {
    $home = $this->getJson('/api/v1/public/landing/popups?page=inicio')->assertOk()->json('data');
    $plans = $this->getJson('/api/v1/public/landing/popups?page=planes')->assertOk()->json('data');

    expect(collect($home)->pluck('code')->all())->toBe(['POP-01'])
        ->and(collect($plans)->pluck('code')->all())->toBe(['POP-01'])
        ->and($home[0]['freq_days'])->toBe(7);

    $this->postJson('/api/v1/public/landing/popups/POP-01/events', ['event' => 'view'])->assertOk();
    $this->postJson('/api/v1/public/landing/popups/POP-01/events', ['event' => 'conversion'])->assertOk();
    $this->postJson('/api/v1/public/landing/popups/POP-03/events', ['event' => 'view'])->assertNotFound();
    $row = landingRow('platform_landing_popups', ['code' => 'POP-01']);

    expect($row->views)->toBe(1841)->and($row->conversions)->toBe(97);
    $this->getJson('/api/v1/public/landing/popups?page=suscribirse')->assertStatus(422);
});

it('la consola modera, responde como equipo y elimina comentarios con auditoría', function () {
    actingAsPlatform();
    $list = $this->getJson('/api/v1/platform/landing/comments')->assertOk()->json('data');
    $pending = collect($list['items'])->firstWhere('code', 'CMT-0005');

    expect($list['items'][0]['status'])->toBe('pendiente')
        ->and($pending['email'])->toBe('apr@mail.br')
        ->and(collect($pending['actions'])->pluck('value')->all())->toBe(['aprobado', 'rechazado', 'spam'])
        ->and($list['counts']['spam'])->toBe(1);

    $reply = $this->postJson("/api/v1/platform/landing/comments/{$pending['id']}/reply", ['body' => 'Sí, mientras la agencia del exterior factura el paquete completo.'])->assertCreated()->json('data');
    expect($reply['staff'])->toBeTrue()->and($reply['name'])->toBe('Equipo KipuControl')
        ->and(landingRow('platform_blog_comments', ['code' => 'CMT-0005'])->status)->toBe('aprobado')
        ->and(landingAudit('Comentario blog', 'responder'))->not->toBeNull();

    $hidden = $this->postJson("/api/v1/platform/landing/comments/{$pending['id']}/moderate", ['status' => 'rechazado'])->assertOk()->json('data');
    expect($hidden['status'])->toBe('rechazado')
        ->and(landingAudit('Comentario blog', 'moderar')->after_value)->toBe('Rechazado');
    expect($this->postJson("/api/v1/platform/landing/comments/{$pending['id']}/moderate", ['status' => 'spam']))->toBeApiError(422, 'LND-11');
    expect($this->postJson("/api/v1/platform/landing/comments/{$reply['id']}/reply", ['body' => 'Respuesta a una respuesta no.']))->toBeApiError(422, 'LND-12');

    $spam = collect($list['items'])->firstWhere('code', 'CMT-0004');
    $this->postJson("/api/v1/platform/landing/comments/{$spam['id']}/moderate", ['status' => 'pendiente'])->assertOk()->assertJsonPath('data.status', 'pendiente');
    $this->deleteJson("/api/v1/platform/landing/comments/{$spam['id']}")->assertOk();
    $approved = collect($list['items'])->firstWhere('code', 'CMT-0003');
    expect($this->deleteJson("/api/v1/platform/landing/comments/{$approved['id']}"))->toBeApiError(409, 'LND-11')
        ->and(landingAudit('Comentario blog', 'eliminar'))->not->toBeNull();
});

it('la consola crea, edita, activa, pausa y elimina popups', function () {
    actingAsPlatform();
    $payload = ['name' => 'Guía SUNAT en el blog', 'trigger' => 'tiempo_30s', 'kind' => 'enlace', 'pages' => ['blog'], 'freq_days' => 10, 'title' => 'Descarga la guía SUNAT 2026', 'body' => 'Todo lo que pide SUNAT para facturar tours receptivos.', 'cta_label' => 'Leer la guía', 'cta_href' => '/software/blog/guia-sunat-2026-facturacion-electronica-tours-receptivos'];

    $created = $this->postJson('/api/v1/platform/landing/popups', $payload)->assertCreated()->json('data');
    expect($created['code'])->toBe('POP-04')->and($created['status'])->toBe('borrador')->and($created['page_labels'])->toBe(['Lista del blog']);

    $this->postJson('/api/v1/platform/landing/popups', [...$payload, 'cta_href' => 'https://otro.example'])->assertStatus(422)->assertJsonValidationErrors('cta_href');
    $this->postJson('/api/v1/platform/landing/popups', [...$payload, 'cta_href' => null])->assertStatus(422)->assertJsonValidationErrors('cta_href');
    $this->patchJson('/api/v1/platform/landing/popups/POP-04', ['freq_days' => 14])->assertOk()->assertJsonPath('data.freq_days', 14);
    expect($this->patchJson('/api/v1/platform/landing/popups/POP-04', ['freq_days' => 14]))->toBeApiError(422, 'CFG-BR-01');

    $this->postJson('/api/v1/platform/landing/popups/POP-04/status', ['status' => 'activo'])->assertOk()->assertJsonPath('data.status', 'activo');
    expect(collect($this->getJson('/api/v1/public/landing/popups?page=blog')->json('data'))->pluck('code')->all())->toBe(['POP-04']);
    expect($this->deleteJson('/api/v1/platform/landing/popups/POP-04'))->toBeApiError(409, 'LND-13');
    $this->postJson('/api/v1/platform/landing/popups/POP-04/status', ['status' => 'pausado'])->assertOk();
    $this->deleteJson('/api/v1/platform/landing/popups/POP-04')->assertOk();

    expect(landingRow('platform_landing_popups', ['code' => 'POP-04']))->toBeNull()
        ->and(landingAudit('Popup landing', 'activar'))->not->toBeNull()
        ->and(landingAudit('Popup landing', 'eliminar'))->not->toBeNull()
        ->and($this->getJson('/api/v1/platform/landing/popups')->json('data.counts.activo'))->toBe(2);
});

it('la consola publica, archiva y elimina artículos del blog de KipuControl', function () {
    actingAsPlatform();
    $body = '## Introducción'."\n".str_repeat('Contenido útil para agencias de viaje del Perú. ', 50);
    $created = $this->postJson('/api/v1/platform/landing/posts', ['title' => 'Cómo vender tours en temporada baja', 'excerpt' => 'Estrategias para llenar salidas cuando baja la demanda.', 'focus_keyword' => 'temporada baja', 'category' => 'ventas', 'body' => 'Muy corto.', 'featured' => true])->assertCreated()->json('data');

    expect($created['status'])->toBe('borrador')->and($created['slug'])->toBe('como-vender-tours-en-temporada-baja')
        ->and(landingRow('platform_blog_posts', ['slug' => LANDING_POST])->featured)->toBeFalse();
    expect($this->postJson("/api/v1/platform/landing/posts/{$created['id']}/status", ['status' => 'publicado']))->toBeApiError(422, 'LND-17');

    $this->patchJson("/api/v1/platform/landing/posts/{$created['id']}", ['body' => $body, 'faq' => [['q' => '¿Funciona en Cusco?', 'a' => 'Sí, en todo el Perú.']]])->assertOk()->assertJsonPath('data.word_count', 401);
    $this->postJson("/api/v1/platform/landing/posts/{$created['id']}/status", ['status' => 'publicado'])->assertOk()->assertJsonPath('data.status', 'publicado');
    expect($this->getJson('/api/v1/public/landing/blog/como-vender-tours-en-temporada-baja')->assertOk()->json('data.faq.0.q'))->toBe('¿Funciona en Cusco?');

    $this->postJson("/api/v1/platform/landing/posts/{$created['id']}/status", ['status' => 'archivado'])->assertOk();
    $this->getJson('/api/v1/public/landing/blog/como-vender-tours-en-temporada-baja')->assertNotFound();
    expect($this->deleteJson("/api/v1/platform/landing/posts/{$created['id']}"))->toBeApiError(409, 'LND-17');

    $draft = collect($this->getJson('/api/v1/platform/landing/posts')->json('data.items'))->firstWhere('slug', 'precios-dinamicos-temporada-alta');
    $this->deleteJson("/api/v1/platform/landing/posts/{$draft['id']}")->assertOk();
    expect(landingAudit('Blog KipuControl', 'publicar'))->not->toBeNull()->and(landingAudit('Blog KipuControl', 'eliminar'))->not->toBeNull();
});

it('la consola lista los suscriptores del boletín por estado', function () {
    actingAsPlatform();
    $data = $this->getJson('/api/v1/platform/landing/subscribers')->assertOk()->json('data');
    $confirmed = $this->getJson('/api/v1/platform/landing/subscribers?status=confirmado')->assertOk()->json('data');

    expect($data['counts'])->toMatchArray(['total' => 5, 'confirmado' => 3, 'pendiente' => 1, 'baja' => 1])
        ->and($confirmed['items'])->toHaveCount(3)
        ->and(collect($data['items'])->pluck('email'))->toContain('ventas@salkantay.pe');
});

it('las rutas de la landing en la consola rechazan a los usuarios de agencia con los permisos requeridos', function () {
    actingAsSeed('U01');

    foreach (['/api/v1/platform/landing/comments', '/api/v1/platform/landing/popups', '/api/v1/platform/landing/posts', '/api/v1/platform/landing/subscribers'] as $url) {
        expect($this->getJson($url)->status())->toBeIn([401, 403]);
    }
});

it('el blog de la vitrina ya no muestra los artículos de KipuControl', function () {
    $data = $this->getJson('/api/v1/showcase/posts')->assertOk()->json('data');
    $slugs = collect($data['items'] ?? $data)->pluck('slug');

    expect($slugs)->not->toBeEmpty()->and($slugs)->not->toContain(LANDING_POST);
    $this->getJson('/api/v1/showcase/posts/'.LANDING_POST)->assertNotFound();
});
