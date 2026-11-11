<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class OperatorResource
{
    private function __construct(public readonly User $user, public readonly string $type, public readonly object $row) {}

    public static function of(User $user): self
    {
        if ($user->getAttribute('guide_id') !== null) {
            $row = DB::table('ops_guides')->whereNull('deleted_at')->where('id', $user->getAttribute('guide_id'))->first();

            if ($row !== null) {
                return new self($user, 'guide', $row);
            }
        }

        if ($user->getAttribute('driver_id') !== null) {
            $row = DB::table('ops_drivers')->whereNull('deleted_at')->where('id', $user->getAttribute('driver_id'))->first();

            if ($row !== null) {
                return new self($user, 'driver', $row);
            }
        }

        throw ApiException::forbidden('MOB-BR-13', 'Su usuario no está vinculado a un recurso operativo. Pida a Operaciones que lo vincule a su ficha de guía o conductor.');
    }

    public function id(): string
    {
        return (string) $this->row->id;
    }

    public function column(): string
    {
        return $this->type === 'guide' ? 'a.guide_id' : 'a.driver_id';
    }

    public function assignments(): Builder
    {
        return DB::table('ops_assignments as a')
            ->join('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'a.reservation_service_id')
            ->whereNull('o.deleted_at')
            ->where('o.status', '<>', 'cancelada')
            ->where($this->column(), $this->id());
    }
}
