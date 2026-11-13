<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\PlatformSession;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformAudit;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PlatformAuditExportController
{
    public const LIMIT = 5000;

    public function __invoke(Request $request, PlatformAudit $audit, PlatformSession $session): Response
    {
        $filters = $request->validate([
            'days' => ['nullable', 'integer', 'in:7,30,90,365'],
            'entity' => ['nullable', 'string', 'max:200'],
            'action' => ['nullable', 'string', 'max:60'],
            'critical' => ['nullable', 'boolean'],
            'tenant' => ['nullable', 'string', 'max:40'],
        ], [
            'days.*' => 'Elige un periodo de 7, 30, 90 o 365 días.',
            'critical.*' => 'Indica si quieres solo los eventos críticos.',
        ]);
        $filters['days'] = (int) ($filters['days'] ?? 30);
        $rows = $audit->export(array_filter($filters, fn (mixed $value): bool => $value !== null && $value !== ''), self::LIMIT);
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);
        $session->log('Sesión de plataforma', $user->email, 'exportar', null, "Bitácora de plataforma · {$rows->count()} eventos · {$filters['days']} días", $user);

        $lines = [implode(';', ['codigo', 'fecha', 'accion', 'entidad', 'sobre', 'agencia', 'antes', 'despues', 'quien', 'ip', 'critica'])];

        foreach ($rows as $row) {
            $lines[] = implode(';', array_map(fn (mixed $value): string => $this->cell($value), [
                $row['code'], $row['at'], $row['action'], $row['entity'], $row['subject'], $row['tenant']['name'] ?? '', $row['before'], $row['after'], $row['actor'] ?? 'Sistema', $row['ip'], $row['critical'] ? 'sí' : 'no',
            ]));
        }

        $name = 'bitacora-plataforma-'.now('America/Lima')->format('Y-m-d').'.csv';

        return response("\xEF\xBB\xBF".implode("\r\n", $lines)."\r\n", 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="'.$name.'"', 'Cache-Control' => 'no-store']);
    }

    private function cell(mixed $value): string
    {
        $text = str_replace(["\r", "\n"], ' ', (string) $value);

        if ($text !== '' && in_array($text[0], ['=', '+', '-', '@'], true)) {
            $text = "'".$text;
        }

        return str_contains($text, ';') || str_contains($text, '"') ? '"'.str_replace('"', '""', $text).'"' : $text;
    }
}
