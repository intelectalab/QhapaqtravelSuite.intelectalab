<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SupplierAccount
{
    public const PROVIDER_COLUMNS = ['id', 'ref', 'name', 'type', 'ruc', 'city', 'stars', 'contact_name', 'phone', 'email', 'contract_start', 'contract_end', 'currency', 'payment_terms', 'status'];

    public function __construct(
        public readonly User $user,
        public readonly object $provider,
    ) {}

    public static function of(User $user): self
    {
        if (! RoleExperience::isPortal($user) || ! $user->can('supplier.portal.view')) {
            throw ApiException::forbidden('SUP_ONLY', 'Esta sección pertenece a la extranet de proveedores.');
        }

        $provider = $user->provider_id ? DB::table('catalog_providers')->where('id', $user->provider_id)->whereNull('deleted_at')->first(self::PROVIDER_COLUMNS) : null;

        if ($provider === null) {
            throw ApiException::forbidden('SUP-BR-01', 'Su usuario no está vinculado a un proveedor.');
        }

        return new self($user, $provider);
    }

    public function id(): string
    {
        return (string) $this->provider->id;
    }

    public function services(): Builder
    {
        return DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->where('s.provider_id', $this->provider->id)
            ->whereNull('r.deleted_at')
            ->where('r.status', '<>', 'borrador');
    }

    public function service(string $code): object
    {
        return $this->services()->where('s.code', $code)->first(['s.*', 'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status'])
            ?? throw ApiException::notFound('La solicitud no corresponde a su establecimiento.');
    }

    public function payables(): Builder
    {
        return DB::table('fin_payables as p')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'p.reservation_service_id')
            ->where('p.provider_id', $this->provider->id)
            ->whereNull('p.deleted_at')
            ->where('p.status', '<>', 'cancelada');
    }

    public function payable(string $code): object
    {
        return $this->payables()->where('p.code', $code)->first(['p.*'])
            ?? throw ApiException::notFound('Ese documento no corresponde a su empresa.');
    }

    public function catalogService(string $ref): object
    {
        return DB::table('catalog_services')->where('provider_id', $this->provider->id)->where('ref', $ref)->whereNull('deleted_at')->first()
            ?? throw ApiException::notFound('Ese servicio no corresponde a su empresa.');
    }

    public function rateRequest(string $code): object
    {
        return DB::table('supplier_rate_requests')->where('provider_id', $this->provider->id)->where('code', $code)->first()
            ?? throw ApiException::notFound('Esa solicitud de tarifa no corresponde a su empresa.');
    }

    public function roomingLists(): Builder
    {
        return DB::table('ops_rooming_lists as l')
            ->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')
            ->where('l.hotel_provider_id', $this->provider->id)
            ->whereNull('l.deleted_at')
            ->whereNull('r.deleted_at')
            ->whereNotNull('l.sent_at');
    }

    public function roomingList(string $id): object
    {
        $list = Str::isUuid($id) ? $this->roomingLists()->where('l.id', $id)->lock('for update of l')->first(['l.*', 'r.code as reservation_code']) : null;

        return $list ?? throw ApiException::notFound('Esa rooming list no corresponde a su hotel.');
    }

    public function roomingRoom(string $id): object
    {
        $room = Str::isUuid($id) ? DB::table('ops_rooming_rooms as rr')->joinSub($this->roomingLists()->select(['l.id as list_id', 'l.reservation_id', 'r.code as reservation_code', 'l.check_in', 'l.check_out']), 'x', 'x.list_id', '=', 'rr.rooming_list_id')
            ->where('rr.id', $id)->first(['rr.*', 'x.reservation_id', 'x.reservation_code', 'x.check_in', 'x.check_out']) : null;

        return $room ?? throw ApiException::notFound('Esa habitación no corresponde a su hotel.');
    }

    public function vouchers(): Builder
    {
        return DB::table('ops_vouchers as v')
            ->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')
            ->where('v.provider_id', $this->provider->id)
            ->whereNull('r.deleted_at');
    }

    public function incidents(): Builder
    {
        $reservations = (clone $this->services())->select('s.reservation_id');
        $users = DB::table('iam_users')->where('provider_id', $this->provider->id)->select('id');

        return DB::table('ops_incidents as i')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'i.reservation_id')
            ->where(fn (Builder $query) => $query->where('i.provider_id', $this->provider->id)
                ->orWhereIn('i.reported_by', $users)
                ->orWhere(fn (Builder $inner) => $inner->where('i.type', 'Proveedor')->whereIn('i.reservation_id', $reservations)));
    }

    public function incident(string $code): object
    {
        return $this->incidents()->where('i.code', $code)->first(['i.*', 'r.code as reservation_code'])
            ?? throw ApiException::notFound('Esa incidencia no corresponde a su empresa.');
    }

    public function contact(string $id): object
    {
        $contact = preg_match('/^[0-9a-f-]{36}$/i', $id) === 1 ? DB::table('catalog_provider_contacts')->where('provider_id', $this->provider->id)->where('id', $id)->first() : null;

        return $contact ?? throw ApiException::notFound('Ese contacto no corresponde a su empresa.');
    }
}
