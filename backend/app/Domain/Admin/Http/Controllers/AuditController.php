<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ExportAuditLog;
use App\Domain\Admin\Support\AuditDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Http\Middleware\IdempotencyMiddleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditController
{
    public function index(Request $request, AuditDirectory $directory): JsonResponse
    {
        $page = $directory->page($request, $this->user($request));
        $filters = collect($request->query())->except(['page', 'per_page'])->map(fn (mixed $value, string $key): string => "{$key}=".(is_array($value) ? implode(',', $value) : (string) $value))->implode(' · ');
        app(AuditLogger::class)->log('Bitácora de auditoría', 'consulta', 'consultar', null, $filters !== '' ? mb_substr($filters, 0, 250) : 'sin filtros');

        return response()->json($page);
    }

    public function show(string $id, AuditDirectory $directory): JsonResponse
    {
        $event = $directory->find($id);
        app(AuditLogger::class)->log('Bitácora de auditoría', $id, 'ver_detalle');

        return response()->json(['data' => $event]);
    }

    public function export(Request $request, AuditDirectory $directory, ExportAuditLog $export): JsonResponse
    {
        $request->validate([
            'filters' => ['nullable', 'array'],
            'format' => ['nullable', 'in:'.implode(',', ExportAuditLog::FORMATS)],
        ], ['format.in' => 'La bitácora se exporta en CSV, XLSX o PDF.']);
        $scoped = $request->duplicate(['filter' => $request->input('filters', []), 'days' => $request->input('filters.days', '30')]);
        $user = $this->user($request);

        return response()->json(['data' => $export($directory->filters($scoped, $user), $user, $request->header(IdempotencyMiddleware::HEADER), (string) $request->input('format', 'CSV'))], 202);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
