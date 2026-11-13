<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Showcase\Contracts\DomainProvisioner;
use App\Domain\Showcase\Support\PgArray;
use App\Domain\Showcase\Support\SeoAuditor;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageSiteBrand
{
    public const PURPOSES = ['principal', 'reservas', 'blog', 'aventuras', 'portal'];

    public function __construct(private readonly DomainProvisioner $provisioner, private readonly AuditLogger $audit) {}

    public function addDomain(array $data, User $actor): array
    {
        $host = Str::lower(trim((string) $data['host']));
        $sitesDomain = (string) config('sites.domain');

        if ($sitesDomain !== '' && Str::endsWith($host, '.'.$sitesDomain)) {
            throw ApiException::unprocessable('VT-11', 'Ese subdominio ya es de KipuControl. Agrega un dominio propio de la agencia.', ['field' => 'host']);
        }

        $id = (string) Str::uuid7();
        $token = Str::lower(Str::random(24));

        try {
            DB::transaction(fn () => DB::table('cms_site_domains')->insert([
                'id' => $id,
                'host' => $host,
                'purpose' => $data['purpose'] ?? 'principal',
                'status' => 'pendiente_dns',
                'verify_token' => $token,
                'ssl_status' => 'pendiente',
                'created_by' => $actor->getKey(),
            ]));
        } catch (QueryException $e) {
            if ($e->getCode() === '23505') {
                throw ApiException::conflict('VT-11', 'Ese dominio ya está registrado en KipuControl. Un dominio pertenece a una sola agencia.');
            }

            throw $e;
        }

        $this->audit->log('Dominio', $host, 'agregar', null, $data['purpose'] ?? 'principal');

        return ['id' => $id, 'host' => $host, 'status' => 'pendiente_dns', 'dns' => self::dns($host, $token)];
    }

    public function verify(string $id): array
    {
        $domain = $this->domain($id);

        if (in_array($domain->status, ['verificado', 'retirado'], true)) {
            throw ApiException::conflict('VT-11', $domain->status === 'retirado' ? 'El dominio fue retirado. Agrégalo de nuevo si lo necesitas.' : 'El dominio ya está verificado.');
        }

        $check = $this->provisioner->verify((string) $domain->host, (string) $domain->verify_token);

        if (! $check['ok']) {
            DB::table('cms_site_domains')->where('id', $domain->id)->update(['status' => 'error', 'last_error' => $check['error'], 'last_check_at' => now(), 'updated_at' => now()]);
            $this->audit->log('Dominio', (string) $domain->host, 'verificar', $domain->status, 'error');

            return ['id' => $domain->id, 'status' => 'error', 'ssl_status' => $domain->ssl_status, 'error' => $check['error']];
        }

        $certificate = $this->provisioner->issueCertificate((string) $domain->host);
        DB::table('cms_site_domains')->where('id', $domain->id)->update([
            'status' => 'verificado',
            'verified_at' => now(),
            'ssl_status' => $certificate['ok'] ? 'emitido' : 'error',
            'ssl_expires_at' => $certificate['ok'] ? Carbon::parse($certificate['expires_at']) : null,
            'last_error' => $certificate['ok'] ? null : $certificate['error'],
            'last_check_at' => now(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Dominio', (string) $domain->host, 'verificar', $domain->status, 'verificado · SSL '.($certificate['ok'] ? 'emitido' : 'con error'));

        return ['id' => $domain->id, 'status' => 'verificado', 'ssl_status' => $certificate['ok'] ? 'emitido' : 'error', 'error' => null];
    }

    public function retire(string $id): void
    {
        $domain = $this->domain($id);

        if ($domain->status === 'retirado') {
            throw ApiException::conflict('VT-11', 'El dominio ya estaba retirado.');
        }

        DB::table('cms_site_domains')->where('id', $domain->id)->update(['status' => 'retirado', 'updated_at' => now()]);
        $this->audit->log('Dominio', (string) $domain->host, 'retirar', $domain->status, 'retirado');
    }

    public function updatePage(string $id, array $data): array
    {
        $page = $this->page($id);
        $merged = [
            'title' => $data['title'] ?? $page->title,
            'meta_description' => array_key_exists('meta_description', $data) ? $data['meta_description'] : $page->meta_description,
            'focus_keyword' => array_key_exists('focus_keyword', $data) ? $data['focus_keyword'] : $page->focus_keyword,
            'schema_types' => $data['schema_types'] ?? PgArray::parse($page->schema_json),
            'canonical_url' => array_key_exists('canonical_url', $data) ? $data['canonical_url'] : $page->canonical_url,
            'indexable' => $data['indexable'] ?? (bool) $page->indexable,
        ];
        $result = SeoAuditor::audit([...(array) $page, ...$merged]);
        DB::table('cms_seo_pages')->where('id', $page->id)->update([
            ...$merged,
            'schema_types' => PgArray::literal($merged['schema_types']),
            'score' => $result['score'],
            'issues' => json_encode($result['issues'], JSON_UNESCAPED_UNICODE),
            'audited_at' => now(),
            'updated_at' => now(),
        ]);
        $this->audit->log('SEO', (string) $page->path, 'editar', (string) ($page->score ?? '—'), (string) $result['score']);

        return ['id' => $page->id, 'score' => $result['score'], 'before' => $page->score === null ? null : (int) $page->score];
    }

    public function audit(): array
    {
        $created = $this->syncStoryPages();
        $pages = DB::table('cms_seo_pages')->get(['*', DB::raw('array_to_json(schema_types) as schema_json')]);

        foreach ($pages as $page) {
            $result = SeoAuditor::audit([...(array) $page, 'schema_types' => PgArray::parse($page->schema_json)]);
            DB::table('cms_seo_pages')->where('id', $page->id)->update(['score' => $result['score'], 'issues' => json_encode($result['issues'], JSON_UNESCAPED_UNICODE), 'audited_at' => now(), 'updated_at' => now()]);
        }

        $average = $pages->isEmpty() ? null : (int) round((float) DB::table('cms_seo_pages')->avg('score'));
        $this->audit->log('SEO', 'sitio', 'reauditar', null, "{$pages->count()} páginas · puntaje medio ".($average ?? '—'));

        return ['pages' => $pages->count(), 'created' => $created, 'average' => $average];
    }

    public function addRedirect(array $data, User $actor): array
    {
        $from = '/'.ltrim(trim((string) $data['from_path']), '/');
        $to = trim((string) $data['to_path']);

        if (! Str::startsWith($to, ['/', 'https://'])) {
            throw ApiException::unprocessable('VT-REDIRECT', 'El destino empieza con / o con https://.', ['field' => 'to_path']);
        }

        if ($from === $to) {
            throw ApiException::unprocessable('VT-REDIRECT', 'El origen y el destino no pueden ser iguales.', ['field' => 'to_path']);
        }

        $active = DB::table('cms_redirects')->where('active', true);

        if ((clone $active)->where('from_path', $to)->exists() || (clone $active)->where('to_path', $from)->exists()) {
            throw ApiException::unprocessable('VT-REDIRECT-CHAIN', 'Esa redirección formaría una cadena. Apunta directo a la página final.', ['field' => 'to_path']);
        }

        if ((clone $active)->where('from_path', $from)->exists()) {
            throw ApiException::conflict('VT-REDIRECT', 'Ya hay una redirección activa desde esa ruta.');
        }

        $id = (string) Str::uuid7();
        DB::table('cms_redirects')->insert(['id' => $id, 'from_path' => $from, 'to_path' => $to, 'code' => (int) ($data['code'] ?? 301), 'active' => true, 'created_by' => $actor->getKey()]);
        $this->audit->log('Redirección', $from, 'crear', null, "{$to} · ".($data['code'] ?? 301));

        return ['id' => $id, 'from_path' => $from, 'to_path' => $to];
    }

    public function deactivateRedirect(string $id): void
    {
        $redirect = Str::isUuid($id) ? DB::table('cms_redirects')->where('id', $id)->first() : null;

        if ($redirect === null) {
            throw ApiException::notFound('La redirección no existe.');
        }

        if (! $redirect->active) {
            throw ApiException::conflict('VT-REDIRECT', 'La redirección ya estaba desactivada.');
        }

        DB::table('cms_redirects')->where('id', $redirect->id)->update(['active' => false, 'updated_at' => now()]);
        $this->audit->log('Redirección', (string) $redirect->from_path, 'desactivar', (string) $redirect->to_path, null);
    }

    public static function dns(string $host, string $token): array
    {
        return [
            ['type' => 'TXT', 'name' => '_kipu-verify.'.$host, 'value' => 'kipu-verify='.$token],
            ['type' => 'CNAME', 'name' => $host, 'value' => 'sites.kipucontrol.com'],
        ];
    }

    private function syncStoryPages(): int
    {
        $existing = DB::table('cms_seo_pages')->pluck('path')->flip();
        $stories = DB::table('cms_travel_stories')->where('status', 'publicado')->get(['slug', 'title', 'quote', 'body', 'photo_count']);
        $created = 0;
        $pages = $stories->map(fn (object $s) => ['path' => '/aventuras/'.$s->slug, 'title' => mb_substr((string) $s->title, 0, 120), 'meta_description' => $s->quote ? mb_substr((string) $s->quote, 0, 320) : null, 'word_count' => count(preg_split('/\s+/u', trim(strip_tags((string) $s->body.' '.$s->quote)), -1, PREG_SPLIT_NO_EMPTY) ?: []), 'images' => (int) $s->photo_count, 'images_with_alt' => (int) $s->photo_count, 'schema_types' => '{BlogPosting}', 'h1_count' => 1]);

        if ($stories->isNotEmpty()) {
            $pages->prepend(['path' => '/aventuras', 'title' => 'Aventuras de nuestros viajeros', 'meta_description' => null, 'word_count' => 0, 'images' => 0, 'images_with_alt' => 0, 'schema_types' => '{CollectionPage}', 'h1_count' => 1]);
        }

        foreach ($pages as $page) {
            if (! $existing->has($page['path'])) {
                DB::table('cms_seo_pages')->insert(['id' => (string) Str::uuid7(), ...$page]);
                $created++;
            }
        }

        return $created;
    }

    private function domain(string $id): object
    {
        $domain = Str::isUuid($id) ? DB::table('cms_site_domains')->where('id', $id)->first() : null;

        return $domain ?? throw ApiException::notFound('El dominio no existe.');
    }

    private function page(string $id): object
    {
        $page = Str::isUuid($id) ? DB::table('cms_seo_pages')->where('id', $id)->first(['*', DB::raw('array_to_json(schema_types) as schema_json')]) : null;

        return $page ?? throw ApiException::notFound('La página no existe.');
    }
}
