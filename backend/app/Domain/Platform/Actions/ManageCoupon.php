<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageCoupon
{
    private const CONNECTION = 'pgsql_platform';

    private const ENTITY = 'Cupón';

    public function __construct(private readonly PlatformSession $session) {}

    public function create(array $data, PlatformUser $actor): string
    {
        $code = Str::upper(trim($data['code']));

        if ($this->db()->table('coupons')->where('code', $code)->exists()) {
            throw ApiException::unprocessable('COUPON_EXISTS', 'Ya existe un cupón con ese código.');
        }

        $this->db()->transaction(function () use ($code, $data, $actor): void {
            $this->db()->table('coupons')->insert([
                'id' => (string) Str::uuid7(),
                'code' => $code,
                ...$this->values($data),
                'redeemed_count' => 0,
                'status' => 'active',
                'created_by' => $actor->getKey(),
                'created_at' => now(),
            ]);
            $this->session->log(self::ENTITY, $code, 'crear', null, $this->describe($data), $actor);
        });

        return $code;
    }

    public function update(string $code, array $data, PlatformUser $actor): void
    {
        $coupon = $this->find($code);

        if ($data['max_redemptions'] !== null && (int) $data['max_redemptions'] < (int) $coupon->redeemed_count) {
            throw ApiException::unprocessable('COUPON_MAX', "El cupón ya tiene {$coupon->redeemed_count} canjes; el máximo no puede ser menor.");
        }

        $this->db()->transaction(function () use ($coupon, $data, $actor): void {
            $this->db()->table('coupons')->where('id', $coupon->id)->update($this->values($data));
            $this->session->log(self::ENTITY, $coupon->code, 'editar', null, $this->describe($data), $actor);
        });
    }

    public function setStatus(string $code, bool $active, PlatformUser $actor): void
    {
        $coupon = $this->find($code);
        $status = $active ? 'active' : 'inactive';

        if ($coupon->status === $status) {
            throw ApiException::conflict('COUPON_STATUS', $active ? 'El cupón ya está activo.' : 'El cupón ya está desactivado.');
        }

        $this->db()->transaction(function () use ($coupon, $status, $active, $actor): void {
            $this->db()->table('coupons')->where('id', $coupon->id)->update(['status' => $status]);
            $this->session->log(self::ENTITY, $coupon->code, $active ? 'activar' : 'desactivar', $coupon->status, $status, $actor);
        });
    }

    private function values(array $data): array
    {
        $plans = $this->db()->table('plans')->whereIn('code', $data['plans'])->pluck('id')->all();

        return [
            'type' => $data['type'],
            'value' => $data['value'],
            'duration_cycles' => $data['duration_cycles'],
            'plan_ids' => '{'.implode(',', $plans).'}',
            'max_redemptions' => $data['max_redemptions'],
            'valid_to' => $data['valid_to'],
            'note' => $data['note'],
        ];
    }

    private function describe(array $data): string
    {
        $value = $data['type'] === 'percent' ? "{$data['value']} %" : "S/ {$data['value']}";

        return "{$value} · {$data['duration_cycles']} ciclos · ".implode(', ', $data['plans']);
    }

    private function find(string $code): object
    {
        return $this->db()->table('coupons')->where('code', Str::upper($code))->first() ?? throw ApiException::notFound('El cupón no existe.');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
