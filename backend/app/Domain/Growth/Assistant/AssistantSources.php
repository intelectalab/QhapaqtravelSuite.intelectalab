<?php

declare(strict_types=1);

namespace App\Domain\Growth\Assistant;

use App\Domain\Crm\Support\CrmCatalog;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Inbox\Support\MessageCipher;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

final class AssistantSources
{
    public const MESSAGES = 6;

    private const CONTACT_PATTERNS = [
        '/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu' => '[correo omitido]',
        '/(?<!\d)\+?(?:\d[\s.()-]?){8,13}\d(?!\d)/u' => '[teléfono omitido]',
    ];

    public function __construct(
        private readonly PromptSanitizer $sanitizer,
        private readonly ConversationDirectory $conversations,
        private readonly CrmCatalog $catalog,
    ) {}

    public function resolve(string $type, string $code, User $actor): array
    {
        return match ($type) {
            'quote' => $this->quote($code, $actor),
            'lead' => $this->lead($code, $actor),
            default => $this->conversation($code, $actor),
        };
    }

    public function scrub(?string $text, int $limit): string
    {
        $clean = $this->sanitizer->clean((string) $text);

        foreach (self::CONTACT_PATTERNS as $pattern => $replacement) {
            $clean = preg_replace($pattern, $replacement, $clean) ?? $clean;
        }

        return Str::limit(trim(preg_replace('/\s+/u', ' ', $clean) ?? $clean), $limit);
    }

    private function quote(string $code, User $actor): array
    {
        $quote = Quote::query()->where('code', $code)->first() ?? throw ApiException::notFound('La cotización no existe.');
        Gate::forUser($actor)->authorize('view', $quote);
        $row = DB::table('crm_clients')->where('id', $quote->client_id)->first(['name', 'kind']);
        $client = $row?->kind === 'empresa' ? trim((string) $row->name) : $this->firstName($row?->name);
        $pax = (int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf;
        $from = $quote->travel_from?->toDateString();
        $to = $quote->travel_to?->toDateString();
        $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->leftJoin('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->where('i.quote_version_id', $quote->current_version_id)->orderBy('i.line_no')->limit(20)
            ->get(['p.code', 'p.name', 'd.name as destination'])
            ->map(fn (object $row): array => ['code' => (string) $row->code, 'name' => (string) $row->name, 'destination' => (string) $row->destination]);
        $destinations = $items->pluck('destination')->filter()->unique()->values()->all();

        return [
            'id' => (string) $quote->id,
            'title' => (string) $quote->title,
            'input' => ['source' => $code, 'client' => ['name' => $client, 'pax' => $pax, 'travel_from' => $from], 'record' => ['products' => $items->pluck('code')->all()]],
            'record' => ['title' => (string) $quote->title, 'travel_from' => $from, 'travel_to' => $to, 'destinations' => $destinations, 'products' => $items->all()],
            'facts' => array_values(array_filter([
                ['key' => 'client', 'label' => 'Cliente', 'value' => $client ?: 'Sin nombre'],
                ['key' => 'pax', 'label' => 'Pasajeros', 'value' => (string) $pax],
                $from === null ? null : ['key' => 'dates', 'label' => 'Fechas', 'value' => $this->date($from).($to !== null && $to !== $from ? ' al '.$this->date($to) : '')],
                $destinations === [] ? null : ['key' => 'destinations', 'label' => 'Destinos', 'value' => implode(', ', $destinations)],
                ['key' => 'products', 'label' => 'Servicios', 'value' => $items->isEmpty() ? 'Sin servicios todavía' : $items->count().' en la versión '.$quote->current_version_no, 'items' => $items->pluck('name')->take(6)->all()],
            ])),
        ];
    }

    private function lead(string $code, User $actor): array
    {
        $lead = Portfolio::scope(DB::table('crm_leads'), $actor, 'owner_id')->whereNull('deleted_at')->where('code', $code)
            ->first(['id', 'full_name', 'pax', 'travel_date', 'interest_code', 'destination_id', 'destination_label', 'product_id', 'notes'])
            ?? throw ApiException::notFound('El lead no existe o está fuera de tu cartera.');
        $name = $this->firstName($lead->full_name);
        $destination = $lead->destination_label ?: ($lead->destination_id === null ? null : DB::table('catalog_destinations')->where('id', $lead->destination_id)->value('name'));
        $product = $lead->product_id === null ? null : DB::table('catalog_products')->where('id', $lead->product_id)->first(['code', 'name']);
        $interest = $this->catalog->label('lead_interest', $lead->interest_code);
        $travel = $lead->travel_date === null ? null : Carbon::parse($lead->travel_date)->toDateString();
        $notes = $lead->notes === null ? '' : $this->scrub($lead->notes, 400);

        return [
            'id' => (string) $lead->id,
            'title' => (string) $lead->full_name,
            'input' => ['source' => $code, 'client' => ['name' => $name, 'pax' => (int) $lead->pax, 'travel_from' => $travel], 'record' => ['products' => $product === null ? [] : [(string) $product->code]]],
            'record' => ['interest' => $interest, 'travel_from' => $travel, 'destinations' => $destination === null ? [] : [(string) $destination], 'products' => $product === null ? [] : [['code' => (string) $product->code, 'name' => (string) $product->name, 'destination' => (string) $destination]], 'notes' => $notes],
            'facts' => array_values(array_filter([
                ['key' => 'client', 'label' => 'Contacto', 'value' => $name ?: 'Sin nombre'],
                $interest === null ? null : ['key' => 'interest', 'label' => 'Interés', 'value' => $interest],
                $destination === null ? null : ['key' => 'destinations', 'label' => 'Destino', 'value' => (string) $destination],
                $travel === null ? null : ['key' => 'dates', 'label' => 'Viaja', 'value' => $this->date($travel)],
                ['key' => 'pax', 'label' => 'Pasajeros', 'value' => (string) (int) $lead->pax],
                $product === null ? null : ['key' => 'products', 'label' => 'Producto', 'value' => (string) $product->name],
                $notes === '' ? null : ['key' => 'notes', 'label' => 'Notas', 'value' => Str::limit($notes, 140)],
            ])),
        ];
    }

    private function conversation(string $code, User $actor): array
    {
        $conversation = $this->conversations->find($code, $actor);
        $name = $this->firstName($conversation->contact_name);
        $messages = DB::table('collab_messages')->where('conversation_id', $conversation->id)->whereIn('direction', ['in', 'out'])
            ->orderByDesc('sent_at')->limit(self::MESSAGES)->get(['id', 'direction', 'body'])->reverse()->values()
            ->map(fn (object $row): array => ['id' => (string) $row->id, 'from' => $row->direction === 'in' ? 'cliente' : 'agencia', 'text' => $this->scrub(MessageCipher::open($row->body), 300)]);
        $last = $messages->last(fn (array $message): bool => $message['from'] === 'cliente');
        $channel = ConversationDirectory::CHANNELS[$conversation->channel] ?? (string) $conversation->channel;

        return [
            'id' => (string) $conversation->id,
            'title' => (string) $conversation->subject,
            'input' => ['source' => $code, 'client' => ['name' => $name], 'record' => ['messages' => $messages->pluck('id')->all()]],
            'record' => ['subject' => $this->scrub($conversation->subject, 200), 'channel' => $channel, 'messages' => $messages->map(fn (array $message): array => ['from' => $message['from'], 'text' => $message['text']])->all()],
            'facts' => [
                ['key' => 'client', 'label' => 'Contacto', 'value' => $name ?: 'Sin nombre'],
                ['key' => 'channel', 'label' => 'Canal', 'value' => $channel],
                ['key' => 'messages', 'label' => 'Mensajes', 'value' => $messages->count() === 0 ? 'Sin mensajes todavía' : 'Los últimos '.$messages->count()],
                ...($last === null ? [] : [['key' => 'last', 'label' => 'Último del cliente', 'value' => Str::limit($last['text'], 140)]]),
            ],
        ];
    }

    private function firstName(?string $name): string
    {
        return Str::before(trim((string) $name), ' ');
    }

    private function date(string $date): string
    {
        return Carbon::parse($date)->format('d/m/Y');
    }
}
