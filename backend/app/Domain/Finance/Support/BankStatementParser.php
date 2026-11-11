<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Errors\ApiException;
use DateTimeImmutable;
use DateTimeInterface;
use OpenSpout\Reader\XLSX\Reader;
use Throwable;

final class BankStatementParser
{
    public const FORMATS = ['csv', 'txt', 'xlsx'];

    private const MAX_LINES = 500;

    public function parse(string $path, string $format): array
    {
        $rows = $format === 'xlsx' ? $this->xlsxRows($path) : $this->textRows($path);
        $lines = [];

        foreach ($rows as $cells) {
            $line = $this->line($cells);
            if ($line !== null) {
                $lines[] = $line;
            }
        }

        if ($lines === []) {
            throw ApiException::unprocessable('FIN-BR-51', 'El archivo no tiene líneas reconocibles. Cada fila debe traer fecha, descripción e importe con signo.');
        }

        if (count($lines) > self::MAX_LINES) {
            throw ApiException::unprocessable('FIN-BR-51', 'El extracto supera las '.self::MAX_LINES.' líneas. Divídelo por periodos.');
        }

        return $lines;
    }

    private function textRows(string $path): array
    {
        $content = (string) file_get_contents($path);
        if (! mb_check_encoding($content, 'UTF-8')) {
            $content = (string) mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
        }

        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content) ?? $content;
        $rows = [];

        foreach (preg_split('/\r\n|\r|\n/', $content) ?: [] as $raw) {
            if (trim($raw) === '') {
                continue;
            }

            $separator = collect([';', "\t", '|', ','])->first(fn (string $candidate): bool => substr_count($raw, $candidate) >= 2) ?? ';';
            $rows[] = str_getcsv($raw, $separator, '"', '');
        }

        return $rows;
    }

    private function xlsxRows(string $path): array
    {
        $rows = [];

        try {
            $reader = new Reader;
            $reader->open($path);

            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $row) {
                    $rows[] = array_map(fn (mixed $value): string => $value instanceof DateTimeInterface ? $value->format('Y-m-d') : (string) $value, $row->toArray());
                }

                break;
            }

            $reader->close();
        } catch (Throwable) {
            throw ApiException::unprocessable('FIN-BR-51', 'No pudimos leer el archivo de Excel.');
        }

        return $rows;
    }

    private function line(array $cells): ?array
    {
        $cells = array_values(array_filter(array_map(fn (mixed $cell): string => trim((string) $cell), $cells), fn (string $cell): bool => $cell !== ''));

        if (count($cells) < 3) {
            return null;
        }

        $date = $this->date($cells[0]);
        $amount = $this->amount($cells[count($cells) - 1]);

        if ($date === null || $amount === null || $amount === '0.00') {
            return null;
        }

        $description = trim(implode(' ', array_slice($cells, 1, -1)));

        return [
            'date' => $date,
            'description' => mb_substr(mb_strtoupper(preg_replace('/\s+/', ' ', $description) ?? $description), 0, 255),
            'amount' => $amount,
        ];
    }

    private function date(string $value): ?string
    {
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'd/m/y', 'd.m.Y'] as $format) {
            $parsed = DateTimeImmutable::createFromFormat('!'.$format, $value);
            if ($parsed !== false && $parsed->format($format) === $value) {
                return $parsed->format('Y-m-d');
            }
        }

        return null;
    }

    private function amount(string $value): ?string
    {
        $clean = str_replace([' ', 'S/', 'US$', '$'], '', $value);
        $negative = str_starts_with($clean, '-') || (str_starts_with($clean, '(') && str_ends_with($clean, ')'));
        $clean = trim($clean, '-+()');

        if (str_contains($clean, ',') && str_contains($clean, '.')) {
            $clean = strrpos($clean, ',') > strrpos($clean, '.') ? str_replace(['.', ','], ['', '.'], $clean) : str_replace(',', '', $clean);
        } elseif (str_contains($clean, ',')) {
            $clean = preg_match('/,\d{1,2}$/', $clean) === 1 ? str_replace(',', '.', $clean) : str_replace(',', '', $clean);
        }

        if (preg_match('/^\d+(\.\d{1,2})?$/', $clean) !== 1) {
            return null;
        }

        return ($negative ? '-' : '').number_format((float) $clean, 2, '.', '');
    }
}
