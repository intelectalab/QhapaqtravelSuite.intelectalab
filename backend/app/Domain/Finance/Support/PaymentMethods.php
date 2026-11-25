<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Finance\Actions\PaymentLinks;
use App\Domain\Site\Support\CheckoutTerms;
use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaymentMethods
{
    public const SYSTEM = ['vale_regalo' => 'Vale de regalo'];

    public const FOR_CUSTOMERS = ['tarjeta_e_commerce' => 'Tarjeta en línea', 'tarjeta_pasarela' => 'Tarjeta'];

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

    public static function b2bCreditColumn(string $receivable, string $reservation): Expression
    {
        return DB::raw("exists(select 1 from channel_b2b_agencies ba where ba.deleted_at is null and ba.status = 'activa' and (ba.id = {$reservation}.agency_id or ba.crm_client_id = {$receivable}.client_id)) as b2b_credit");
    }

    public function labels(): array
    {
        return [...PaymentLinks::METHODS, ...CheckoutTerms::METHODS, ...self::SYSTEM, ...DB::table('fin_payment_methods')->pluck('label', 'code')->all()];
    }

    public function customerLabels(): array
    {
        return [...$this->labels(), ...self::FOR_CUSTOMERS];
    }

    public static function display(string $code, array $labels): string
    {
        return $labels[$code] ?? Str::ucfirst(str_replace('_', ' ', $code));
    }

    public function label(string $code): string
    {
        return self::display($code, $this->labels());
    }

    public function relabel(Collection $rows): Collection
    {
        $labels = $this->labels();

        return $rows->map(function (object $row) use ($labels): object {
            $row->method = self::display((string) $row->method, $labels);

            return $row;
        });
    }

    public function find(string $code): ?object
    {
        return DB::table('fin_payment_methods')->where('code', $code)->where('active', true)->first(['code', 'label', 'requires_reference', 'is_b2b_credit']);
    }
}
