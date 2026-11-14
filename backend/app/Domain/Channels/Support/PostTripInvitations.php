<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use stdClass;

final class PostTripInvitations
{
    private const DAYS = 120;

    private const LIMIT = 300;

    public function __construct(private readonly ExternalReviewLinks $links, private readonly ChannelKit $kit, private readonly RuleResolver $rules) {}

    public function overview(): array
    {
        $today = $this->kit->today();
        $reservations = DB::table('booking_reservations as r')->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])->whereNotNull('r.travel_to')
            ->where('r.travel_to', '<', $today)->where('r.travel_to', '>=', now()->subDays(self::DAYS)->toDateString())
            ->orderByDesc('r.travel_to')->limit(self::LIMIT)
            ->get(['r.id', 'r.code', 'r.title', 'r.travel_to', 'c.name as client']);
        $requests = DB::table('crm_review_requests')->whereIn('reservation_id', $reservations->pluck('id'))->where('status', '<>', 'cancelada')
            ->orderBy('created_at')->get(['id', 'reservation_id', 'code', 'status', 'channel', 'to_address', 'sent_at', 'opened_at', 'scheduled_at']);
        $clicks = DB::table('crm_review_link_clicks')->whereIn('request_id', $requests->pluck('id'))->selectRaw('request_id, target, count(*) as total')->groupBy('request_id', 'target')->get();
        $loaded = array_keys($this->links->loaded());

        $rows = $reservations->map(function (stdClass $reservation) use ($requests, $clicks): array {
            $own = $requests->where('reservation_id', $reservation->id);
            $ids = $own->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();
            $last = $own->last();
            $count = fn (string $target): int => (int) $clicks->filter(fn (stdClass $c): bool => in_array((string) $c->request_id, $ids, true) && $c->target === $target)->sum('total');

            return [
                'reservation' => ['code' => $reservation->code, 'title' => $reservation->title, 'client' => $reservation->client],
                'travel_to' => $reservation->travel_to,
                'invitation' => $last === null ? null : ['code' => $last->code, 'status' => $last->status, 'channel' => $last->channel, 'sent_at' => $last->sent_at ?? $last->scheduled_at],
                'invited' => $own->pluck('to_address')->unique()->count(),
                'clicks' => [
                    'own' => $own->whereNotNull('opened_at')->count(),
                    'google' => $count('google'),
                    'tripadvisor' => $count('tripadvisor'),
                ],
            ];
        })->values();

        $invited = $rows->filter(fn (array $row): bool => $row['invitation'] !== null);

        return [
            'rows' => $rows,
            'platforms' => collect(ExternalReviewLinks::PLATFORMS)->map(fn (array $platform, string $key): array => ['platform' => $key, 'label' => $platform['label'], 'loaded' => in_array($key, $loaded, true)])->values()->all(),
            'rule_active' => $this->rules->on('R-REVIEW-INVITE'),
            'kpis' => [
                'finished' => $rows->count(),
                'invited' => $invited->count(),
                'own' => $invited->filter(fn (array $row): bool => $row['clicks']['own'] > 0)->count(),
                'external' => $invited->filter(fn (array $row): bool => $row['clicks']['google'] + $row['clicks']['tripadvisor'] > 0)->count(),
            ],
            'days' => self::DAYS,
        ];
    }

    public function click(string $code, string $token, string $target): string
    {
        $request = DB::table('crm_review_requests')->where('code', $code)->first(['id', 'token_hash', 'status']);

        if ($request === null || $token === '' || ! hash_equals((string) $request->token_hash, hash('sha256', $token)) || $request->status === 'cancelada') {
            throw ApiException::notFound('El enlace para opinar no es válido.');
        }

        $url = $this->links->loaded()[$target] ?? null;

        if ($url === null) {
            throw ApiException::notFound('La agencia ya no publica ese enlace de reseñas.');
        }

        DB::table('crm_review_link_clicks')->insert(['request_id' => $request->id, 'target' => $target]);

        return $url;
    }
}
