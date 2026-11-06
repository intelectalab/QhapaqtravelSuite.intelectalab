<?php

use App\Domain\Crm\Support\ClientDocument;
use App\Domain\Shared\Errors\ApiException;

it('accepts a valid DNI and RUC', function (): void {
    expect(ClientDocument::normalize('persona', 'DNI', '4455 6677', 'Perú'))->toBe('44556677')
        ->and(ClientDocument::normalize('empresa', 'RUC', '20601234567', 'Perú'))->toBe('20601234567');
});

it('rejects documents that break CRM-BR-15', function (string $kind, string $type, string $number): void {
    ClientDocument::normalize($kind, $type, $number, 'Perú');
})->with([
    'DNI de 7 dígitos' => ['persona', 'DNI', '1234567'],
    'RUC que empieza en 30' => ['empresa', 'RUC', '30123456789'],
    'empresa peruana con DNI' => ['empresa', 'DNI', '12345678'],
    'número vacío' => ['persona', 'PASAPORTE', '   '],
])->throws(ApiException::class);

it('normalizes phones to the last nine digits', function (): void {
    expect(ClientDocument::phoneNorm('+51 987 000 111'))->toBe('987000111')
        ->and(ClientDocument::phoneNorm(''))->toBeNull();
});
