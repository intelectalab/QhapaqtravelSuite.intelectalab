<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use Barryvdh\DomPDF\Facade\Pdf;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Color;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

final class WeeklyReportFiles
{
    public function pdf(array $report): string
    {
        $pdf = Pdf::loadView('reports.weekly-management', ['report' => $report])->setPaper('a4')->setOption(['enable_font_subsetting' => true, 'default_font' => 'DejaVu Sans']);
        $dompdf = $pdf->getDomPDF();
        $dompdf->render();
        [$r, $g, $b] = sscanf(ReportFormat::tint($report['agency']['ink'], 0.45), '#%02x%02x%02x');
        $dompdf->getCanvas()->page_text(500, 814, 'Página {PAGE_NUM} de {PAGE_COUNT}', $dompdf->getFontMetrics()->getFont('DejaVu Sans'), 7, [$r / 255, $g / 255, $b / 255]);

        return (string) $dompdf->output();
    }

    public function xlsx(array $report): string
    {
        $path = tempnam(sys_get_temp_dir(), 'rpt');
        $writer = new Writer;
        $writer->openToFile($path);
        $title = (new Style)->withFontBold(true)->withFontSize(14);
        $header = (new Style)->withFontBold(true)->withFontColor(Color::WHITE)->withBackgroundColor(ltrim(strtoupper($report['agency']['brand']), '#'));
        $money = (new Style)->withFormat('#,##0.00');

        $sheet = $writer->getCurrentSheet();
        $sheet->setName('Resumen');
        $writer->addRow(Row::fromValuesWithStyle(["{$report['agency']['name']} · Reporte semanal de gerencia"], $title));
        $writer->addRow(Row::fromValues(["Del {$report['period']['label']}"]));
        $writer->addRow(Row::fromValues([]));
        $writer->addRow(Row::fromValuesWithStyle(['Indicador', 'Semana', 'Semana anterior', 'Variación'], $header));

        foreach ($report['kpis'] as $kpi) {
            $writer->addRow(Row::fromValuesWithStyle([$kpi['label'], $this->number($kpi['value']), $this->number($kpi['previous']), ReportFormat::change($kpi)], $kpi['kind'] === 'money' ? $money : new Style));
        }

        $this->sheet($writer, 'Ventas por día', ['Día', 'Reservas', 'Ventas (S/)'], array_map(fn (array $row): array => [$row['label'], $row['count'], $this->number($row['sales'])], $report['days']), $header, $money);
        $this->sheet($writer, 'Por canal', ['Canal', 'Reservas', 'Ventas (S/)'], array_map(fn (array $row): array => [$row['label'], $row['count'], $this->number($row['sales'])], $report['channels']), $header, $money);
        $this->sheet($writer, 'Por asesor', ['Asesor', 'Reservas', 'Ventas (S/)'], array_map(fn (array $row): array => [$row['label'], $row['count'], $this->number($row['sales'])], $report['advisors']), $header, $money);
        $this->sheet($writer, 'Cobranza', ['Antigüedad', 'Cuotas', 'Saldo (S/)'], array_map(fn (array $row): array => [$row['label'], $row['count'], $this->number($row['amount'])], $report['collection']['aging']), $header, $money);
        $this->sheet($writer, 'Próximos viajes', ['Inicio', 'Reserva', 'Viaje', 'Cliente', 'Estado'], array_map(fn (array $row): array => [$row['date'], $row['code'], $row['title'], $row['client'], $row['status']], $report['upcoming']), $header, new Style);

        $writer->close();
        $content = (string) file_get_contents($path);
        @unlink($path);

        return $content;
    }

    private function sheet(Writer $writer, string $name, array $columns, array $rows, Style $header, Style $style): void
    {
        $writer->addNewSheetAndMakeItCurrent()->setName($name);
        $writer->addRow(Row::fromValuesWithStyle($columns, $header));

        foreach ($rows as $row) {
            $writer->addRow(Row::fromValuesWithStyle($row, $style));
        }
    }

    private function number(?string $value): float|string
    {
        return $value === null ? '' : (float) $value;
    }
}
