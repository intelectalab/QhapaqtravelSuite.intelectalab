<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Channels\Support\OwnReviewIntake;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class PassengerReviews
{
    public const SUBRATINGS = OwnReviewSettings::SUBRATINGS;

    private const DISABLED = 'Las reseñas desde el portal no están habilitadas para tu agencia.';

    public function __construct(private readonly OwnReviewIntake $intake) {}

    public static function rules(): array
    {
        return ['trip' => ['nullable', 'string', 'max:30'], ...OwnReviewIntake::rules()];
    }

    public static function messages(): array
    {
        return OwnReviewIntake::messages();
    }

    public function overview(PortalAccount $account, ?string $trip): array
    {
        $this->intake->ensureEnabled(self::DISABLED);
        $reservation = $this->reservation($account, $trip);

        return [
            'trip' => ['code' => $reservation->code, 'title' => $reservation->title, 'status' => $reservation->status],
            'subratings' => OwnReviewIntake::subratings(),
            'items' => OwnReviewIntake::items($reservation, (string) $account->user->getKey()),
        ];
    }

    public function create(PortalAccount $account, array $data): array
    {
        $this->intake->ensureEnabled(self::DISABLED);
        $reservation = $this->reservation($account, $data['trip'] ?? null);
        $item = OwnReviewIntake::pick(OwnReviewIntake::items($reservation, (string) $account->user->getKey()), (string) $data['product']);

        return $this->intake->record($reservation, $item, $data, [
            'name' => $account->user->name,
            'client_id' => $account->client->id,
            'user_id' => $account->user->getKey(),
            'source' => 'portal',
        ]);
    }

    private function reservation(PortalAccount $account, ?string $trip): object
    {
        $row = $trip ? $account->reservation($trip) : ($account->reservations()->first() ?? throw ApiException::notFound('No encontramos un viaje en tu cuenta.'));

        return DB::table('booking_reservations')->where('id', $row->id)->first(['id', 'code', 'title', 'status', 'travel_from']);
    }
}
