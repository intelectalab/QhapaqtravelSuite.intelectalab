<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Integrations\Contracts\SiteContentAi;
use App\Domain\Platform\Models\Tenant;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class SiteTemplatesSeeder
{
    use SeedsTenant;

    public const ORDER = 80;

    private const TEAM = 'Equipo KipuControl';

    private const PARTNER = 'Estudio Wayra (partner)';

    private const PAGES = ['inicio', 'buscar', 'destino', 'tour', 'carrito', 'checkout', 'blog', 'articulo', 'aventuras', 'contacto', 'legal', 'libro_reclamaciones'];

    private const TEMPLATES = [
        ['TPL-ACTUAL', 'actual', 'Actual', 'agencia', 'incluida', 0, null, 'equipo', self::TEAM, 'publicado', true,
            'El diseño con el que nace el sitio de cada agencia: portada con buscador, destinos, tours destacados, ofertas, salidas grupales y opiniones, con los colores de su marca.',
            ['Recomendada', 'Paquetes', 'Multidestino'],
            ['1.0.0', 'actual', ['side' => '#141a33', 'accent' => '#b3263e', 'sun' => '#f2b33d', 'radius' => 12], ['hero_buscador', 'destinos', 'mas_vendidos', 'ofertas', 'salidas', 'resenas', 'boletin'], [85, 95, 95, 90], false]],
        ['TPL-ANDES', 'andes-clasico', 'Andes Clásico', 'agencia', 'incluida', 0, null, 'equipo', self::TEAM, 'publicado', false,
            'Versión 3.0 diseñada en Stitch: azul marino y dorado, títulos con serif, hero centrado con buscador de vidrio, destinos en mosaico, salidas en tabla y Libro de Reclamaciones destacado.',
            ['Paquetes', 'Multidestino', 'Nuevo 3.0'],
            ['3.0.0', 'andes', ['side' => '#0F2747', 'accent' => '#0E5DB5', 'soft' => '#E3EEFB', 'sun' => '#F2B33D', 'radius' => 12, 'font' => ['display' => 'Noto Serif', 'body' => 'Plus Jakarta Sans']], ['hero_buscador', 'destinos', 'mas_vendidos', 'salidas', 'ofertas', 'resenas', 'blog', 'boletin'], [94, 100, 100, 96], true]],
        ['TPL-INTI', 'inti-raymi', 'Inti Raymi', 'agencia', 'incluida', 0, null, 'equipo', self::TEAM, 'publicado', false,
            'Rojo carmín y dorado del sol, bandas textiles y esquinas escalonadas. Para agencias de cultura y fiestas.',
            ['Cultura', 'Peruano', 'Textil'],
            ['1.4.0', null, ['side' => '#7E1526', 'accent' => '#C8102E', 'soft' => '#FBEDE6', 'sun' => '#E3A33B', 'radius' => 18], ['hero_buscador', 'destinos', 'mas_vendidos', 'resenas', 'aventuras', 'blog'], [92, 98, 100, 96], true]],
        ['TPL-AMAZONIA', 'amazonia', 'Amazonía', 'aventura', 'incluida', 0, null, 'equipo', self::TEAM, 'publicado', false,
            'Verdes profundos y acentos de guacamayo. Foto grande, itinerario día por día y nivel de dificultad visible.',
            ['Aventura', 'Naturaleza', 'Trekking'],
            ['1.1.2', null, ['side' => '#0F3D2E', 'accent' => '#1F7A4D', 'soft' => '#E3F3EA', 'sun' => '#F2A93B', 'radius' => 14], ['hero_video', 'experiencias', 'mas_vendidos', 'salidas', 'resenas', 'blog'], [91, 97, 100, 96], true]],
        ['TPL-PACIFICO', 'pacifico', 'Pacífico', 'corporativo', 'incluida', 0, 'professional', 'equipo', self::TEAM, 'publicado', false,
            'Azul océano y arena, tipografía limpia y mucho aire. Para viajes corporativos, incentivos y MICE.',
            ['Corporativo', 'MICE', 'Minimalista'],
            ['1.0.4', null, ['side' => '#0B2E4A', 'accent' => '#1F5F8B', 'soft' => '#E4EFF7', 'sun' => '#D9B27A', 'radius' => 8], ['hero_simple', 'servicios', 'casos', 'cotizar', 'clientes', 'blog'], [97, 100, 100, 100], true]],
        ['TPL-CHAKANA', 'chakana-free-tours', 'Chakana Free Tours', 'free_tour', 'incluida', 0, null, 'equipo', self::TEAM, 'publicado', false,
            'Pensada para free tours: horarios del día primero, reserva con nombre y correo, punto de encuentro con mapa y propina sugerida.',
            ['Free tours', 'Guías', 'Móvil primero'],
            ['1.0.0', null, ['side' => '#3A1208', 'accent' => '#B8432E', 'soft' => '#FBEAE2', 'sun' => '#E3A33B', 'radius' => 20], ['horarios_hoy', 'tours', 'punto_encuentro', 'resenas', 'blog'], [98, 100, 100, 100], true]],
        ['TPL-NAZCA', 'nazca-noche', 'Nazca Noche', 'lujo', 'premium', 290, 'starter', 'partner', self::PARTNER, 'publicado', false,
            'Fondo oscuro, líneas geométricas inspiradas en las líneas de Nazca y fotografía a pantalla completa. Para viajes de lujo y a medida.',
            ['Lujo', 'A medida', 'Premium'],
            ['1.2.0', null, ['side' => '#14110F', 'accent' => '#B8935A', 'soft' => '#2A241D', 'sun' => '#D9B27A', 'radius' => 4], ['hero_foto', 'colecciones', 'a_medida', 'testimonios', 'prensa'], [89, 96, 100, 92], true]],
        ['TPL-QHAPAQ', 'qhapaq-nan', 'Qhapaq Ñan', 'multi', 'premium', 290, 'starter', 'partner', self::PARTNER, 'en_revision', false,
            'Mapa de rutas como protagonista: el viajero arma su circuito sobre el camino inca. Pensada para el armador de viajes por tramos.',
            ['Circuitos', 'Mapa', 'Tramos'],
            ['1.0.0', null, ['side' => '#2B2A1F', 'accent' => '#8C6D2C', 'soft' => '#F3ECDD', 'sun' => '#C9A24A', 'radius' => 10], ['mapa_rutas', 'armar_viaje', 'mas_vendidos', 'resenas'], [88, 96, 100, 92], true]],
    ];

    private const PACKS = [
        ['IA-BASICO', 'IA Básico', 'contenido', 300, 59, 'mensual', 'ai_content'],
        ['IA-PRO', 'IA Pro', 'contenido', 1000, 149, 'mensual', 'ai_content'],
        ['IA-CONT-EXTRA-200', '200 créditos de contenido', 'contenido', 200, 39, 'unico', 'ai_content'],
        ['IA-IMG-20', '20 imágenes', 'imagenes', 20, 39, 'unico', 'ai_images'],
        ['IA-IMG-60', '60 imágenes', 'imagenes', 60, 99, 'unico', 'ai_images'],
        ['IA-IMG-MES', '30 imágenes al mes', 'imagenes', 30, 49, 'mensual', 'ai_images'],
    ];

    private const SUBMISSIONS = [
        ['TSB-0005', 'TPL-PACIFICO', '1.1.0', '2026-09-05 18:40', 'rechazada', '2026-09-06 10:15', 'Contraste del botón secundario 3,1:1 (mínimo 4,5:1) y LCP de 3,4 s en móvil (máximo 2,5 s).', [78, 91, 100, 96], ['contraste' => 'falla', 'revision_visual' => 'pendiente']],
        ['TSB-0006', 'TPL-NAZCA', '1.2.0', '2026-09-12 11:00', 'aprobada', '2026-09-14 09:30', null, [89, 96, 100, 92], ['revision_visual' => 'ok']],
        ['TSB-0007', 'TPL-QHAPAQ', '1.0.0', '2026-09-28 15:20', 'validando', null, null, [88, 96, 100, 92], ['revision_visual' => 'pendiente']],
    ];

    private ?string $operator = null;

    private array $templateIds = [];

    private array $packIds = [];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->operator = DB::table('platform_users')->orderBy('created_at')->value('id');
        $this->templates();
        $this->submissions();
        $this->packs();
        $this->theme();
        $this->content();
    }

    private function templates(): void
    {
        foreach (self::TEMPLATES as [$code, $slug, $name, $category, $tier, $price, $minPlan, $authorKind, $author, $status, $default, $description, $tags, [$version, $style, $tokens, $sections, $lighthouse, $measured]]) {
            $id = DB::table('platform_site_templates')->where('code', $code)->value('id') ?? (string) Str::uuid7();
            $values = ['slug' => $slug, 'name' => $name, 'description' => $description, 'category' => $category, 'tier' => $tier, 'price_once' => $price, 'min_plan_code' => $minPlan, 'author_kind' => $authorKind, 'author_name' => $author, 'default_for_new' => false, 'tags' => '{'.implode(',', array_map(fn (string $tag): string => '"'.$tag.'"', $tags)).'}'];

            if (DB::table('platform_site_templates')->where('id', $id)->exists()) {
                DB::table('platform_site_templates')->where('id', $id)->update($values);
            } else {
                DB::table('platform_site_templates')->insert(['id' => $id, 'code' => $code, ...$values, 'status' => 'borrador', 'installs' => 0]);
            }

            $published = $status === 'publicado';
            $manifest = ['id' => $slug, 'name' => $name, 'version' => $version, 'kipu' => '^2.9', 'category' => $category, 'tier' => $tier, 'author' => ['name' => $author], 'tokens' => $tokens, 'sections' => $sections, 'pages' => self::PAGES, 'locales' => ['es', 'en', 'pt'], 'darkMode' => true, ...($style !== null ? ['site_style' => $style] : []), ...($measured ? [] : ['lighthouse_measured' => false])];
            $json = json_encode($manifest, JSON_UNESCAPED_UNICODE);
            $versionId = DB::table('platform_site_template_versions')->where('template_id', $id)->where('version', $version)->value('id') ?? (string) Str::uuid7();
            $versionValues = [
                'manifest' => $json,
                'bundle_path' => 'kipu-site-templates/'.$slug.'/'.$slug.'-'.$version.'.tgz',
                'bundle_sha256' => hash('sha256', (string) $json),
                'changelog' => $published ? 'Versión publicada en la galería.' : 'Primera versión enviada a revisión.',
                'status' => $published ? 'publicada' : 'candidata',
                'lh_performance' => $lighthouse[0],
                'lh_accessibility' => $lighthouse[1],
                'lh_seo' => $lighthouse[2],
                'lh_best_practices' => $lighthouse[3],
                'approved_by' => $published ? $this->operator : null,
                'published_at' => $published ? $this->moment('2026-09-01 09:00') : null,
            ];

            if (DB::table('platform_site_template_versions')->where('id', $versionId)->exists()) {
                DB::table('platform_site_template_versions')->where('id', $versionId)->update($versionValues);
            } else {
                DB::table('platform_site_template_versions')->insert(['id' => $versionId, 'template_id' => $id, 'version' => $version, ...$versionValues]);
            }

            DB::table('platform_site_templates')->where('id', $id)->update(['status' => $status, 'current_version_id' => $published ? $versionId : null]);
            $this->templateIds[$code] = $id;
        }

        DB::table('platform_site_templates')->where('id', $this->templateIds['TPL-ACTUAL'])->update(['default_for_new' => true]);
    }

    private function submissions(): void
    {
        foreach (self::SUBMISSIONS as [$code, $template, $version, $at, $status, $decidedAt, $reason, $lighthouse, $overrides]) {
            $templateId = $this->templateIds[$template];
            $checks = ['manifest' => 'ok', 'build' => 'ok', 'lighthouse' => ['performance' => $lighthouse[0], 'accessibility' => $lighthouse[1], 'seo' => $lighthouse[2], 'best_practices' => $lighthouse[3]], 'contraste' => 'ok', 'i18n' => 'ok', 'datos_estructurados' => 'ok', 'seguridad' => 'ok', ...$overrides];

            if ($status === 'rechazada' && ! DB::table('platform_site_template_versions')->where('template_id', $templateId)->where('version', $version)->exists()) {
                $base = DB::table('platform_site_template_versions')->where('template_id', $templateId)->orderByDesc('created_at')->first();
                DB::table('platform_site_template_versions')->insert(['id' => (string) Str::uuid7(), 'template_id' => $templateId, 'version' => $version, 'manifest' => $base->manifest, 'bundle_path' => str_replace((string) $base->version, $version, (string) $base->bundle_path), 'bundle_sha256' => hash('sha256', $code), 'changelog' => 'Versión rechazada en revisión.', 'status' => 'retirada', 'lh_performance' => $lighthouse[0], 'lh_accessibility' => $lighthouse[1], 'lh_seo' => $lighthouse[2], 'lh_best_practices' => $lighthouse[3]]);
            }

            $values = ['template_id' => $templateId, 'version' => $version, 'submitted_by' => null, 'submitted_by_name' => DB::table('platform_site_templates')->where('id', $templateId)->value('author_name'), 'status' => $status, 'checks' => json_encode($checks), 'reviewer_id' => $decidedAt ? $this->operator : null, 'decided_at' => $decidedAt ? $this->moment($decidedAt) : null, 'reject_reason' => $reason, 'created_at' => $this->moment($at)];

            if (DB::table('platform_template_submissions')->where('code', $code)->exists()) {
                DB::table('platform_template_submissions')->where('code', $code)->update($values);
            } else {
                DB::table('platform_template_submissions')->insert(['id' => (string) Str::uuid7(), 'code' => $code, ...$values]);
            }
        }
    }

    private function packs(): void
    {
        foreach (self::PACKS as [$code, $name, $kind, $credits, $price, $billing, $addon]) {
            $values = ['name' => $name, 'kind' => $kind, 'credits' => $credits, 'price' => $price, 'currency' => 'PEN', 'billing' => $billing, 'addon_code' => $addon, 'active' => true];
            $existing = DB::table('platform_ai_credit_packs')->where('code', $code)->value('id');

            if ($existing !== null) {
                DB::table('platform_ai_credit_packs')->where('id', $existing)->update($values);
                $this->packIds[$code] = (string) $existing;
            } else {
                $this->packIds[$code] = (string) Str::uuid7();
                DB::table('platform_ai_credit_packs')->insert(['id' => $this->packIds[$code], 'code' => $code, ...$values]);
            }
        }
    }

    private function theme(): void
    {
        $template = $this->templateIds['TPL-ACTUAL'];
        $version = DB::table('platform_site_templates')->where('id', $template)->value('current_version_id');

        if (DB::table('cms_site_themes')->where('tenant_id', $this->tenant->getKey())->where('status', 'activo')->exists()) {
            return;
        }

        DB::table('cms_site_themes')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->tenant->getKey(), 'template_id' => $template, 'template_version_id' => $version, 'status' => 'activo', 'tokens' => json_encode(['side' => '#141a33', 'accent' => '#b3263e', 'sun' => '#f2b33d', 'radius' => 12]), 'sections' => '[]', 'chosen_by' => 'alta', 'applied_by' => $this->userId('U01'), 'applied_at' => $this->tenant->created_at ?? now(), 'lock_version' => 1]);
        DB::table('platform_site_templates')->where('id', $template)->update(['installs' => DB::table('tenants')->count()]);
    }

    private function content(): void
    {
        if (DB::table('cms_ai_content_jobs')->where('tenant_id', $this->tenant->getKey())->exists()) {
            return;
        }

        $tenantId = (string) $this->tenant->getKey();
        $agency = (string) $this->tenant->commercial_name;
        $humantay = DB::table('catalog_products')->where('tenant_id', $tenantId)->where('code', 'CUS-HUM-FD')->first();
        $machu = DB::table('catalog_products')->where('tenant_id', $tenantId)->where('code', 'CUS-MAPI-2D')->first();
        $this->ledger('contenido', 'asignacion_plan', 100, null, null, 'Incluido en el plan Enterprise', '2026-09-01 00:00');
        $this->ledger('contenido', 'asignacion_plan', 300, $this->packIds['IA-BASICO'], null, 'Plan IA Básico · PEN 59.00 al mes', '2026-09-01 00:01');
        $this->ledger('imagenes', 'compra_paquete', 20, $this->packIds['IA-IMG-20'], null, 'Paquete 20 imágenes · PEN 39.00', '2026-09-08 11:20');

        if ($humantay !== null) {
            $translation = $this->job('IAC-0040', 'traducir', 'producto', $humantay->id, 'en', 'aventurero', 'descartado', 3, '2026-09-24 17:30', 'U01',
                ['label' => $humantay->name, 'code' => $humantay->code, 'before' => ['text' => (string) $humantay->short_description]],
                ['text' => 'Hike to turquoise Humantay Lake with breakfast and buffet lunch included.']);
            $this->ledger('contenido', 'consumo', -3, null, $translation, 'IAC-0040', '2026-09-24 17:30');
            $seo = $this->job('IAC-0042', 'meta_seo', 'producto', $humantay->id, 'es', 'aventurero', 'listo', 1, '2026-09-27 10:12', 'U02',
                ['label' => $humantay->name, 'code' => $humantay->code, 'before' => ['title' => (string) ($humantay->seo_title ?: $humantay->name), 'desc' => (string) ($humantay->seo_description ?? '')]],
                ['title' => mb_substr($humantay->name.' desde Cusco | '.$agency, 0, 60), 'desc' => 'Camine a la laguna turquesa a 4 200 m con guía, desayuno y almuerzo. Salida 4:00 a. m. desde su hotel en Cusco. Reserve en línea.']);
            $this->ledger('contenido', 'consumo', -1, null, $seo, 'IAC-0042', '2026-09-27 10:12');
        }

        if ($machu !== null) {
            $text = $this->job('IAC-0041', 'mejorar_texto', 'producto', $machu->id, 'es', 'cercano', 'listo', 2, '2026-09-27 10:30', 'U02',
                ['label' => $machu->name, 'code' => $machu->code, 'before' => ['text' => (string) $machu->short_description]],
                ['text' => 'Viva Machu Picchu sin prisas: el primer día viaja en tren por el valle del Urubamba y duerme en Aguas Calientes; al amanecer del segundo sube en el primer bus y recorre la ciudadela con su guía antes de que llegue la multitud.']);
            $this->ledger('contenido', 'consumo', -2, null, $text, 'IAC-0041', '2026-09-27 10:30');
        }

        $this->images();
    }

    private function images(): void
    {
        $prompt = 'Grupo de viajeros caminando por el camino inca al amanecer, montañas nevadas al fondo, luz cálida';
        $id = $this->job('IAC-0043', 'imagen', 'libre', null, 'es', null, 'listo', 6, '2026-09-28 16:05', 'U01', null, null, ['prompt' => $prompt, 'style' => 'fotografico', 'count' => 4, 'quality' => 'hd', 'cost' => 6]);
        $ai = app(SiteContentAi::class);
        $disk = (string) config('filesystems.default');
        $rows = [
            ['Viajeros en el camino inca al amanecer con nevados al fondo', 2048, 'en_uso', ['Banner de inicio'], 2],
            ['Grupo de caminantes en un sendero andino con luz cálida', 2048, 'generada', [], 2],
            ['Vista amplia de montañas nevadas y un sendero de piedra', 1024, 'generada', [], 1],
            ['Silueta de viajeros contra el cielo naranja del amanecer', 1024, 'descartada', [], 1],
        ];
        $images = [];

        foreach ($rows as $index => [$alt, $width, $status, $usedIn, $credits]) {
            $imageId = (string) Str::uuid7();
            $path = 'tenants/'.$this->tenant->getKey().'/ai-images/'.$imageId.'.svg';
            Storage::disk($disk)->put($path, $ai->draw($prompt, 'fotografico', $width, (int) round($width * 0.6), $index));
            DB::table('cms_ai_images')->insert(['id' => $imageId, 'tenant_id' => $this->tenant->getKey(), 'job_id' => $id, 'prompt' => $prompt, 'style' => 'fotografico', 'width' => $width, 'height' => (int) round($width * 0.6), 'file_path' => $path, 'alt_text' => $alt, 'ai_label' => true, 'credits_used' => $credits, 'status' => $status, 'used_in' => json_encode($usedIn, JSON_UNESCAPED_UNICODE), 'created_by' => $this->userId('U01'), 'created_at' => $this->moment('2026-09-28 16:05')]);
            $images[] = $imageId;
        }

        DB::table('cms_ai_content_jobs')->where('id', $id)->update(['output' => json_encode(['images' => $images, 'provider' => 'fake'])]);
        $this->ledger('imagenes', 'consumo', -6, null, $id, 'IAC-0043 · 4 imágenes HD', '2026-09-28 16:05');
    }

    private function job(string $code, string $kind, string $type, ?string $targetId, string $locale, ?string $tone, string $status, int $credits, string $at, string $user, ?array $source, ?array $after, ?array $input = null): string
    {
        $id = (string) Str::uuid7();
        DB::table('cms_ai_content_jobs')->insert([
            'id' => $id,
            'tenant_id' => $this->tenant->getKey(),
            'code' => $code,
            'kind' => $kind,
            'target_type' => $type,
            'target_id' => $targetId,
            'locale' => $locale,
            'tone' => $tone,
            'input' => json_encode($input ?? ['source' => $source, 'notes' => null, 'cost' => $credits, 'attempt' => 0], JSON_UNESCAPED_UNICODE),
            'output' => json_encode($after !== null ? ['after' => $after, 'provider' => 'fake', 'warning' => 'Revise cifras, horarios y precios antes de aplicar.'] : ['images' => []], JSON_UNESCAPED_UNICODE),
            'status' => $status,
            'credits_used' => $credits,
            'created_by' => $this->userId($user),
            'created_at' => $this->moment($at),
            'updated_at' => $this->moment($at),
        ]);

        return $id;
    }

    private function ledger(string $kind, string $movement, int $credits, ?string $packId, ?string $jobId, string $note, string $at): void
    {
        $balance = (int) (DB::table('fin_ai_credit_ledger')->where('tenant_id', $this->tenant->getKey())->where('kind', $kind)->orderByDesc('occurred_at')->orderByDesc('id')->value('balance_after') ?? 0);
        DB::table('fin_ai_credit_ledger')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->tenant->getKey(), 'kind' => $kind, 'movement' => $movement, 'credits' => $credits, 'balance_after' => $balance + $credits, 'pack_id' => $packId, 'job_id' => $jobId, 'note' => $note, 'occurred_at' => $this->moment($at), 'created_by' => $this->userId('U01')]);
    }
}
