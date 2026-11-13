<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Documents\Support\QrImage;
use App\Domain\Finance\Support\GrowthFeatureGate;
use App\Domain\Operations\Actions\Checkin;
use App\Domain\Operations\Support\CheckinPasses;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class PassengerPasses
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly CheckinPasses $passes,
        private readonly AuditLogger $audit,
        private readonly GrowthFeatureGate $gate,
    ) {}

    public function overview(PortalAccount $account, ?string $tripCode): array
    {
        $this->gate->require(CheckinPasses::RULE);
        $reservation = $tripCode ? $account->reservation($tripCode) : $account->reservations()->first(fn (object $row) => ! in_array($row->status, ['cancelada', 'completada'], true)) ?? $account->reservations()->first();

        if ($reservation === null) {
            return ['trip' => null, 'passes' => [], 'passengers' => [], 'waiver' => null];
        }

        $this->passes->ensure((string) $reservation->id);
        $today = Carbon::now($this->context->timezone())->toDateString();
        $template = $this->passes->activeTemplate();
        $signatures = $this->passes->signatures((string) $reservation->id, $template);
        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('is_placeholder', false)->orderByDesc('is_lead')->orderBy('seq')->get(['id', 'full_name', 'pax_type', 'birth_date', 'age', 'is_lead']);
        $rows = DB::table('ops_checkin_passes as p')->join('booking_reservation_services as s', 's.id', '=', 'p.service_id')
            ->where('p.reservation_id', $reservation->id)->where('p.status', '<>', 'anulado')->where('s.service_date', '>=', $today)
            ->orderBy('s.service_date')->orderBy('s.service_time')->get(['p.id', 'p.passenger_id', 'p.status', 'p.scanned_at', 's.code', 's.name', 's.service_date', 's.service_time']);
        $names = $passengers->pluck('full_name', 'id');

        return [
            'trip' => ['code' => $reservation->code, 'title' => $reservation->title, 'travel_from' => $reservation->travel_from, 'travel_to' => $reservation->travel_to],
            'passes' => $rows->groupBy('code')->map(fn ($items) => [
                'service' => ['code' => $items->first()->code, 'name' => $items->first()->name, 'date' => $items->first()->service_date, 'time' => $items->first()->service_time ? mb_substr((string) $items->first()->service_time, 0, 5) : null, 'is_today' => $items->first()->service_date === $today],
                'passengers' => $items->map(fn (object $pass) => [
                    'passenger_id' => $pass->passenger_id,
                    'name' => $names[$pass->passenger_id] ?? '',
                    'status' => $pass->status,
                    'status_label' => CheckinPasses::STATUSES[$pass->status] ?? $pass->status,
                    'token' => $pass->status === 'emitido' ? CheckinPasses::token((string) $pass->id) : null,
                    'qr' => $pass->status === 'emitido' ? QrImage::dataUri(CheckinPasses::token((string) $pass->id), 5) : null,
                    'scanned_at' => $pass->scanned_at ? Carbon::parse((string) $pass->scanned_at)->toIso8601String() : null,
                ])->values()->all(),
            ])->values()->all(),
            'passengers' => $passengers->map(function (object $passenger) use ($template, $signatures, $today): array {
                $state = CheckinPasses::waiverState($passenger, $template, $signatures, $today);

                return [
                    'id' => $passenger->id,
                    'name' => $passenger->full_name,
                    'is_lead' => (bool) $passenger->is_lead,
                    'minor' => CheckinPasses::isMinor($passenger, $today),
                    'waiver' => $state,
                    'waiver_label' => Checkin::WAIVER_STATES[$state],
                    'signed_at' => isset($signatures[$passenger->id]) ? Carbon::parse((string) $signatures[$passenger->id]->signed_at)->toIso8601String() : null,
                ];
            })->values()->all(),
            'waiver' => $template ? ['code' => $template->code, 'name' => $template->name, 'version' => (int) $template->version, 'lang' => $template->lang, 'body' => $template->body, 'requires_guardian_for_minors' => (bool) $template->requires_guardian_for_minors] : null,
        ];
    }

    public function sign(PortalAccount $account, array $data, UploadedFile $file): array
    {
        $this->gate->require(CheckinPasses::RULE);

        return DB::transaction(function () use ($account, $data, $file): array {
            $reservationIds = $account->reservations()->pluck('id');
            $passenger = DB::table('booking_passengers')->where('id', $data['passenger_id'])->whereIn('reservation_id', $reservationIds)->first(['id', 'reservation_id', 'full_name', 'birth_date', 'age', 'pax_type']);

            if ($passenger === null) {
                throw ApiException::notFound('No encontramos ese pasajero en tu viaje.');
            }

            $template = DB::table('ops_waiver_templates')->where('code', $data['template_code'])->where('active', true)->orderByDesc('version')->first(['id', 'code', 'version', 'body', 'requires_guardian_for_minors']);

            if ($template === null) {
                throw ApiException::unprocessable('WAIVER_TEMPLATE_NOT_ACTIVE', 'Ese deslinde ya no está vigente. Recarga la página para ver el texto actual.');
            }

            $today = Carbon::now($this->context->timezone())->toDateString();
            $guardian = trim((string) ($data['guardian_name'] ?? ''));

            if ($template->requires_guardian_for_minors && CheckinPasses::isMinor($passenger, $today) && $guardian === '') {
                throw ApiException::unprocessable('GUARDIAN_REQUIRED', $passenger->full_name.' es menor de edad: escribe el nombre de su madre, padre o tutor.');
            }

            if (DB::table('ops_waiver_signatures')->where('template_id', $template->id)->where('template_version', $template->version)->where('reservation_id', $passenger->reservation_id)->where('passenger_id', $passenger->id)->exists()) {
                throw ApiException::conflict('WAIVER_ALREADY_SIGNED', $passenger->full_name.' ya firmó este deslinde.');
            }

            $id = (string) Str::uuid7();
            $path = 'waivers/'.$this->context->idOrFail().'/'.$id.'.'.($file->extension() ?: 'png');
            Storage::disk('local')->put($path, (string) file_get_contents((string) $file->getRealPath()));

            DB::table('ops_waiver_signatures')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'template_id' => $template->id,
                'template_version' => $template->version,
                'body_sha256' => hash('sha256', (string) $template->body),
                'reservation_id' => $passenger->reservation_id,
                'passenger_id' => $passenger->id,
                'signed_name' => trim((string) $data['signed_name']),
                'guardian_name' => $guardian !== '' ? $guardian : null,
                'signature_path' => $path,
                'ip' => Request::ip(),
                'user_agent' => mb_substr((string) Request::userAgent(), 0, 300) ?: null,
            ]);
            $this->audit->log('Deslinde firmado', (string) $template->code, 'firmar', after: 'v'.$template->version.' · '.$passenger->full_name.($guardian !== '' ? ' · tutor '.$guardian : ''), actor: $account->user);

            return ['passenger_id' => $passenger->id, 'name' => $passenger->full_name, 'template' => $template->code, 'version' => (int) $template->version, 'waiver' => 'firmado', 'signed_at' => now()->toIso8601String(), 'message' => 'Deslinde firmado. Ya puedes usar tu pase el día del servicio.'];
        });
    }
}
