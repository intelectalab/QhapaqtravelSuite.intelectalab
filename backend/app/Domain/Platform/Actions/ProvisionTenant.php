<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Iam\Models\Sede;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\Invitations;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\TenantBootstrap;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Database\Seeders\CrmCatalogSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class ProvisionTenant
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly PlatformSession $session,
        private readonly TenantBootstrap $bootstrap,
        private readonly TenantContext $context,
        private readonly Invitations $invitations,
    ) {}

    public function validate(array $data): void
    {
        $subdomain = Str::lower(trim((string) ($data['subdomain'] ?? '')));

        if ($subdomain !== '' && DB::connection(self::CONNECTION)->table('tenants')->where('subdomain', $subdomain)->exists()) {
            throw ApiException::unprocessable('TEN-BR-01', 'El subdominio ya está en uso por otra agencia.', ['field' => 'subdomain']);
        }

        if (! empty($data['ruc']) && DB::connection(self::CONNECTION)->table('tenants')->where('ruc', $data['ruc'])->exists()) {
            throw ApiException::unprocessable('TEN-BR-02', 'Ya existe una agencia con ese RUC.', ['field' => 'ruc']);
        }

        if (! empty($data['admin_email']) && DB::connection(self::CONNECTION)->table('iam_users')->whereRaw('lower(email) = ?', [Str::lower($data['admin_email'])])->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('TEN-BR-03', 'Ese correo ya pertenece a un usuario de otra agencia.', ['field' => 'admin_email']);
        }
    }

    public function __invoke(array $data, PlatformUser $actor): Tenant
    {
        $this->validate($data);
        $plan = Plan::on(self::CONNECTION)->where('code', $data['plan'])->first() ?? throw ApiException::unprocessable('PLAN', 'Elige un plan de la lista.');
        $previous = DB::getDefaultConnection();
        $token = '';

        DB::setDefaultConnection(self::CONNECTION);

        try {
            [$tenant, $admin] = DB::transaction(function () use ($data, $plan, $actor, &$token): array {
                $trial = ($data['status'] ?? 'prueba') === 'prueba';
                $tenant = Tenant::query()->create([
                    'code' => $this->nextCode(),
                    'legal_name' => trim($data['legal_name']),
                    'commercial_name' => trim($data['commercial_name']),
                    'ruc' => $data['ruc'],
                    'fiscal_address' => trim($data['fiscal_address']),
                    'business_type' => $data['business_type'],
                    'subdomain' => Str::lower(trim($data['subdomain'])),
                    'logo_initials' => $this->initials($data['commercial_name']),
                    'plan_id' => $plan->getKey(),
                    'status' => $trial ? 'prueba' : 'activo',
                    'trial_ends_at' => $trial ? now()->addDays($plan->trial_days ?: 14) : null,
                    'mrr' => $trial ? 0 : $plan->price_month,
                    'admin_email' => Str::lower(trim($data['admin_email'])),
                ]);

                DB::select('select app_set_tenant(?::uuid)', [$tenant->getKey()]);
                $this->context->set($tenant);
                app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

                $sede = Sede::query()->create([
                    'code' => 'SED-01',
                    'name' => trim($data['sede_name']),
                    'city' => trim($data['sede_city']),
                    'address' => trim($data['sede_address']),
                    'status' => 'activa',
                    'is_main' => true,
                ]);
                (new CrmCatalogSeeder)->run($tenant);
                $roles = $this->bootstrap->roles($tenant);

                $admin = User::query()->create([
                    'code' => 'U01',
                    'name' => trim($data['admin_name']),
                    'email' => Str::lower(trim($data['admin_email'])),
                    'password' => null,
                    'sede_id' => $sede->getKey(),
                    'status' => 'pendiente',
                    'mfa_enabled' => false,
                    'mfa_required' => true,
                ]);
                $admin->syncRoles([$roles['tenant_admin']]);

                $token = $this->invitations->create($admin, $tenant->getKey(), $admin->getKey());

                $this->session->log('Tenant', $tenant->code, 'alta', null, "{$tenant->commercial_name} · {$plan->name} · {$tenant->status}", $actor);

                return [$tenant, $admin];
            });
        } finally {
            DB::setDefaultConnection($previous);
            $this->context->clear();
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->invitations->send($admin->email, $admin->name, $tenant->commercial_name, $token, true);

        return $tenant;
    }

    private function nextCode(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ['platform:tenants']);
        $last = DB::table('tenants')->where('code', 'like', 'TNT-%')->orderByDesc('code')->value('code');

        return 'TNT-'.str_pad((string) ($last ? (int) Str::after($last, 'TNT-') + 1 : 1), 4, '0', STR_PAD_LEFT);
    }

    private function initials(string $name): string
    {
        $words = collect(preg_split('/\s+/', trim($name)))->filter(fn (string $word) => mb_strlen($word) > 2)->values();

        return Str::upper(mb_substr($words[0] ?? $name, 0, 1).mb_substr($words[1] ?? mb_substr($name, 1), 0, 1));
    }
}
