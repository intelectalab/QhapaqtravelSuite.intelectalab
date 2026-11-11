<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use App\Domain\Channels\Support\OwnReviewIntake;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use stdClass;

final class ReviewByToken
{
    private const OPEN = ['enviada', 'abierta'];

    private const DISABLED = 'Las reseñas no están habilitadas para esta agencia.';

    public function __construct(private readonly OwnReviewIntake $intake, private readonly TenantContext $context) {}

    public function show(string $code, string $token): array
    {
        $this->intake->ensureEnabled(self::DISABLED);
        $request = $this->request($code, $token, false);

        if ($request->status === 'enviada') {
            DB::table('crm_review_requests')->where('id', $request->id)->update(['status' => 'abierta', 'opened_at' => now(), 'updated_at' => now()]);
        }

        $reservation = $this->reservation($request);
        $client = DB::table('crm_clients')->where('id', $request->client_id)->first(['name']);

        return [
            'code' => $request->code,
            'agency' => (string) $this->context->tenant()->commercial_name,
            'traveler' => trim(explode(' ', trim((string) ($client->name ?? '')))[0]),
            'trip' => ['code' => $reservation->code, 'title' => $reservation->title, 'from' => $reservation->travel_from, 'to' => $reservation->travel_to],
            'expires_at' => Carbon::parse($request->expires_at)->toIso8601String(),
            'subratings' => OwnReviewIntake::subratings(),
            'items' => collect(OwnReviewIntake::items($reservation, null, true))->map(fn (array $item): array => [...$item, 'product' => ['code' => $item['product']['code'], 'name' => $item['product']['name']]])->all(),
        ];
    }

    public function submit(array $data): array
    {
        $this->intake->ensureEnabled(self::DISABLED);

        return DB::transaction(function () use ($data): array {
            $request = $this->request((string) $data['code'], (string) $data['t'], true);
            $reservation = $this->reservation($request);
            $item = OwnReviewIntake::pick(OwnReviewIntake::items($reservation, null, true), (string) $data['product']);
            $client = DB::table('crm_clients')->where('id', $request->client_id)->first(['name']);

            return $this->intake->record($reservation, $item, $data, [
                'name' => (string) ($client->name ?? 'Viajero'),
                'client_id' => $request->client_id,
                'user_id' => null,
                'source' => 'email',
                'request_id' => $request->id,
            ]);
        });
    }

    private function request(string $code, string $token, bool $lock): stdClass
    {
        $query = DB::table('crm_review_requests')->where('code', $code);
        $request = ($lock ? $query->lockForUpdate() : $query)->first(['id', 'code', 'reservation_id', 'client_id', 'token_hash', 'status', 'expires_at']);

        if ($request === null || $token === '' || ! hash_equals((string) $request->token_hash, hash('sha256', $token))) {
            throw ApiException::notFound('El enlace para opinar no es válido.');
        }

        if ($request->status === 'respondida') {
            throw ApiException::conflict('RVW-03', 'Ya usaste este enlace para dejar tu opinión. Gracias.');
        }

        $expired = $request->status === 'vencida' || ($request->expires_at !== null && Carbon::parse($request->expires_at)->isPast());

        if ($expired) {
            if ($request->status !== 'vencida') {
                DB::table('crm_review_requests')->where('id', $request->id)->update(['status' => 'vencida', 'updated_at' => now()]);
            }

            throw new ApiException(410, 'GONE', 'REVIEW_LINK_EXPIRED', 'Este enlace venció. Pide a la agencia uno nuevo.');
        }

        if (! in_array($request->status, self::OPEN, true)) {
            throw ApiException::notFound('El enlace para opinar no es válido.');
        }

        return $request;
    }

    private function reservation(stdClass $request): stdClass
    {
        return DB::table('booking_reservations')->where('id', $request->reservation_id)->first(['id', 'code', 'title', 'status', 'travel_from', 'travel_to']);
    }
}
