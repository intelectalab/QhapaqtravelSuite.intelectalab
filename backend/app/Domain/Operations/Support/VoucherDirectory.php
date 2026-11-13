<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class VoucherDirectory
{
    public function __construct(private readonly OpsCommon $common) {}

    public function list(User $viewer): array
    {
        $names = $this->common->userNames();
        $vouchers = DB::table('ops_vouchers as v')
            ->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'v.reservation_service_id')
            ->join('catalog_providers as p', 'p.id', '=', 'v.provider_id')
            ->orderByDesc('v.issued_at')
            ->get(['v.*', 'r.code as reservation_code', 'r.title as reservation_title', 's.code as service_code', 's.service_time', 's.confirmation_code', 'p.name as provider_name']);
        $versions = DB::table('ops_voucher_versions')->whereIn('voucher_id', $vouchers->pluck('id'))->orderBy('version')->get(['voucher_id', 'version', 'issued_at', 'issued_by', 'reason'])->groupBy('voucher_id');
        $pending = $this->pending();
        $canIssue = $viewer->can('operations.vouchers');

        return [
            'today' => $this->common->today(),
            'can' => ['issue' => $canIssue],
            'kpis' => [
                'issued' => $vouchers->where('status', 'emitido')->count(),
                'used' => $vouchers->where('status', 'utilizado')->count(),
                'voided' => $vouchers->where('status', 'anulado')->count(),
                'pending' => $pending->count(),
            ],
            'items' => $vouchers->map(fn (object $voucher): array => [
                'code' => $voucher->code,
                'lock_version' => (int) $voucher->lock_version,
                'status' => $voucher->status,
                'version' => (int) $voucher->version,
                'reservation' => ['code' => $voucher->reservation_code, 'title' => $voucher->reservation_title],
                'service' => ['code' => $voucher->service_code, 'label' => $voucher->service_label, 'date' => $voucher->service_date, 'time' => OpsCommon::time($voucher->service_time), 'confirmation' => $voucher->confirmation_code],
                'provider' => $voucher->provider_name,
                'pax' => (int) $voucher->pax,
                'note' => $voucher->note,
                'issued_at' => $voucher->issued_at,
                'issued_by' => $voucher->issued_by ? ($names[$voucher->issued_by] ?? null) : null,
                'used_at' => $voucher->used_at,
                'used_via' => $voucher->used_via,
                'void_reason' => $voucher->void_reason,
                'void_at' => $voucher->void_at,
                'versions' => collect($versions[$voucher->id] ?? [])->map(fn ($version) => [
                    'version' => (int) $version->version,
                    'issued_at' => $version->issued_at,
                    'issued_by' => $version->issued_by ? ($names[$version->issued_by] ?? null) : null,
                    'reason' => $version->reason,
                ])->values(),
            ])->values(),
            'pending' => $pending,
            'providers' => $canIssue ? DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['id as value', 'name as label', 'type as hint']) : [],
        ];
    }

    public function find(User $viewer, string $reference): ?array
    {
        $voucher = DB::table('ops_vouchers as v')
            ->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')
            ->join('booking_reservation_services as s', 's.id', '=', 'v.reservation_service_id')
            ->join('catalog_providers as p', 'p.id', '=', 'v.provider_id')
            ->where(Str::isUuid($reference) ? 'v.id' : 'v.code', $reference)
            ->first(['v.*', 'r.code as reservation_code', 'r.title as reservation_title', 's.code as service_code', 's.service_time', 's.confirmation_code', 's.status as service_status', 'p.ref as provider_ref', 'p.name as provider_name']);

        if ($voucher === null) {
            return null;
        }

        $names = $this->common->userNames();
        $name = fn (?string $id): ?string => $id ? ($names[$id] ?? null) : null;

        return [
            'id' => $voucher->id,
            'code' => $voucher->code,
            'lock_version' => (int) $voucher->lock_version,
            'status' => $voucher->status,
            'version' => (int) $voucher->version,
            'origin' => $voucher->origin,
            'reservation' => ['code' => $voucher->reservation_code, 'title' => $voucher->reservation_title],
            'service' => ['code' => $voucher->service_code, 'label' => $voucher->service_label, 'date' => $voucher->service_date, 'time' => OpsCommon::time($voucher->service_time), 'status' => $voucher->service_status, 'confirmation' => $voucher->confirmation_code],
            'provider' => ['ref' => $voucher->provider_ref, 'name' => $voucher->provider_name],
            'pax' => (int) $voucher->pax,
            'note' => $voucher->note,
            'issued_at' => $voucher->issued_at,
            'issued_by' => $name($voucher->issued_by),
            'used_at' => $voucher->used_at,
            'used_by' => $name($voucher->used_by),
            'used_via' => $voucher->used_via,
            'void_reason' => $voucher->void_reason,
            'void_at' => $voucher->void_at,
            'void_by' => $name($voucher->void_by),
            'versions' => DB::table('ops_voucher_versions')->where('voucher_id', $voucher->id)->orderBy('version')->get(['version', 'issued_at', 'issued_by', 'reason', 'snapshot'])
                ->map(fn (object $version): array => ['version' => (int) $version->version, 'issued_at' => $version->issued_at, 'issued_by' => $name($version->issued_by), 'reason' => $version->reason, 'snapshot' => json_decode((string) $version->snapshot, true)])->values(),
            'notifications' => DB::table('notif_messages')->where('source_type', 'ops_voucher')->where('source_id', $voucher->id)->orderByDesc('created_at')
                ->get(['event_code', 'channel', 'audience', 'recipient_address', 'subject', 'status', 'created_at'])
                ->map(fn (object $message): array => ['event' => $message->event_code, 'channel' => $message->channel, 'audience' => $message->audience, 'recipient' => $message->recipient_address, 'subject' => $message->subject, 'status' => $message->status, 'created_at' => $message->created_at])->values(),
            'can' => ['manage' => $viewer->can('operations.vouchers') && $voucher->status === 'emitido'],
        ];
    }

    public function pending(): Collection
    {
        return DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('catalog_products as pr', 'pr.id', '=', 's.product_id')
            ->leftJoin('catalog_providers as p', 'p.id', '=', DB::raw('coalesce(s.provider_id, pr.main_provider_id)'))
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador', 'completada'])
            ->whereIn('s.status', ['confirmado', 'completado'])
            ->where('s.service_kind', '<>', 'libre')
            ->whereNotExists(fn ($query) => $query->from('ops_vouchers as v')->whereColumn('v.reservation_service_id', 's.id')->whereIn('v.status', ['emitido', 'utilizado']))
            ->orderBy('s.service_date')->orderBy('s.service_time')
            ->get(['s.code', 's.name', 's.service_date', 's.service_time', 's.status', 's.service_kind', 's.confirmation_code', 'r.code as reservation_code', 'r.title as reservation_title', 'p.id as provider_id', 'p.name as provider_name'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'date' => $row->service_date,
                'time' => OpsCommon::time($row->service_time),
                'status' => $row->status,
                'kind' => $row->service_kind,
                'confirmation' => $row->confirmation_code,
                'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title],
                'provider' => $row->provider_id ? ['id' => $row->provider_id, 'name' => $row->provider_name] : null,
            ])->values();
    }
}
