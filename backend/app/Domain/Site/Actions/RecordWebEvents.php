<?php

declare(strict_types=1);

namespace App\Domain\Site\Actions;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class RecordWebEvents
{
    public const EVENTS = [
        'page_view', 'search', 'view_item_list', 'view_item', 'add_to_wishlist', 'remove_from_wishlist', 'add_to_cart', 'remove_from_cart', 'view_cart',
        'apply_promo', 'select_promotion', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'payment_failed', 'purchase', 'purchase_pending',
        'purchase_balance', 'generate_lead', 'sign_up', 'sign_up_newsletter', 'login', 'share', 'contact_whatsapp', 'select_language', 'select_currency', 'claim_submitted',
        'select_date',
    ];

    public const SELECT_DATE_PARAMS = ['item_id', 'date', 'adults', 'children', 'pax', 'available', 'source', 'destination', 'type'];

    public function record(array $data, string $locale): array
    {
        $valid = Validator::make($data, [
            'consent' => ['accepted'],
            'session_id' => ['required', 'string', 'min:8', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'currency' => ['nullable', 'in:PEN,USD'],
            'utm' => ['nullable', 'array'],
            'utm.*' => ['nullable', 'string', 'max:120'],
            'events' => ['required', 'array', 'min:1', 'max:50'],
            'events.*.event' => ['required', 'in:'.implode(',', self::EVENTS)],
            'events.*.params' => ['nullable', 'array'],
        ], [
            'consent.accepted' => 'Sin consentimiento de cookies analíticas no se registran eventos.',
            'events.*.event.in' => 'Evento no reconocido.',
        ])->validate();

        $rows = [];
        foreach ($valid['events'] as $event) {
            $params = (array) ($event['params'] ?? []);
            $rows[] = [
                'session_id' => $valid['session_id'],
                'event' => $event['event'],
                'params' => json_encode(array_slice($event['event'] === 'select_date' ? self::dateParams($params) : $params, 0, 30, true), JSON_UNESCAPED_UNICODE),
                'locale' => in_array($locale, ['es', 'en'], true) ? $locale : 'es',
                'currency' => $valid['currency'] ?? 'PEN',
                'utm' => isset($valid['utm']) ? json_encode($valid['utm'], JSON_UNESCAPED_UNICODE) : null,
            ];
        }

        DB::table('channel_web_events')->insert($rows);

        return ['recorded' => count($rows)];
    }

    private static function dateParams(array $params): array
    {
        $clean = array_intersect_key($params, array_flip(self::SELECT_DATE_PARAMS));
        $text = fn (mixed $value): ?string => is_scalar($value) && preg_match('/^[A-Za-z0-9_.-]{1,80}$/', (string) $value) === 1 ? (string) $value : null;
        $count = fn (mixed $value): ?int => is_numeric($value) && (int) $value >= 0 && (int) $value <= 99 ? (int) $value : null;

        return array_filter([
            'item_id' => $text($clean['item_id'] ?? null),
            'date' => is_string($clean['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $clean['date']) === 1 ? $clean['date'] : null,
            'adults' => $count($clean['adults'] ?? null),
            'children' => $count($clean['children'] ?? null),
            'pax' => $count($clean['pax'] ?? null),
            'available' => isset($clean['available']) ? filter_var($clean['available'], FILTER_VALIDATE_BOOLEAN) : null,
            'source' => $text($clean['source'] ?? null),
            'destination' => $text($clean['destination'] ?? null),
            'type' => $text($clean['type'] ?? null),
        ], fn (mixed $value): bool => $value !== null);
    }
}
