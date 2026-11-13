<?php

declare(strict_types=1);

namespace App\Domain\Reports\Http\Controllers;

use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DataExportController
{
    public function store(Request $request, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'screen' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:120'],
            'format' => ['required', 'in:xlsx,csv'],
            'scope' => ['required', 'in:all,first,selected'],
            'rows' => ['required', 'integer', 'min:0', 'max:1000000'],
            'columns' => ['nullable', 'array', 'max:80'],
            'columns.*' => ['string', 'max:120'],
            'filters' => ['nullable', 'array', 'max:30'],
            'filters.*' => ['string', 'max:200'],
        ]);

        $scope = ['all' => 'todas las filas filtradas', 'first' => 'primeras filas', 'selected' => 'filas seleccionadas'][$data['scope']];
        $audit->log(
            'Lista exportada',
            $data['screen'],
            'exportar',
            null,
            mb_substr("{$data['title']} · ".($data['format'] === 'xlsx' ? 'Excel' : 'CSV')." · {$data['rows']} filas · {$scope}", 0, 250),
            ['filters' => $data['filters'] ?? [], 'columns' => $data['columns'] ?? []],
        );

        return response()->json(['data' => ['logged' => true]]);
    }
}
