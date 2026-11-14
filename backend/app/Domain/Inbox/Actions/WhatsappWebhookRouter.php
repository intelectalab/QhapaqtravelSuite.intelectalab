<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Inbox\Support\InboundPayloads;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Marketing\Support\WhatsappDeliveries;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Support\Facades\DB;

final class WhatsappWebhookRouter
{
    public const MESSAGES = 'messages';

    public const TEMPLATES = 'message_template_status_update';

    public function __construct(
        private readonly TenantDatabase $database,
        private readonly InboundEvents $events,
        private readonly InboundPayloads $payloads,
        private readonly WhatsappDeliveries $deliveries,
    ) {}

    public function route(array $payload, ?object $only = null): array
    {
        $events = [];
        $statuses = WhatsappDeliveries::EMPTY;
        $templates = [];
        $ignored = 0;

        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) ($entry['changes'] ?? []) as $change) {
                $field = (string) ($change['field'] ?? self::MESSAGES);
                $value = (array) ($change['value'] ?? []);

                if ($field === self::TEMPLATES) {
                    $account = $this->byWaba((string) ($entry['id'] ?? ''), $only);
                    $account === null
                        ? $ignored++
                        : $templates[] = $this->database->run((string) $account->tenant_id, fn (): array => $this->deliveries->template((string) $account->account_id, [...$value, 'time' => $entry['time'] ?? null]));

                    continue;
                }

                if ($field !== self::MESSAGES) {
                    $ignored++;

                    continue;
                }

                $account = $this->byPhone((string) ($value['metadata']['phone_number_id'] ?? ''), $only);

                if ($account === null) {
                    $ignored++;

                    continue;
                }

                $messages = $this->payloads->whatsapp(['entry' => [['changes' => [['field' => $field, 'value' => $value]]]]])[(string) $value['metadata']['phone_number_id']] ?? [];
                [$recorded, $summary] = $this->database->run((string) $account->tenant_id, fn (): array => [
                    $this->events->recordVerified('whatsapp', (string) $account->account_id, $messages),
                    $this->deliveries->changes([$value]),
                ]);
                $events = [...$events, ...$this->events->dispatch($recorded, (string) $account->tenant_id)];
                $statuses = WhatsappDeliveries::merge($statuses, $summary);
            }
        }

        $counts = array_count_values(array_column($events, 'status'));

        return [
            'received' => $counts['recibido'] ?? 0,
            'duplicates' => $counts['duplicado'] ?? 0,
            'events' => $events,
            'statuses' => $statuses,
            'templates' => $templates,
            'ignored' => $ignored,
        ];
    }

    private function byPhone(string $phone, ?object $only): ?object
    {
        if ($phone === '') {
            return null;
        }

        if ($only !== null) {
            return $phone === (string) ($only->phone_number_id ?? '') ? $only : null;
        }

        return DB::connection('pgsql_platform')->selectOne('select tenant_id, account_id from app_resolve_channel_account(?, ?, ?)', ['whatsapp', $phone, null]);
    }

    private function byWaba(string $waba, ?object $only): ?object
    {
        if (trim($waba) === '') {
            return null;
        }

        $hash = WhatsappAccounts::hash($waba);

        if ($only !== null) {
            return $hash === (string) ($only->waba_id_hash ?? '') ? $only : null;
        }

        return DB::connection('pgsql_platform')->selectOne('select tenant_id, account_id from app_resolve_whatsapp_waba(?)', [$hash]);
    }
}
