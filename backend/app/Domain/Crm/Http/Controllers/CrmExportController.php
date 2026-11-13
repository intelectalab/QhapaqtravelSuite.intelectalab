<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\RequestCrmExport;
use App\Domain\Crm\Support\CrmExports;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CrmExportController
{
    public function store(Request $request, RequestCrmExport $export): JsonResponse
    {
        $data = $request->validate([
            'resource' => ['required', 'string', 'in:'.implode(',', array_keys(CrmExports::RESOURCES))],
            'filters' => ['nullable', 'array', 'max:20'],
            'filters.*' => ['nullable', 'string', 'max:200'],
            'format' => ['nullable', 'string', 'in:CSV,XLSX,csv,xlsx'],
        ], [
            'resource.required' => 'Indica qué quieres exportar.',
            'resource.in' => 'Solo se pueden exportar leads, oportunidades, clientes, casos de postventa o segmentos de fidelización.',
            'filters.array' => 'Los filtros deben enviarse como una lista de campo y valor.',
            'filters.*.string' => 'Cada filtro debe ser un texto.',
            'filters.*.max' => 'Cada filtro admite hasta 200 caracteres.',
            'format.in' => 'El formato es CSV o XLSX.',
        ]);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $export($user, $data['resource'], $data['filters'] ?? [], strtoupper($data['format'] ?? 'CSV'))], 202);
    }
}
