<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Actions;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Showcase\Support\FunnelRecorder;
use App\Domain\Showcase\Support\ShowcaseSequence;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageShowcaseAgencies
{
    public const ACTIONS = [
        'verificar' => [['en_revision', 'rechazada'], 'activa'],
        'rechazar' => [['en_revision'], 'rechazada'],
        'suspender' => [['activa'], 'suspendida'],
        'reactivar' => [['suspendida'], 'activa'],
    ];

    public function __construct(
        private readonly ShowcaseSequence $sequence,
        private readonly FunnelRecorder $funnel,
        private readonly AuditLogger $audit,
        private readonly PlatformSession $session,
    ) {}

    public function forTenant(string $tenantId, string $city): object
    {
        $existing = $this->db()->table('platform_showcase_agencies')->where('tenant_id', $tenantId)->first();

        if ($existing !== null) {
            return $existing;
        }

        $tenant = $this->db()->table('tenants')->where('id', $tenantId)->first(['id', 'commercial_name', 'ruc', 'admin_email']);
        $id = (string) Str::uuid7();
        $this->db()->table('platform_showcase_agencies')->insert([
            'id' => $id,
            'code' => $this->sequence->next(ShowcaseSequence::AGENCY),
            'tenant_id' => $tenantId,
            'name' => (string) $tenant->commercial_name,
            'slug' => $this->slug((string) $tenant->commercial_name),
            'city' => Str::lower($city),
            'ruc' => preg_match('/^(10|20)\d{9}$/', (string) $tenant->ruc) === 1 ? $tenant->ruc : null,
            'email' => (string) $tenant->admin_email,
            'status' => 'en_revision',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->funnel->record('registro_agencia', $id, $tenantId);

        return $this->db()->table('platform_showcase_agencies')->where('id', $id)->first();
    }

    public function register(array $data): array
    {
        $email = Str::lower(trim((string) $data['email']));

        if ($this->db()->table('platform_showcase_agencies')->whereRaw('lower(email) = ?', [$email])->exists()) {
            throw ApiException::conflict('VT-AGENCY-EXISTS', 'Ya hay una agencia registrada con ese correo. Escríbanos si necesita recuperar el acceso.');
        }

        if (! blank($data['ruc'] ?? null) && $this->db()->table('platform_showcase_agencies')->where('ruc', $data['ruc'])->exists()) {
            throw ApiException::conflict('VT-AGENCY-EXISTS', 'Ese RUC ya está registrado en la vitrina.');
        }

        return $this->db()->transaction(function () use ($data, $email): array {
            $id = (string) Str::uuid7();
            $code = $this->sequence->next(ShowcaseSequence::AGENCY);
            $this->db()->table('platform_showcase_agencies')->insert([
                'id' => $id,
                'code' => $code,
                'name' => trim((string) $data['name']),
                'slug' => $this->slug((string) $data['name']),
                'city' => Str::lower(trim((string) $data['city'])),
                'ruc' => $data['ruc'] ?? null,
                'email' => $email,
                'phone' => $data['phone'] ?? null,
                'license_ref' => $data['license_ref'] ?? null,
                'status' => 'en_revision',
                'marketing_opt_in' => (bool) ($data['marketing_opt_in'] ?? true),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->funnel->record('registro_agencia', $id, null, null, FunnelRecorder::utm($data));
            $this->audit->log('Vitrina agencia', $code, 'registrar', null, trim((string) $data['name']).(! empty($data['wants_pass']) ? ' · pide pase 30 días' : ''), connection: 'pgsql_platform');

            return ['code' => $code, 'status' => 'en_revision', 'wants_pass' => (bool) ($data['wants_pass'] ?? false)];
        });
    }

    public function transition(string $code, string $action, ?string $reason, PlatformUser $actor): array
    {
        [$from, $to] = self::ACTIONS[$action] ?? throw ApiException::unprocessable('VT-AGENCY', 'Elige una acción válida.', ['field' => 'action']);

        return $this->db()->transaction(function () use ($code, $action, $from, $to, $reason, $actor): array {
            $agency = $this->db()->table('platform_showcase_agencies')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound('La agencia no existe.');

            if (! in_array($agency->status, $from, true)) {
                throw ApiException::conflict('VT-AGENCY', 'Ese cambio no está permitido desde el estado actual de la agencia.');
            }

            if ($to === 'activa' && (blank($agency->ruc) || blank($agency->license_ref)) && $agency->tenant_id === null) {
                throw ApiException::unprocessable('VT-01', 'Para verificar la agencia hacen falta su RUC y su licencia de turismo.');
            }

            if (in_array($action, ['rechazar', 'suspender'], true) && blank($reason)) {
                throw ApiException::unprocessable('VT-AGENCY', 'Indica el motivo.', ['field' => 'reason']);
            }

            $this->db()->table('platform_showcase_agencies')->where('id', $agency->id)->update([
                'status' => $to,
                'verified_at' => $to === 'activa' ? ($agency->verified_at ?? now()) : $agency->verified_at,
                'updated_at' => now(),
            ]);

            if ($to === 'suspendida') {
                $this->db()->table('platform_showcase_listings')->where('agency_id', $agency->id)->where('status', 'publicado')->update(['status' => 'despublicado', 'updated_at' => now()]);
            }

            $this->session->log('Vitrina agencia', $code, $action, $agency->status, trim($to.($reason ? " · {$reason}" : '')), $actor);

            return ['code' => $code, 'status' => $to];
        });
    }

    private function slug(string $name): string
    {
        $base = Str::limit(Str::slug($name), 110, '') ?: 'agencia';
        $slug = $base;
        $n = 2;

        while ($this->db()->table('platform_showcase_agencies')->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$n++;
        }

        return $slug;
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
