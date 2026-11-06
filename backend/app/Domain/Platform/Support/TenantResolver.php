<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class TenantResolver
{
    public function forLogin(Request $request): ?object
    {
        $base = (string) config('tenancy.central_domain');
        $slug = (string) $request->input('tenant_slug', '');
        $host = config('tenancy.allow_slug_login') && $slug !== '' ? "{$slug}.{$base}" : strtolower($request->getHost());

        return $this->byHost($host, $base) ?? ($slug === '' ? $this->byEmail((string) $request->input('email')) : null);
    }

    public function byEmail(string $email): ?object
    {
        $matches = DB::connection('pgsql_platform')->table('iam_users as u')
            ->join('tenants as t', 't.id', '=', 'u.tenant_id')
            ->whereRaw('lower(u.email) = ?', [strtolower(trim($email))])->whereNull('u.deleted_at')
            ->limit(2)->get(['u.tenant_id', 't.status']);

        return $matches->count() === 1 ? $matches->first() : null;
    }

    public function byHost(string $host, string $base): ?object
    {
        return DB::selectOne('select tenant_id, status from app_resolve_tenant_by_host(?, ?)', [$host, $base]);
    }
}
