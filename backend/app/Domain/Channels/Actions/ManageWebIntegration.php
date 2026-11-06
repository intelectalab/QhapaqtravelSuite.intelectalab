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

        $product = DB::table('catalog_products')->where('code', $data['product'])->value('ref');
        $before = json_decode((string) $config->defaults, true) ?: [];
        $after = [...$before, ...$data, 'product' => $product ?? $data['product'], 'reviews' => (bool) ($data['reviews'] ?? false), 'radius' => (int) $data['radius']];

        DB::table('channel_widget_config')->where('id', $config->id)->update([
            'defaults' => json_encode($after, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Widget web', 'predeterminados', 'editar', $before['method'] ?? null, "{$after['method']} · {$after['lang']} · {$after['currency']}");
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
            'verify_token' => 'qhapaq-verify='.Str::lower(Str::random(8)),
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
