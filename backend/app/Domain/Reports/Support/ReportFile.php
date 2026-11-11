<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use Barryvdh\DomPDF\Facade\Pdf;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

final class ReportFile
{
    public const FORMATS = [
        'CSV' => ['extension' => 'csv', 'mime' => 'text/csv; charset=UTF-8'],
        'XLSX' => ['extension' => 'xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'PDF' => ['extension' => 'pdf', 'mime' => 'application/pdf'],
    ];

    public function make(string $format, array $report, array $agency): string
    {
        return match ($format) {
            'CSV' => $this->csv($report),
            'XLSX' => $this->xlsx($report, $agency),
            default => $this->pdf($report, $agency),
        };
    }

    public static function cell(mixed $value, string $format): string
    {
        return match (true) {
            $value === null || $value === '' => '—',
            $format === 'money' => 'S/ '.number_format((float) $value, 2, '.', ' '),
            $format === 'percent' => number_format((float) $value, 1, ',', ' ').' %',
            $format === 'hours' => number_format((float) $value, 1, ',', ' ').' h',
            $format === 'days' => number_format((float) $value, 1, ',', ' ').' días',
            $format === 'rating' => number_format((float) $value, 1, ',', ' ').' / 5',
            $format === 'number' => number_format((float) $value, 0, ',', ' '),
            $format === 'date' => substr((string) $value, 8, 2).'/'.substr((string) $value, 5, 2).'/'.substr((string) $value, 0, 4),
            $format === 'datetime' => substr((string) $value, 8, 2).'/'.substr((string) $value, 5, 2).'/'.substr((string) $value, 0, 4).' '.substr((string) $value, 11, 5),
            default => (string) $value,
        };
    }

    private function csv(array $report): string
    {
        $handle = fopen('php://temp', 'w+');
        $columns = $report['table']['columns'];
        fputcsv($handle, array_column($columns, 'label'));

        foreach ($report['table']['rows'] as $row) {
            fputcsv($handle, array_map(fn (array $column): string => $this->raw($row[$column['key']] ?? null, $column['format']), $columns));
        }

        if ($report['table']['totals']) {
            fputcsv($handle, array_map(fn (array $column): string => $this->raw($report['table']['totals'][$column['key']] ?? null, $column['format']), $columns));
        }

        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        return "\u{FEFF}".$content;
    }

    private function xlsx(array $report, array $agency): string
    {
        $path = tempnam(sys_get_temp_dir(), 'rep');
        $writer = new Writer;
        $writer->openToFile($path);
        $title = (new Style)->withFontBold(true)->withFontSize(14);
        $header = (new Style)->withFontBold(true)->withFontColor(Color::WHITE)->withBackgroundColor(ltrim(strtoupper($agency['brand']), '#'));
        $bold = (new Style)->withFontBold(true);
        $writer->getCurrentSheet()->setName('Resumen');
        $writer->addRow(Row::fromValuesWithStyle(["{$agency['name']} · Reporte {$report['title']}"], $title));
        $writer->addRow(Row::fromValues([$this->scope($report)]));
        $writer->addRow(Row::fromValues([]));
        $writer->addRow(Row::fromValuesWithStyle(['Indicador', 'Valor', 'Detalle'], $header));

        foreach ($report['kpis'] as $kpi) {
            $writer->addRow(Row::fromValues([$kpi['label'], self::cell($kpi['value'], $kpi['format']), (string) ($kpi['hint'] ?? '')]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName('Detalle');
        $columns = $report['table']['columns'];
        $writer->addRow(Row::fromValuesWithStyle(array_column($columns, 'label'), $header));

        foreach ($report['table']['rows'] as $row) {
            $writer->addRow(Row::fromValues(array_map(fn (array $column): float|int|string => $this->typed($row[$column['key']] ?? null, $column['format']), $columns)));
        }

        if ($report['table']['totals']) {
            $writer->addRow(Row::fromValuesWithStyle(array_map(fn (array $column): float|int|string => $this->typed($report['table']['totals'][$column['key']] ?? null, $column['format']), $columns), $bold));
        }

        foreach ($report['charts'] as $chart) {
            $writer->addNewSheetAndMakeItCurrent()->setName(mb_substr(preg_replace('/[\\\\\/?*\[\]:]/', '', $chart['title']) ?? 'Gráfico', 0, 31));
            $keys = $chart['keys'] ?? (isset($chart['labels']) ? ['value' => $chart['labels'][0], 'value2' => $chart['labels'][1]] : ['value' => 'Valor']);
            $writer->addRow(Row::fromValuesWithStyle(['Concepto', ...array_values($keys)], $header));

            foreach ($chart['series'] as $point) {
                $writer->addRow(Row::fromValues([(string) $point['label'], ...array_map(fn (string $key): float => (float) ($point[$key] ?? 0), array_keys($keys))]));
            }
        }

        $writer->close();
        $content = (string) file_get_contents($path);
        @unlink($path);

        return $content;
    }

    private function pdf(array $report, array $agency): string
    {
        $pdf = Pdf::loadView('reports.tab-report', ['report' => $report, 'agency' => $agency, 'scope' => $this->scope($report)])->setPaper('a4', count($report['table']['columns']) > 7 ? 'landscape' : 'portrait')->setOption(['enable_font_subsetting' => true, 'default_font' => 'DejaVu Sans']);
        $dompdf = $pdf->getDomPDF();
        $dompdf->render();
        [$r, $g, $b] = sscanf(ReportFormat::tint($agency['ink'], 0.45), '#%02x%02x%02x');
        $canvas = $dompdf->getCanvas();
        $canvas->page_text($canvas->get_width() - 95, $canvas->get_height() - 28, 'Página {PAGE_NUM} de {PAGE_COUNT}', $dompdf->getFontMetrics()->getFont('DejaVu Sans'), 7, [$r / 255, $g / 255, $b / 255]);

        return (string) $dompdf->output();
    }

    private function scope(array $report): string
    {
        $filters = $report['filters'];
        $period = $filters['from'] ? "{$filters['label']} (".self::cell($filters['from'], 'date').' al '.self::cell($filters['to'], 'date').')' : $filters['label'];

        return $period.($filters['sede'] ? " · {$filters['sede']['name']}" : ' · Todas las sedes').($report['scope'] === 'own' ? ' · Mi cartera' : '');
    }

    private function raw(mixed $value, string $format): string
    {
        return $value === null ? '' : (in_array($format, ['money', 'percent', 'number', 'hours', 'days', 'rating'], true) ? (string) $value : self::cell($value, $format));
    }

    private function typed(mixed $value, string $format): float|int|string
    {
        if ($value === null) {
            return '';
        }

        return match ($format) {
            'money', 'percent', 'hours', 'days', 'rating' => (float) $value,
            'number' => (int) $value,
            default => self::cell($value, $format),
        };
    }
}
