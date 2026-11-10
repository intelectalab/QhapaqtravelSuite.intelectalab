<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use Barryvdh\DomPDF\Facade\Pdf;

final class PdfRenderer
{
    public const FONT = 'DejaVu Sans';

    public function render(DocumentDraft $draft): string
    {
        $pdf = Pdf::loadView($draft->view, $draft->data)->setPaper('a4')->setOption(['enable_font_subsetting' => true, 'default_font' => self::FONT]);
        $dompdf = $pdf->getDomPDF();
        $dompdf->addInfo('Title', $draft->title);
        $dompdf->addInfo('Author', (string) ($draft->data['agency']['name'] ?? ''));
        $dompdf->addInfo('Creator', 'Qhapaq Travel Suite');
        $dompdf->render();
        $canvas = $dompdf->getCanvas();
        [$r, $g, $b] = sscanf(DocumentFormat::tint((string) ($draft->data['agency']['ink'] ?? AgencyLetterhead::INK), 0.45), '#%02x%02x%02x');
        $canvas->page_text($canvas->get_width() - 104, $canvas->get_height() - 34, 'Página {PAGE_NUM} de {PAGE_COUNT}', $dompdf->getFontMetrics()->getFont(self::FONT), 7, [$r / 255, $g / 255, $b / 255]);

        return (string) $dompdf->output();
    }
}
