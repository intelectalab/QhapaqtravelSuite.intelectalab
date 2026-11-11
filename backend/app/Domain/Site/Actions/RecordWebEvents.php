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
    ];

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
            $rows[] = [
                'session_id' => $valid['session_id'],
                'event' => $event['event'],
                'params' => json_encode(array_slice((array) ($event['params'] ?? []), 0, 30, true), JSON_UNESCAPED_UNICODE),
                'locale' => in_array($locale, ['es', 'en'], true) ? $locale : 'es',
                'currency' => $valid['currency'] ?? 'PEN',
                'utm' => isset($valid['utm']) ? json_encode($valid['utm'], JSON_UNESCAPED_UNICODE) : null,
            ];
        }

        DB::table('channel_web_events')->insert($rows);

        return ['recorded' => count($rows)];
    }
}
