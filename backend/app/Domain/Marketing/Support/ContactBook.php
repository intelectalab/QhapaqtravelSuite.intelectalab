<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ContactBook
{
    public const FIELDS = [
        'consent' => 'Consentimiento',
        'dest' => 'Destino de interés',
        'segment' => 'Segmento',
        'spent' => 'Gasto total (S/)',
        'country' => 'País',
        'type' => 'Tipo de contacto',
        'last' => 'Última compra',
        'nps' => 'NPS',
        'tags' => 'Etiqueta',
    ];

    private const OPERATORS = ['eq' => 'es', 'neq' => 'no es', 'contains' => 'contiene', 'has' => 'tiene', 'gte' => '≥', 'lte' => '≤', 'older' => 'hace más de', 'within' => 'en los últimos', 'none' => 'sin'];

    private const TYPES = ['client' => 'Cliente', 'lead' => 'Lead', 'subscriber' => 'Suscriptor'];

    private ?Collection $contacts = null;

    public function all(): Collection
    {
        return $this->contacts ??= $this->load();
    }

    public function match(string $match, array $rules): Collection
    {
        return $this->all()->filter(function (array $contact) use ($match, $rules): bool {
            if ($rules === []) {
                return true;
            }

            $results = array_map(fn (array $rule): bool => $this->test($contact, $rule), $rules);

            return $match === 'any' ? in_array(true, $results, true) : ! in_array(false, $results, true);
        })->values();
    }

    public function audience(string $match, array $rules, string $channel): array
    {
        $matched = $this->match($match, $rules);
        $address = $channel === 'email' ? 'email' : 'mobile';
        $optout = $matched->filter(fn (array $contact): bool => $contact['revoked'][$channel] ?? false);
        $nodata = $matched->reject(fn (array $contact): bool => $contact['revoked'][$channel] ?? false)->filter(fn (array $contact): bool => empty($contact[$address]));
        $consent = $matched->reject(fn (array $contact): bool => ($contact['revoked'][$channel] ?? false) || empty($contact[$address]))->reject(fn (array $contact): bool => $contact['consent'][$channel]);
        $eligible = $matched->filter(fn (array $contact): bool => $contact['consent'][$channel] && ! empty($contact[$address]));

        return ['matched' => $matched->count(), 'eligible' => $eligible->count(), 'optout' => $optout->count(), 'nodata' => $nodata->count(), 'consent' => $consent->count()];
    }

    public function describe(array $rules, string $match): string
    {
        $parts = array_map(function (array $rule): string {
            $field = self::FIELDS[$rule['f']] ?? $rule['f'];
            $value = match ($rule['f']) {
                'type' => self::TYPES[$rule['v']] ?? $rule['v'],
                'spent' => 'S/ '.number_format((float) $rule['v'], 0, ',', ' '),
                'last' => "{$rule['v']} días",
                'consent' => $rule['v'] === 'whatsapp' ? 'WhatsApp' : 'email',
                default => (string) $rule['v'],
            };

            return trim($field.' '.(self::OPERATORS[$rule['op']] ?? $rule['op']).' '.$value);
        }, $rules);

        return implode($match === 'any' ? ' o ' : ' y ', $parts);
    }

    private function test(array $contact, array $rule): bool
    {
        $value = $rule['v'] ?? null;

        return match ($rule['f']) {
            'consent' => $contact['consent'][$value] ?? false,
            'dest' => Str::contains(Str::lower(Str::ascii($contact['dest'])), Str::lower(Str::ascii((string) $value))),
            'segment' => $rule['op'] === 'neq' ? $contact['segment'] !== $value : $contact['segment'] === $value,
            'spent' => $rule['op'] === 'lte' ? $contact['spent'] <= (float) $value : $contact['spent'] >= (float) $value,
            'country' => $rule['op'] === 'neq' ? $contact['country'] !== null && $contact['country'] !== $value : $contact['country'] === $value,
            'type' => $contact['type'] === $value,
            'last' => match ($rule['op']) {
                'within' => $contact['last_purchase'] !== null && Carbon::parse($contact['last_purchase'])->gte(Carbon::today()->subDays((int) $value)),
                'none' => $contact['last_purchase'] === null,
                default => $contact['type'] === 'client' && ($contact['last_purchase'] === null || Carbon::parse($contact['last_purchase'])->lt(Carbon::today()->subDays((int) $value))),
            },
            'nps' => $contact['nps'] !== null && ($rule['op'] === 'lte' ? $contact['nps'] <= (int) $value : $contact['nps'] >= (int) $value),
            'tags' => in_array($value, $contact['tags'], true),
            default => false,
        };
    }

    private function load(): Collection
    {
        $consents = DB::table('mkt_consents')->get(['subject_type', 'subject_id', 'channel', 'status'])->groupBy(fn (object $row): string => "{$row->subject_type}:{$row->subject_id}");
        $purchases = DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['borrador', 'cancelada'])
            ->selectRaw('client_id, sum(total_amount * fx_rate) as spent, max(created_at) as last, string_agg(title, \' \') as titles')->groupBy('client_id')->get()->keyBy('client_id');

        $clients = DB::table('crm_clients')->whereNull('deleted_at')->get(['id', 'code', 'name', 'email', 'phone', 'country', 'segment_code', 'tags', 'nps_last'])
            ->map(fn (object $row): array => $this->contact('client', $row->id, $row->code, $row->name, $row->email, $row->phone, $row->country, $consents, [
                'segment' => $row->segment_code,
                'tags' => $this->tags($row->tags),
                'nps' => $row->nps_last !== null ? (int) $row->nps_last : null,
                'spent' => (float) ($purchases[$row->id]->spent ?? 0),
                'last_purchase' => $purchases[$row->id]->last ?? null,
                'dest' => (string) ($purchases[$row->id]->titles ?? ''),
            ]));
        $emails = $clients->pluck('email')->filter()->map(fn (string $email): string => Str::lower($email))->all();

        $leads = DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado'])->get(['id', 'code', 'full_name', 'email', 'phone', 'destination_label'])
            ->reject(fn (object $row): bool => $row->email !== null && in_array(Str::lower($row->email), $emails, true))
            ->map(fn (object $row): array => $this->contact('lead', $row->id, $row->code, $row->full_name, $row->email, $row->phone, null, $consents, ['dest' => (string) $row->destination_label]));

        $subscribers = DB::table('mkt_contacts_subscribers')->whereNull('deleted_at')->whereNull('client_id')->get(['id', 'code', 'full_name', 'email', 'phone', 'country', 'interest_destination'])
            ->map(fn (object $row): array => $this->contact('subscriber', $row->id, $row->code, $row->full_name, $row->email, $row->phone, $row->country, $consents, ['dest' => (string) $row->interest_destination]));

        return $clients->concat($leads)->concat($subscribers)->values();
    }

    private function contact(string $type, string $id, string $code, string $name, ?string $email, ?string $phone, ?string $country, Collection $consents, array $extra): array
    {
        $records = $consents->get("{$type}:{$id}", collect());
        $digits = preg_replace('/\D/', '', (string) $phone);
        $mobile = $digits !== '' && ((strlen($digits) === 9 && str_starts_with($digits, '9')) || (strlen($digits) === 11 && str_starts_with($digits, '519')) || (strlen($digits) >= 10 && ! str_starts_with($digits, '51')));

        return [
            'type' => $type,
            'type_label' => self::TYPES[$type],
            'id' => $id,
            'code' => $code,
            'name' => $name,
            'email' => $email,
            'mobile' => $mobile ? $phone : null,
            'country' => $country,
            'segment' => $extra['segment'] ?? null,
            'tags' => $extra['tags'] ?? [],
            'nps' => $extra['nps'] ?? null,
            'spent' => $extra['spent'] ?? 0.0,
            'last_purchase' => $extra['last_purchase'] ?? null,
            'dest' => $extra['dest'] ?? '',
            'consent' => [
                'email' => $records->contains(fn ($row): bool => $row->channel === 'email' && $row->status === 'otorgado'),
                'whatsapp' => $records->contains(fn ($row): bool => $row->channel === 'whatsapp' && $row->status === 'otorgado'),
            ],
            'revoked' => [
                'email' => $records->contains(fn ($row): bool => $row->channel === 'email' && $row->status === 'revocado'),
                'whatsapp' => $records->contains(fn ($row): bool => $row->channel === 'whatsapp' && $row->status === 'revocado'),
            ],
        ];
    }

    private function tags(mixed $value): array
    {
        $trimmed = trim((string) $value, '{}');

        return $trimmed === '' ? [] : array_map(fn (string $item): string => trim($item, '"'), str_getcsv($trimmed));
    }
}
