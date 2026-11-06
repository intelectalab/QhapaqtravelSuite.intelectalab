<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class SetPostgresTenant
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $database,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $this->context->id();

        if ($tenantId === null) {
            return $next($request);
        }

        $db = DB::connection();
        $db->beginTransaction();

        try {
            $this->database->apply($db, $tenantId);

            $response = $next($request);

            if ($response->getStatusCode() >= 400) {
                $db->rollBack();
            } else {
                $db->commit();
            }

            return $response;
        } catch (Throwable $e) {
            if ($db->transactionLevel() > 0) {
                $db->rollBack();
            }
            throw $e;
        }
    }
}
