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
        'channel' => 'Canal de origen',
        'tags' => 'Etiqueta',
    ];

    public const SCHEMA = [
        'type' => ['ops' => ['eq'], 'kind' => 'choice'],
        'segment' => ['ops' => ['eq', 'neq'], 'kind' => 'choice'],
        'country' => ['ops' => ['eq', 'neq'], 'kind' => 'choice'],
        'dest' => ['ops' => ['contains'], 'kind' => 'text'],
        'last' => ['ops' => ['within', 'older', 'none'], 'kind' => 'number'],
        'spent' => ['ops' => ['gte', 'lte'], 'kind' => 'number'],
        'nps' => ['ops' => ['gte', 'lte', 'null'], 'kind' => 'number'],
        'channel' => ['ops' => ['eq'], 'kind' => 'choice'],
        'tags' => ['ops' => ['has'], 'kind' => 'choice'],
        'consent' => ['ops' => ['has', 'not'], 'kind' => 'choice'],
    ];

    public const SUPPRESSIONS = ['optout' => 'Baja registrada', 'nodata' => 'Sin dato válido para el canal', 'consent' => 'Sin consentimiento para el canal', 'fatigue' => 'Recibió otra campaña en las últimas 72 h'];

    private const OPERATORS = ['eq' => 'es', 'neq' => 'no es', 'contains' => 'contiene', 'has' => 'tiene', 'not' => 'sin', 'gte' => '≥', 'lte' => '≤', 'older' => 'hace más de', 'within' => 'en los últimos', 'none' => 'sin compras', 'null' => 'sin encuesta'];

    private const OPERATOR_LABELS = ['eq' => 'es', 'neq' => 'no es', 'contains' => 'incluye', 'has' => 'tiene', 'not' => 'sin consentimiento para', 'gte' => 'mayor o igual a', 'lte' => 'menor o igual a', 'older' => 'hace más de N días o nunca', 'within' => 'en los últimos N días', 'none' => 'sin compras', 'null' => 'sin encuesta'];

    private const NO_VALUE = ['none', 'null'];

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
        $split = $this->split($match, $rules, $channel);

        return ['matched' => $split['matched'], 'eligible' => count($split['eligible']), ...array_map('count', $split['suppressed'])];
    }

    public function split(string $match, array $rules, string $channel, array $fatigued = []): array
    {
        $matched = $this->match($match, $rules);
        $address = $channel === 'email' ? 'email' : 'mobile';
        $buckets = ['optout' => [], 'nodata' => [], 'consent' => [], 'fatigue' => []];
        $eligible = [];

        foreach ($matched as $contact) {
            $reason = match (true) {
                $contact['revoked'][$channel] ?? false => 'optout',
                empty($contact[$address]) => 'nodata',
                ! $contact['consent'][$channel] => 'consent',
                isset($fatigued["{$contact['type']}:{$contact['id']}"]) => 'fatigue',
                default => null,
            };

            if ($reason === null) {
                $eligible[] = [...$contact, 'to' => $contact[$address]];
            } else {
                $buckets[$reason][] = $contact;
            }
        }

        if ($fatigued === []) {
            unset($buckets['fatigue']);
        }

        return ['matched' => $matched->count(), 'eligible' => $eligible, 'suppressed' => $buckets];
    }

    public function preview(string $match, array $rules): array
    {
        $matched = $this->match($match, $rules);

        return [
            'matched' => $matched->count(),
            'by_type' => collect(self::TYPES)->map(fn (string $label, string $type): array => ['type' => $type, 'label' => $label, 'count' => $matched->where('type', $type)->count()])->values()->all(),
            'email' => $this->audience($match, $rules, 'email'),
            'whatsapp' => $this->audience($match, $rules, 'whatsapp'),
            'rules_text' => $this->describe($rules, $match),
            'sample' => $matched->take(10)->map(fn (array $contact): array => [
                'key' => "{$contact['type']}:{$contact['id']}",
                'code' => $contact['code'],
                'name' => $contact['name'],
                'type_label' => $contact['type_label'],
                'email' => $contact['email'],
                'mobile' => $contact['mobile'],
                'consent' => $contact['consent'],
                'revoked' => $contact['revoked'],
            ])->values()->all(),
        ];
    }

    public function rulesError(array $rules): ?string
    {
        foreach ($rules as $index => $rule) {
            $position = $index + 1;

            if (! is_array($rule) || ! isset(self::SCHEMA[$rule['f'] ?? ''])) {
                return "La regla {$position} usa un campo que no existe.";
            }

            $schema = self::SCHEMA[$rule['f']];

            if (! in_array($rule['op'] ?? null, $schema['ops'], true)) {
                return "La regla {$position} usa un operador que no aplica a ".Str::lower(self::FIELDS[$rule['f']]).'.';
            }

            if (in_array($rule['op'], self::NO_VALUE, true)) {
                continue;
            }

            $value = $rule['v'] ?? null;

            if ($schema['kind'] === 'number' && (! is_numeric($value) || (float) $value < 0)) {
                return "La regla {$position} necesita un número mayor o igual a cero.";
            }

            if ($schema['kind'] !== 'number' && (! is_string($value) || trim($value) === '')) {
                return "La regla {$position} necesita un valor.";
            }

            if ($rule['f'] === 'consent' && ! in_array($value, ['email', 'whatsapp'], true)) {
                return "La regla {$position} debe indicar email o WhatsApp.";
            }

            if ($rule['f'] === 'type' && ! isset(self::TYPES[$value])) {
                return "La regla {$position} debe indicar cliente, lead o suscriptor.";
            }

            if ($rule['f'] === 'nps' && (float) $value > 10) {
                return "La regla {$position}: el NPS va de 0 a 10.";
            }
        }

        return null;
    }

    public function normalize(array $rules): array
    {
        return array_values(array_map(function (array $rule): array {
            $kind = self::SCHEMA[$rule['f']]['kind'];
            $value = in_array($rule['op'], self::NO_VALUE, true) ? null : ($kind === 'number' ? (float) $rule['v'] + 0 : trim((string) $rule['v']));

            return ['f' => $rule['f'], 'op' => $rule['op'], 'v' => $value];
        }, $rules));
    }

    public function catalog(): array
    {
        $all = $this->all();
        $choices = fn (Collection $values): array => $values->filter(fn ($value): bool => is_string($value) && $value !== '')->unique()->sort()->values()->map(fn (string $value): array => ['value' => $value, 'label' => $value])->all();

        return collect(self::SCHEMA)->map(fn (array $schema, string $field): array => [
            'field' => $field,
            'label' => self::FIELDS[$field],
            'kind' => $schema['kind'],
            'ops' => array_map(fn (string $op): array => ['value' => $op, 'label' => self::OPERATOR_LABELS[$op], 'needs_value' => ! in_array($op, self::NO_VALUE, true)], $schema['ops']),
            'values' => match ($field) {
                'type' => collect(self::TYPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
                'consent' => [['value' => 'email', 'label' => 'Email'], ['value' => 'whatsapp', 'label' => 'WhatsApp']],
                'segment' => $choices($all->pluck('segment')),
                'country' => $choices($all->pluck('country')),
                'channel' => $choices($all->pluck('channel')),
                'tags' => $choices($all->pluck('tags')->flatten()),
                default => [],
            },
        ])->values()->all();
    }

    public function describe(array $rules, string $match): string
    {
        if ($rules === []) {
            return 'Todos los contactos';
        }

        $parts = array_map(function (array $rule): string {
            $field = self::FIELDS[$rule['f']] ?? $rule['f'];

            if (in_array($rule['op'], self::NO_VALUE, true)) {
                return trim($field.' '.self::OPERATORS[$rule['op']]);
            }

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
            'consent' => $rule['op'] === 'not' ? ! ($contact['consent'][$value] ?? false) : ($contact['consent'][$value] ?? false),
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
            'nps' => $rule['op'] === 'null' ? $contact['nps'] === null : $contact['nps'] !== null && ($rule['op'] === 'lte' ? $contact['nps'] <= (int) $value : $contact['nps'] >= (int) $value),
            'channel' => $contact['channel'] === $value,
            'tags' => in_array($value, $contact['tags'], true),
            default => false,
        };
    }

    private function load(): Collection
    {
        $consents = DB::table('mkt_consents')->get(['subject_type', 'subject_id', 'channel', 'status'])->groupBy(fn (object $row): string => "{$row->subject_type}:{$row->subject_id}");
        $purchases = DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['borrador', 'cancelada'])
            ->selectRaw('client_id, sum(total_amount * fx_rate) as spent, max(created_at) as last, string_agg(title, \' \') as titles')->groupBy('client_id')->get()->keyBy('client_id');
        $channels = DB::table('crm_catalog_items')->where('kind', 'lead_channel')->pluck('label', 'code');
        $leadChannels = DB::table('crm_leads')->pluck('channel_code', 'id');
        $channel = fn (?string $code): ?string => $code === null ? null : (string) ($channels[$code] ?? $code);

        $clients = DB::table('crm_clients')->whereNull('deleted_at')->get(['id', 'code', 'name', 'email', 'phone', 'country', 'segment_code', 'tags', 'nps_last', 'source_lead_id'])
            ->map(fn (object $row): array => $this->contact('client', $row->id, $row->code, $row->name, $row->email, $row->phone, $row->country, $consents, [
                'segment' => $row->segment_code,
                'tags' => $this->tags($row->tags),
                'nps' => $row->nps_last !== null ? (int) $row->nps_last : null,
                'spent' => (float) ($purchases[$row->id]->spent ?? 0),
                'last_purchase' => $purchases[$row->id]->last ?? null,
                'dest' => (string) ($purchases[$row->id]->titles ?? ''),
                'channel' => $channel($row->source_lead_id !== null ? ($leadChannels[$row->source_lead_id] ?? null) : null),
            ]));
        $emails = $clients->pluck('email')->filter()->map(fn (string $email): string => Str::lower($email))->all();

        $leads = DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado'])->get(['id', 'code', 'full_name', 'email', 'phone', 'destination_label', 'channel_code'])
            ->reject(fn (object $row): bool => $row->email !== null && in_array(Str::lower($row->email), $emails, true))
            ->map(fn (object $row): array => $this->contact('lead', $row->id, $row->code, $row->full_name, $row->email, $row->phone, null, $consents, ['dest' => (string) $row->destination_label, 'channel' => $channel($row->channel_code)]));

        $subscribers = DB::table('mkt_contacts_subscribers')->whereNull('deleted_at')->whereNull('client_id')->get(['id', 'code', 'full_name', 'email', 'phone', 'country', 'interest_destination', 'source'])
            ->map(fn (object $row): array => $this->contact('subscriber', $row->id, $row->code, $row->full_name, $row->email, $row->phone, $row->country, $consents, ['dest' => (string) $row->interest_destination, 'channel' => $row->source]));

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
            'channel' => $extra['channel'] ?? null,
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
