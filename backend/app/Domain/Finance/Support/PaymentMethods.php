<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaymentMethods
{
    public const DEFAULTS = [
        'Transferencia BCP' => [true, false],
        'Transferencia Interbank' => [true, false],
        'Transferencia BBVA' => [true, false],
        'Tarjeta' => [true, false],
        'Tarjeta (pasarela)' => [true, false],
        'Tarjeta (e-commerce)' => [true, false],
        'Yape' => [true, false],
        'Plin' => [true, false],
        'Efectivo' => [false, false],
        'Crédito B2B' => [false, true],
    ];

    public static function code(string $label): string
    {
        return Str::slug($label, '_');
    }

    public function options(): array
    {
        return DB::table('fin_payment_methods')->where('active', true)->orderBy('label')->get(['code', 'label', 'requires_reference', 'is_b2b_credit'])
            ->map(fn (object $row): array => ['value' => $row->code, 'label' => $row->label, 'requires_reference' => (bool) $row->requires_reference, 'b2b' => (bool) $row->is_b2b_credit])
            ->values()->all();
    }

    public function labels(): array
    {
        return DB::table('fin_payment_methods')->pluck('label', 'code')->all();
    }

    public function find(string $code): ?object
    {
        return DB::table('fin_payment_methods')->where('code', $code)->where('active', true)->first(['code', 'label', 'requires_reference', 'is_b2b_credit']);
    }
}
