<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageWebIntegration
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function saveDefaults(array $data, User $actor): void
    {
        $config = DB::table('channel_widget_config')->first(['id', 'defaults']);

        if ($config === null) {
            throw ApiException::conflict('WEB-BR-01', 'El widget todavía no está configurado para esta agencia.');
        }

        $before = json_decode((string) $config->defaults, true) ?: [];
        $mode = ($data['mode'] ?? $before['mode'] ?? 'producto') === 'catalogo' ? 'catalogo' : 'producto';
        $code = $data['product'] ?? null;
        $product = $code !== null ? DB::table('catalog_products')->where('code', $code)->value('ref') : null;
        $category = isset($data['category']) && trim((string) $data['category']) !== '' ? trim((string) $data['category']) : null;

        if ($category !== null && ! DB::table('catalog_product_categories')->where('name', $category)->exists()) {
            throw ApiException::unprocessable('WEB-BR-04', 'Esa categoría no existe en el catálogo.', ['category' => ['Esa categoría no existe en el catálogo.']]);
        }

        $after = [...$before, ...$data, 'mode' => $mode, 'category' => $mode === 'catalogo' ? $category : null, 'product' => $product ?? $code ?? ($before['product'] ?? null), 'reviews' => (bool) ($data['reviews'] ?? false), 'radius' => (int) $data['radius']];

        DB::table('channel_widget_config')->where('id', $config->id)->update([
            'defaults' => json_encode($after, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Widget web', 'predeterminados', 'editar', $before['method'] ?? null, "{$after['method']} · {$mode} · {$after['lang']} · {$after['currency']}");
    }

    public function rotateKey(string $reason, User $actor): array
    {
        $config = DB::table('channel_widget_config')->lockForUpdate()->first(['id', 'public_key', 'tenant_slug']);

        if ($config === null) {
            throw ApiException::conflict('WEB-BR-01', 'El widget todavía no está configurado para esta agencia.');
        }

        $prefix = substr((string) preg_replace('/[^a-z0-9]/', '', mb_strtolower((string) $config->tenant_slug)), 0, 4) ?: 'qh';
        $key = 'pk_live_'.$prefix.'_'.Str::random(16);
        $until = now()->addHours((int) config('widget.key_grace_hours', 24));

        DB::table('channel_widget_config')->where('id', $config->id)->update([
            'public_key' => $key,
            'public_key_prev' => $config->public_key,
            'prev_expires_at' => $until,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Widget web', 'clave_publica', 'regenerar_clave', self::mask((string) $config->public_key), self::mask($key)." · motivo: {$reason}", evidence: ['reason' => $reason, 'grace_until' => $until->toIso8601String()]);

        return ['public_key' => $key, 'previous_key_until' => $until->toIso8601String()];
    }

    private static function mask(string $key): string
    {
        return substr($key, 0, 12).'…';
    }

    public function addDomain(string $domain, ?string $cms, User $actor): void
    {
        $domain = mb_strtolower(trim($domain));

        if (DB::table('channel_widget_domains')->where('domain', $domain)->exists()) {
            throw ApiException::conflict('WEB-BR-02', 'Ese dominio ya está registrado.');
        }

        DB::table('channel_widget_domains')->insert([
            'domain' => $domain,
            'cms' => $cms,
            'status' => 'pendiente',
            'verify_token' => 'kipucontrol-verify='.Str::lower(Str::random(8)),
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);

        $this->audit->log('Dominio del widget', $domain, 'crear', null, 'pendiente');
    }

    public function verifyDomain(string $id, User $actor): void
    {
        $row = DB::table('channel_widget_domains')->where('id', $id)->first(['domain', 'status']);

        if ($row === null) {
            throw ApiException::notFound('El dominio no existe.');
        }

        if ($row->status === 'verificado') {
            throw ApiException::conflict('WEB-BR-03', 'El dominio ya está verificado.');
        }

        DB::table('channel_widget_domains')->where('id', $id)->update(['status' => 'verificado', 'verified_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Dominio del widget', $row->domain, 'verificar', 'pendiente', 'verificado');
    }

    public function removeDomain(string $id): void
    {
        $row = DB::table('channel_widget_domains')->where('id', $id)->first(['domain', 'status']);

        if ($row === null) {
            throw ApiException::notFound('El dominio no existe.');
        }

        DB::table('channel_widget_domains')->where('id', $id)->delete();
        $this->audit->log('Dominio del widget', $row->domain, 'quitar', $row->status, null);
    }
}
