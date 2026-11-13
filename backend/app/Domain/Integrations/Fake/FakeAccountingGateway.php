<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\AccountingGateway;
use App\Domain\Integrations\Data\AdapterResult;

final class FakeAccountingGateway implements AccountingGateway
{
    private const LAYOUTS = [
        'contasis' => [';', ['Fecha', 'Comprobante', 'Cuenta', 'Debe', 'Haber', 'Glosa', 'CentroCosto', 'Moneda', 'TipoCambio']],
        'concar' => [',', ['SubDiario', 'Fecha', 'Comprobante', 'Cuenta', 'Debe', 'Haber', 'Glosa', 'CentroCosto', 'Moneda', 'TipoCambio']],
        'siigo' => [',', ['fecha', 'documento', 'cuenta', 'debito', 'credito', 'descripcion', 'centro_costo', 'moneda', 'tasa']],
        'quickbooks' => [',', ['JournalDate', 'JournalNo', 'Account', 'Debits', 'Credits', 'Description', 'Class', 'Currency', 'ExchangeRate']],
        'xero' => [',', ['Date', 'Reference', 'AccountCode', 'Debit', 'Credit', 'Narration', 'TrackingOption', 'Currency', 'Rate']],
        'csv' => [',', ['fecha', 'comprobante', 'cuenta', 'debe', 'haber', 'glosa', 'centro_costo', 'moneda', 'tipo_cambio']],
    ];

    public function render(string $target, array $entries): array
    {
        [$separator, $header] = self::LAYOUTS[$target] ?? self::LAYOUTS['csv'];
        $lines = [implode($separator, $header)];

        foreach ($entries as $entry) {
            $values = [$entry['date'], $entry['document'], $entry['account'], $entry['debit'], $entry['credit'], $entry['description'], $entry['cost_center'] ?? '', $entry['currency'], $entry['fx_rate'] ?? ''];

            if ($target === 'concar') {
                array_unshift($values, $entry['journal']);
            }

            $lines[] = implode($separator, array_map(fn (mixed $value) => $this->cell((string) $value, $separator), $values));
        }

        return ['content' => implode("\r\n", $lines)."\r\n", 'extension' => $target === 'contasis' ? 'txt' : 'csv', 'mime' => $target === 'contasis' ? 'text/plain' : 'text/csv'];
    }

    public function healthcheck(): AdapterResult
    {
        return AdapterResult::success('ok', null, ['simulated' => true]);
    }

    private function cell(string $value, string $separator): string
    {
        $value = str_replace(["\r", "\n"], ' ', $value);

        return str_contains($value, $separator) || str_contains($value, '"') ? '"'.str_replace('"', '""', $value).'"' : $value;
    }
}
