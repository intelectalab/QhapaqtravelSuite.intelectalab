<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Jobs\RemindTravelDocuments;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TravelDocRules
{
    public const SECTION = 'travel_docs';

    public const CHANNELS = ['Email', 'WhatsApp'];

    public const DEFAULTS = [
        'reminder_days' => RemindTravelDocuments::DEFAULT_DAYS,
        'channels' => self::CHANNELS,
        'passport_months' => 6,
        'visa_nationalities' => ['China', 'India', 'Vietnamita'],
        'insurance_trekking' => true,
    ];

    public const CLINICAL = '/diagn|enfermedad|patolog|diabet|epileps|c[aá]ncer|vih|depresi|ansiedad|trastorno/iu';

    public const RELATIONS = ['Familiar', 'Pareja', 'Amigo(a)', 'Empresa', 'Otro'];

    public const AMAZON = 'loreto|amazon|madre de dios';

    public function settings(): array
    {
        $values = (array) json_decode((string) DB::table('sys_settings')->where('section', self::SECTION)->value('values'), true);
        $days = array_values(array_filter(array_map('intval', (array) ($values['reminder_days'] ?? [])), fn (int $day): bool => $day > 0));
        $channels = array_values(array_intersect(self::CHANNELS, (array) ($values['channels'] ?? [])));
        $nationalities = array_values(array_filter(array_map(fn ($value) => trim((string) $value), (array) ($values['visa_nationalities'] ?? self::DEFAULTS['visa_nationalities']))));

        return [
            'reminder_days' => $days === [] ? self::DEFAULTS['reminder_days'] : $days,
            'channels' => $channels === [] ? self::DEFAULTS['channels'] : $channels,
            'passport_months' => isset($values['passport_months']) ? max(0, (int) $values['passport_months']) : self::DEFAULTS['passport_months'],
            'visa_nationalities' => array_key_exists('visa_nationalities', $values) ? $nationalities : self::DEFAULTS['visa_nationalities'],
            'insurance_trekking' => array_key_exists('insurance_trekking', $values) ? (bool) $values['insurance_trekking'] : self::DEFAULTS['insurance_trekking'],
        ];
    }

    public static function foreign(?string $nationality): bool
    {
        return preg_match('/peru/iu', (string) $nationality) !== 1;
    }

    public static function minor(object $passenger, ?string $travelFrom): bool
    {
        if (in_array($passenger->pax_type ?? null, ['CHD', 'INF'], true)) {
            return true;
        }

        $birth = $passenger->birth_date ?? null;

        return $birth !== null && $travelFrom !== null && CarbonImmutable::parse($birth)->diffInYears(CarbonImmutable::parse($travelFrom)) < 18;
    }

    public function trekking(Collection $reservationIds): Collection
    {
        return DB::table('booking_reservation_services as s')
            ->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->join('catalog_product_categories as c', 'c.id', '=', 'p.category_id')
            ->whereIn('s.reservation_id', $reservationIds->all())->where('s.status', '<>', 'cancelado')->where('c.name', 'Aventura')
            ->distinct()->pluck('s.reservation_id')->flip();
    }

    public function amazon(Collection $reservationIds): Collection
    {
        $byDestination = DB::table('booking_reservation_services as s')
            ->join('catalog_products as p', 'p.id', '=', 's.product_id')
            ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereIn('s.reservation_id', $reservationIds->all())->where('s.status', '<>', 'cancelado')
            ->where(fn ($query) => $query->where('d.path', '~*', self::AMAZON)->orWhere('d.name', '~*', self::AMAZON))
            ->distinct()->pluck('s.reservation_id');
        $byRequirement = DB::table('booking_reservation_services as s')
            ->join('catalog_product_requirements as q', 'q.product_id', '=', 's.product_id')
            ->whereIn('s.reservation_id', $reservationIds->all())->where('s.status', '<>', 'cancelado')->where('q.text', '~*', 'fiebre amarilla')
            ->distinct()->pluck('s.reservation_id');

        return $byDestination->merge($byRequirement)->unique()->flip();
    }

    public function applies(string $type, object $passenger, ?string $travelFrom, bool $trekking, array $settings, bool $amazon = false): bool
    {
        $foreign = self::foreign($passenger->nationality ?? null);

        return match ($type) {
            'yellow_fever' => $amazon,
            'visa' => $foreign && collect($settings['visa_nationalities'])->contains(fn (string $country) => str_starts_with(mb_strtolower((string) ($passenger->nationality ?? '')), mb_strtolower(mb_substr($country, 0, 4)))),
            'insurance' => $foreign || ($settings['insurance_trekking'] && $trekking),
            'minor_auth' => self::minor($passenger, $travelFrom),
            'migration' => $foreign,
            default => true,
        };
    }

    public function minExpiry(object $passenger, string $travelTo, array $settings): string
    {
        return self::foreign($passenger->nationality ?? null) ? CarbonImmutable::parse($travelTo)->addMonths((int) $settings['passport_months'])->toDateString() : $travelTo;
    }
}
