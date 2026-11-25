<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Landing\Actions\LandingNewsletter;
use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Landing\Support\Visitor;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LandingSeeder
{
    public const ORDER = 95;

    private const LANDING_TODAY = '2026-11-04';

    private const COMMENTS = [
        ['code' => 'CMT-0001', 'post' => 'como-cotizar-un-paquete-a-cusco-en-10-minutos', 'parent' => null, 'name' => 'Rosa Huamán', 'email' => 'rosa@cuscoandino.pe', 'body' => '¿El cotizador toma el tipo de cambio del día o uno fijo por cotización?', 'status' => 'aprobado', 'at' => '2026-10-19 09:12', 'useful' => 6, 'staff' => false],
        ['code' => 'CMT-0002', 'post' => 'como-cotizar-un-paquete-a-cusco-en-10-minutos', 'parent' => 'CMT-0001', 'name' => 'Equipo KipuControl', 'email' => null, 'body' => 'Toma el del día y lo guarda en la cotización, así el monto no cambia aunque el viajero pague después.', 'status' => 'aprobado', 'at' => '2026-10-19 10:40', 'useful' => 9, 'staff' => true],
        ['code' => 'CMT-0003', 'post' => 'como-cotizar-un-paquete-a-cusco-en-10-minutos', 'parent' => null, 'name' => 'Luis Ccori', 'email' => 'luis@salkantay.pe', 'body' => 'Lo de responder en 15 minutos es real: en julio duplicamos cierres solo con eso.', 'status' => 'aprobado', 'at' => '2026-10-20 18:05', 'useful' => 4, 'staff' => false],
        ['code' => 'CMT-0004', 'post' => 'como-cotizar-un-paquete-a-cusco-en-10-minutos', 'parent' => null, 'name' => 'promo-seo', 'email' => 'x@spam.biz', 'body' => 'Compra enlaces baratos en mi sitio https://spam.example https://spam.example/2', 'status' => 'spam', 'at' => '2026-10-21 03:10', 'useful' => 0, 'staff' => false],
        ['code' => 'CMT-0005', 'post' => 'guia-sunat-2026-facturacion-electronica-tours-receptivos', 'parent' => null, 'name' => 'Ana Paula Rocha', 'email' => 'apr@mail.br', 'body' => '¿La exoneración también aplica si la agencia del exterior paga el paquete completo?', 'status' => 'pendiente', 'at' => '2026-10-30 21:44', 'useful' => 0, 'staff' => false],
    ];

    private const POPUPS = [
        ['code' => 'POP-01', 'name' => 'Prueba de 14 días al salir', 'trigger' => 'salida', 'kind' => 'prueba', 'pages' => ['inicio', 'planes'], 'freq' => 7, 'status' => 'activo', 'views' => 1840, 'conversions' => 96, 'eyebrow' => 'Antes de irte', 'title' => 'Prueba 14 días el plan Professional', 'body' => 'Cotizador, reservas, cobros y tu web con SEO. Sin tarjeta y cancelas cuando quieras.', 'cta' => 'Quiero mi prueba', 'href' => '/software/suscribirse?plan=professional&ciclo=prueba'],
        ['code' => 'POP-02', 'name' => 'Boletín al 60 % del artículo', 'trigger' => 'scroll_60', 'kind' => 'boletin', 'pages' => ['articulo'], 'freq' => 14, 'status' => 'activo', 'views' => 3120, 'conversions' => 212, 'eyebrow' => 'Boletín mensual', 'title' => 'Recibe una guía como esta cada mes', 'body' => 'Ventas, SUNAT, operación e IA para agencias de viaje. Sin spam y con baja en un clic.', 'cta' => 'Suscribirme', 'href' => null],
        ['code' => 'POP-03', 'name' => 'Demo de 2 minutos en planes', 'trigger' => 'tiempo_30s', 'kind' => 'enlace', 'pages' => ['planes'], 'freq' => 7, 'status' => 'pausado', 'views' => 410, 'conversions' => 9, 'eyebrow' => '¿Comparando planes?', 'title' => 'Mira KipuControl funcionando en 2 minutos', 'body' => 'Un recorrido por el cotizador, las reservas, la operación y los cobros con datos de una agencia real.', 'cta' => 'Ver el recorrido', 'href' => '/?demo=1'],
    ];

    private const SUBSCRIBERS = [
        ['email' => 'gerencia@cuscoandino.pe', 'source' => 'blog', 'status' => 'confirmado', 'at' => '2026-10-12 10:20'],
        ['email' => 'ventas@salkantay.pe', 'source' => 'scroll_60', 'status' => 'confirmado', 'at' => '2026-10-19 16:05'],
        ['email' => 'hola@arequipatrekking.pe', 'source' => 'pie', 'status' => 'confirmado', 'at' => '2026-10-24 09:40'],
        ['email' => 'operaciones@lagoazul.pe', 'source' => 'popup_salida', 'status' => 'pendiente', 'at' => '2026-10-31 18:12'],
        ['email' => 'contacto@limaapie.pe', 'source' => 'pie', 'status' => 'baja', 'at' => '2026-10-02 12:00'],
    ];

    public function __construct(private readonly ?Tenant $tenant = null) {}

    public function run(): void
    {
        if ($this->tenant !== null && $this->tenant->code !== 'TNT-0001') {
            return;
        }

        $posts = $this->posts();
        $this->comments($posts);
        $this->popups();
        $this->subscribers();
    }

    private function posts(): array
    {
        $ids = [];

        foreach (require database_path('seeders/Landing/posts.php') as $seed) {
            $values = [
                'site' => LandingBlog::SITE,
                'title' => $seed['title'],
                'title_accent' => $seed['title_accent'],
                'excerpt' => $seed['excerpt'],
                'body' => $seed['body'],
                'category' => $seed['category'],
                'focus_keyword' => $seed['keyword'],
                'author_name' => $seed['author'],
                'author_role' => $seed['role'],
                'featured' => $seed['featured'],
                'allow_comments' => true,
                'faq' => json_encode($seed['faq'], JSON_UNESCAPED_UNICODE),
                'reads' => $seed['reads'],
                'word_count' => LandingBlog::words($seed['body']),
                'status' => $seed['published'] === null ? 'borrador' : 'publicado',
                'published_at' => $seed['published'] === null ? null : $this->moment($seed['published'].' 09:00'),
                'updated_at' => now(),
            ];
            $id = $this->db()->table('platform_blog_posts')->where('slug', $seed['slug'])->value('id');

            if ($id === null) {
                $id = (string) Str::uuid7();
                $this->db()->table('platform_blog_posts')->insert(['id' => $id, 'slug' => $seed['slug'], ...$values, 'created_at' => now()]);
            } else {
                $this->db()->table('platform_blog_posts')->where('id', $id)->update($values);
            }

            $ids[$seed['slug']] = (string) $id;
        }

        return $ids;
    }

    private function comments(array $posts): void
    {
        $ids = [];

        foreach (self::COMMENTS as $seed) {
            $existing = $this->db()->table('platform_blog_comments')->where('code', $seed['code'])->value('id');
            $ids[$seed['code']] = (string) ($existing ?? Str::uuid7());

            if ($existing !== null) {
                continue;
            }

            $at = $this->moment($seed['at']);
            $this->db()->table('platform_blog_comments')->insert([
                'id' => $ids[$seed['code']],
                'code' => $seed['code'],
                'post_id' => $posts[$seed['post']],
                'parent_id' => $seed['parent'] === null ? null : $ids[$seed['parent']],
                'name' => $seed['name'],
                'email' => $seed['email'] === null ? null : Crypt::encryptString($seed['email']),
                'email_hash' => $seed['email'] === null ? null : Visitor::stableHash($seed['email']),
                'body' => $seed['body'],
                'status' => $seed['status'],
                'useful' => $seed['useful'],
                'staff' => $seed['staff'],
                'consent_at' => $seed['staff'] ? null : $at,
                'moderated_at' => $seed['status'] === 'pendiente' ? null : $at,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        }
    }

    private function popups(): void
    {
        foreach (self::POPUPS as $seed) {
            $values = [
                'name' => $seed['name'],
                'trigger' => $seed['trigger'],
                'kind' => $seed['kind'],
                'pages' => '{'.implode(',', $seed['pages']).'}',
                'freq_days' => $seed['freq'],
                'status' => $seed['status'],
                'eyebrow' => $seed['eyebrow'],
                'title' => $seed['title'],
                'body' => $seed['body'],
                'cta_label' => $seed['cta'],
                'cta_href' => $seed['href'],
                'updated_at' => now(),
            ];

            if ($this->db()->table('platform_landing_popups')->where('code', $seed['code'])->exists()) {
                continue;
            }

            $this->db()->table('platform_landing_popups')->insert(['id' => (string) Str::uuid7(), 'code' => $seed['code'], ...$values, 'views' => $seed['views'], 'conversions' => $seed['conversions'], 'created_at' => now()]);
        }
    }

    private function subscribers(): void
    {
        foreach (self::SUBSCRIBERS as $seed) {
            $hash = Visitor::stableHash($seed['email']);

            if ($this->db()->table('platform_newsletter_subscribers')->where('site', 'kipucontrol')->where('email_hash', $hash)->exists()) {
                continue;
            }

            $at = $this->moment($seed['at']);
            $this->db()->table('platform_newsletter_subscribers')->insert([
                'id' => (string) Str::uuid7(),
                'email' => Crypt::encryptString($seed['email']),
                'email_hash' => $hash,
                'site' => 'kipucontrol',
                'source' => $seed['source'],
                'status' => $seed['status'],
                'token_hash' => hash('sha256', Str::random(48)),
                'consent_text' => LandingNewsletter::CONSENT,
                'confirmation_sent_at' => $at,
                'confirmed_at' => $seed['status'] === 'pendiente' ? null : $at->copy()->addMinutes(12),
                'unsubscribed_at' => $seed['status'] === 'baja' ? $at->copy()->addDays(20) : null,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        }
    }

    private function moment(string $value): Carbon
    {
        $shift = Carbon::parse(self::LANDING_TODAY)->diffInDays(Carbon::today('America/Lima'), false);

        return Carbon::parse($value, 'America/Lima')->addDays((int) $shift)->utc();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
