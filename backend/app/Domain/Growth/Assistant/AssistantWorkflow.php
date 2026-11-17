<?php

declare(strict_types=1);

namespace App\Domain\Growth\Assistant;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ConversationDirectory;
use App\Domain\Integrations\Contracts\SalesAssistant;
use App\Domain\Platform\Support\EffectiveLimits;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

final class AssistantWorkflow
{
    public const KINDS = ['itinerary' => 'Itinerario', 'quote_draft' => 'Borrador de cotización', 'reply_draft' => 'Respuesta al cliente', 'summary' => 'Resumen'];

    public const SOURCES = ['quote' => 'Cotización', 'lead' => 'Lead', 'conversation' => 'Conversación'];

    public const QUOTA_METRIC = 'ai_requests';

    public const PERMISSION = 'ai.assistant.use';

    public function __construct(
        private readonly SalesAssistant $assistant,
        private readonly PromptSanitizer $sanitizer,
        private readonly GrowthRules $rules,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
        private readonly ConversationDirectory $conversations,
        private readonly QuoteLifecycle $quotes,
    ) {}

    public function request(array $data, User $actor): array
    {
        $this->rules->ensure('R-AI-ASSISTANT', self::PERMISSION);
        $usage = $this->usage($actor);

        if ($usage['exhausted']) {
            throw new ApiException(429, 'AI_QUOTA_EXCEEDED', 'AI_QUOTA_EXCEEDED', 'La agencia ya usó los '.$usage['limit'].' pedidos de IA del mes. El cupo se renueva el 1 del mes siguiente o con un paquete adicional.');
        }

        [$sourceId, $input] = $this->source($data['source_type'] ?? null, $data['source_code'] ?? null, $actor);
        $prompt = $this->sanitizer->clean((string) $data['prompt']);
        $id = (string) Str::uuid7();
        DB::table('sys_ai_requests')->insert([
            'id' => $id,
            'kind' => $data['kind'],
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $sourceId,
            'user_id' => $actor->getKey(),
            'prompt' => $prompt,
            'input_ref' => json_encode($input, JSON_UNESCAPED_UNICODE),
            'provider' => $this->assistant->provider(),
            'status' => 'pending',
            'created_by' => $actor->getKey(),
        ]);

        $completion = $this->assistant->complete((string) $data['kind'], $prompt, [...$this->catalogContext(), 'client' => $input['client'] ?? []]);
        DB::table('sys_ai_requests')->where('id', $id)->update([
            'status' => $completion->ok ? 'completed' : 'failed',
            'output' => $completion->ok ? json_encode($completion->output, JSON_UNESCAPED_UNICODE) : null,
            'model' => $completion->model,
            'tokens_in' => $completion->tokensIn,
            'tokens_out' => $completion->tokensOut,
            'cost_usd' => $completion->costUsd,
            'error' => $completion->error,
            'completed_at' => now(),
        ]);
        UsageMeter::record($this->context->idOrFail(), 'ai_requests');

        return $this->show($id, $actor);
    }

    public function show(string $id, User $actor): array
    {
        return $this->present($this->find($id, $actor));
    }

    public function apply(string $id, User $actor, bool $confirm = false, bool $voidApproval = false): array
    {
        return DB::transaction(function () use ($id, $actor, $confirm, $voidApproval): array {
            $request = $this->find($id, $actor, true);

            if ($request->status !== 'completed') {
                throw ApiException::conflict('SC-03', $request->status === 'applied' ? 'Este borrador ya se aplicó.' : 'Solo se aplica un borrador terminado.');
            }

            $output = (array) json_decode((string) $request->output, true);
            $text = $this->draftText((string) $request->kind, $output);
            $result = ['text' => $text];

            if ($this->appliesToQuote($request)) {
                $result += $this->applyToQuote((string) $request->source_id, $text, $actor, $confirm, $voidApproval);
            }

            DB::table('sys_ai_requests')->where('id', $request->id)->update(['status' => 'applied', 'applied_at' => now()]);
            $this->audit->log('Pedido IA', (string) $request->id, 'aplicar', 'completed', isset($result['quote']) ? "{$result['quote']} · v{$result['version_no']}".($result['impact'] === null ? '' : ' · confirmado: '.$result['impact']['message']) : self::KINDS[$request->kind] ?? $request->kind);

            return [...$this->present($this->find($id, $actor)), 'applied' => $result];
        });
    }

    public function discard(string $id, User $actor): array
    {
        return DB::transaction(function () use ($id, $actor): array {
            $request = $this->find($id, $actor, true);

            if (! in_array($request->status, ['completed', 'pending'], true)) {
                throw ApiException::conflict('SC-03', 'Este pedido ya no se puede descartar.');
            }

            DB::table('sys_ai_requests')->where('id', $request->id)->update(['status' => 'discarded']);
            $this->audit->log('Pedido IA', (string) $request->id, 'descartar', (string) $request->status, 'discarded');

            return $this->present($this->find($id, $actor));
        });
    }

    public function usage(User $actor): array
    {
        $start = Carbon::now($this->context->timezone())->startOfMonth()->utc();
        $tenantId = $this->context->idOrFail();
        $tenant = DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', $tenantId)->first(['p.id', 'p.name']);
        $plan = (string) ($tenant->name ?? '');
        $limit = $tenant === null ? 0 : EffectiveLimits::limit($tenantId, (string) $tenant->id, self::QUOTA_METRIC);
        $month = DB::table('sys_ai_requests')->where('created_at', '>=', $start);
        $totals = (clone $month)->selectRaw('count(*) as used, coalesce(sum(tokens_in), 0) as tokens_in, coalesce(sum(tokens_out), 0) as tokens_out, coalesce(sum(cost_usd), 0) as cost')->first();
        $byKind = (clone $month)->groupBy('kind')->selectRaw('kind, count(*) as total')->pluck('total', 'kind')->map(fn ($total): int => (int) $total)->all();
        $used = (int) ($totals->used ?? 0);
        $pct = $limit === null ? 0.0 : ($limit > 0 ? round($used * 100 / $limit, 1) : 100.0);

        return [
            'enabled' => $this->rules->enabled('R-AI-ASSISTANT'),
            'month' => Carbon::now($this->context->timezone())->format('Y-m'),
            'plan' => $plan,
            'used' => $used,
            'limit' => $limit,
            'remaining' => $limit === null ? null : max(0, $limit - $used),
            'exhausted' => $limit !== null && $used >= $limit,
            'pct' => $pct,
            'warning' => $pct >= 80,
            'by_kind' => $byKind,
            'tokens_in' => (int) ($totals->tokens_in ?? 0),
            'tokens_out' => (int) ($totals->tokens_out ?? 0),
            'cost_usd' => number_format((float) ($totals->cost ?? 0), 4, '.', ''),
            'recent' => DB::table('sys_ai_requests')->where('user_id', $actor->getKey())->orderByDesc('created_at')->limit(8)->get()->map(fn (object $row): array => $this->present($row))->all(),
            'kinds' => self::KINDS,
            'sources' => self::SOURCES,
        ];
    }

    public function quoteImpact(Quote $quote): ?array
    {
        if (in_array($quote->status, ['borrador', 'convertida'], true)) {
            return null;
        }

        $current = (int) $quote->current_version_no;
        $next = $current + 1;
        $pending = DB::table('quote_internal_approvals')->where('quote_version_id', $quote->current_version_id)->where('status', 'pendiente')->value('created_at');
        $base = "Esto crea la v{$next} en borrador y la v{$current} queda reemplazada. El cliente sigue viendo la v{$current} hasta que envíes la v{$next}.";

        if ($quote->status === 'aprobada' || $pending !== null) {
            $date = Carbon::parse($quote->status === 'aprobada' ? ($quote->approved_at ?? $quote->updated_at) : $pending)->setTimezone($this->context->timezone())->format('d/m/Y');
            $warning = $quote->status === 'aprobada' ? "Se anulará la aprobación del cliente del {$date}." : "Se anulará la aprobación interna pendiente del {$date}.";

            return ['level' => 'danger', 'status' => (string) $quote->status, 'current_version' => $current, 'new_version' => $next, 'message' => $base, 'warning' => $warning];
        }

        return ['level' => 'warning', 'status' => (string) $quote->status, 'current_version' => $current, 'new_version' => $next, 'message' => $base, 'warning' => null];
    }

    private function appliesToQuote(object $request): bool
    {
        return $request->source_type === 'quote' && in_array($request->kind, ['itinerary', 'quote_draft'], true);
    }

    private function applyToQuote(string $quoteId, string $text, User $actor, bool $confirm, bool $voidApproval): array
    {
        $quote = Quote::query()->whereKey($quoteId)->first() ?? throw ApiException::notFound('La cotización del pedido ya no existe.');
        Gate::forUser($actor)->authorize('view', $quote);

        if ($quote->status === 'convertida') {
            throw ApiException::conflict('QTE-BR-18', 'Una cotización convertida en reserva ya no cambia.');
        }

        $impact = $this->quoteImpact($quote);

        if ($impact !== null && (! $confirm || ($impact['level'] === 'danger' && ! $voidApproval))) {
            throw ApiException::conflict('AI_APPLY_CONFIRM', $impact['warning'] === null ? $impact['message'] : $impact['warning'].' '.$impact['message'], ['impact' => $impact]);
        }

        if ($impact !== null) {
            $this->quotes->newVersion((string) $quote->code, $actor);
            $quote->refresh();
        }

        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first(['id', 'version_no', 'notes']);
        DB::table('quote_versions')->where('id', $version->id)->update([
            'notes' => trim(trim((string) $version->notes)."\n\n".$text),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        return ['quote' => (string) $quote->code, 'version_no' => (int) $version->version_no, 'impact' => $impact];
    }

    private function draftText(string $kind, array $output): string
    {
        if ($kind === 'itinerary') {
            return 'Borrador del asistente · '.($output['title'] ?? 'Itinerario')."\n".collect($output['days'] ?? [])->map(fn (array $day): string => 'Día '.$day['day'].': '.$day['title'])->implode("\n");
        }

        if ($kind === 'quote_draft') {
            $items = collect($output['items'] ?? [])->map(fn (array $item): string => '· '.$item['name'].' × '.$item['quantity'])->implode("\n");

            return 'Borrador del asistente · '.($output['title'] ?? 'Propuesta')."\n".($items !== '' ? $items : (string) ($output['notes'] ?? ''));
        }

        return (string) ($output['text'] ?? '');
    }

    private function source(?string $type, ?string $code, User $actor): array
    {
        if ($type === null || $code === null || $code === '') {
            return [null, []];
        }

        if ($type === 'quote') {
            $quote = Quote::query()->where('code', $code)->first() ?? throw ApiException::notFound('La cotización no existe.');
            Gate::forUser($actor)->authorize('view', $quote);
            $client = DB::table('crm_clients')->where('id', $quote->client_id)->value('name');

            return [(string) $quote->id, ['source' => $code, 'client' => ['name' => $this->firstName($client), 'pax' => (int) $quote->pax_adt + (int) $quote->pax_chd + (int) $quote->pax_inf, 'travel_from' => $quote->travel_from ? Carbon::parse($quote->travel_from)->toDateString() : null]]];
        }

        if ($type === 'lead') {
            $lead = Portfolio::scope(DB::table('crm_leads'), $actor, 'owner_id')->whereNull('deleted_at')->where('code', $code)->first(['id', 'full_name', 'pax', 'travel_date'])
                ?? throw ApiException::notFound('El lead no existe o está fuera de tu cartera.');

            return [(string) $lead->id, ['source' => $code, 'client' => ['name' => $this->firstName($lead->full_name), 'pax' => (int) $lead->pax, 'travel_from' => $lead->travel_date]]];
        }

        $conversation = $this->conversations->find($code, $actor);

        return [(string) $conversation->id, ['source' => $code, 'client' => ['name' => $this->firstName($conversation->contact_name)]]];
    }

    private function catalogContext(): array
    {
        $products = DB::table('catalog_products as p')->leftJoin('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')->orderBy('p.code')->limit(300)
            ->get(['p.code', 'p.name', 'd.name as destination', 'p.duration_value', 'p.duration_unit'])
            ->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->name, 'destination' => (string) $row->destination, 'duration' => $row->duration_value.' '.$row->duration_unit])
            ->all();

        return [
            'destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('name')->limit(200)->pluck('name')->all(),
            'products' => $products,
        ];
    }

    private function firstName(?string $name): string
    {
        return Str::before(trim((string) $name), ' ');
    }

    private function find(string $id, User $actor, bool $lock = false): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('El pedido de IA no existe.');
        }

        $query = DB::table('sys_ai_requests')->where('id', $id)->when(! $actor->can('ai.insights.view'), fn ($query) => $query->where('user_id', $actor->getKey()));

        return ($lock ? $query->lockForUpdate() : $query)->first() ?? throw ApiException::notFound('El pedido de IA no existe.');
    }

    private function present(object $row): array
    {
        $output = $row->output === null ? null : (array) json_decode((string) $row->output, true);
        $source = match ($row->source_type) {
            'quote' => DB::table('quote_quotes')->where('id', $row->source_id)->value('code'),
            'lead' => DB::table('crm_leads')->where('id', $row->source_id)->value('code'),
            'conversation' => DB::table('collab_conversations')->where('id', $row->source_id)->value('code'),
            default => null,
        };

        return [
            'id' => (string) $row->id,
            'kind' => $row->kind,
            'kind_label' => self::KINDS[$row->kind] ?? $row->kind,
            'status' => $row->status,
            'prompt' => $row->prompt,
            'source' => $row->source_type === null ? null : ['type' => $row->source_type, 'label' => self::SOURCES[$row->source_type] ?? $row->source_type, 'code' => $source],
            'output' => $output,
            'text' => $output === null ? null : $this->draftText((string) $row->kind, $output),
            'provider' => $row->provider,
            'model' => $row->model,
            'tokens_in' => (int) $row->tokens_in,
            'tokens_out' => (int) $row->tokens_out,
            'cost_usd' => number_format((float) $row->cost_usd, 4, '.', ''),
            'error' => $row->error,
            'created_at' => $row->created_at,
            'completed_at' => $row->completed_at,
            'applied_at' => $row->applied_at,
            'apply_impact' => $row->status === 'completed' && $this->appliesToQuote($row) ? $this->impactFor((string) $row->source_id) : null,
        ];
    }

    private function impactFor(string $quoteId): ?array
    {
        $quote = Quote::query()->whereKey($quoteId)->first();

        return $quote === null ? null : $this->quoteImpact($quote);
    }
}
