<?php

declare(strict_types=1);

namespace App\Domain\Landing\Fake;

use App\Domain\Landing\Contracts\RucLookup;
use Illuminate\Support\Facades\DB;

final class FakeRucLookup implements RucLookup
{
    public const INACTIVE_MARK = '000';

    private const CITIES = ['Lima', 'Cusco', 'Arequipa', 'Puno', 'Trujillo', 'Piura', 'Iquitos', 'Huaraz', 'Ica', 'Tacna'];

    public function find(string $ruc): ?array
    {
        if (preg_match('/^(10|20)\d{9}$/', $ruc) !== 1 || ! $this->checksum($ruc)) {
            return null;
        }

        $known = DB::connection('pgsql_platform')->table('tenants')->where('ruc', $ruc)->first(['legal_name', 'fiscal_address']);
        $city = self::CITIES[(int) substr($ruc, -3) % count(self::CITIES)];
        $inactive = substr($ruc, 7, 3) === self::INACTIVE_MARK;

        return [
            'ruc' => $ruc,
            'legal_name' => $known->legal_name ?? (str_starts_with($ruc, '20') ? 'EMPRESA DE TURISMO '.substr($ruc, 2, 4).' S.A.C.' : 'CONTRIBUYENTE '.substr($ruc, 2, 8)),
            'address' => $known->fiscal_address ?? 'Av. Principal '.((int) substr($ruc, -4) % 900 + 100).', '.$city,
            'city' => $city,
            'status' => $inactive ? 'BAJA DE OFICIO' : 'ACTIVO',
            'condition' => $inactive ? 'NO HALLADO' : 'HABIDO',
            'active' => ! $inactive,
            'kind' => str_starts_with($ruc, '20') ? 'persona_juridica' : 'persona_natural',
            'source' => 'Padrón simulado (desarrollo)',
        ];
    }

    public static function checkDigit(string $first10): int
    {
        $weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        $sum = 0;

        foreach ($weights as $index => $weight) {
            $sum += (int) $first10[$index] * $weight;
        }

        $digit = 11 - ($sum % 11);

        return $digit === 10 ? 0 : ($digit === 11 ? 1 : $digit);
    }

    private function checksum(string $ruc): bool
    {
        return (int) $ruc[10] === self::checkDigit(substr($ruc, 0, 10));
    }
}
