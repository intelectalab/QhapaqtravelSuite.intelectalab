<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignCorrelationId
{
    public const HEADER = 'X-Request-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = (string) $request->header(self::HEADER, '');
        $id = preg_match('/^[A-Za-z0-9._-]{8,40}$/', $incoming) === 1 ? $incoming : (string) Str::uuid7();

        Context::add('correlation_id', $id);
        Log::withContext(['correlation_id' => $id]);
        $request->attributes->set('correlation_id', $id);

        $response = $next($request);
        $response->headers->set(self::HEADER, $id);

        return $response;
    }

    public static function current(): string
    {
        return (string) (Context::get('correlation_id') ?? Str::uuid7());
    }
}
