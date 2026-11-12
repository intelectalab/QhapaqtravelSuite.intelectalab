<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Quotes\Actions\QuoteAccessTokens;
use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PublicQuoteView
{
    private const LIVE = ['enviada', 'vista', 'negociacion'];

    private const VISIBLE = ['enviada', 'vista', 'negociacion', 'aprobada', 'convertida', 'vencida'];

    public function __construct(
        private readonly TenantDatabase $database,
        private readonly TenantContext $context,
        private readonly QuoteStateMachine $states,
        private readonly AuditLogger $audit,
    ) {}

    public function show(string $plain, Request $request): array
    {
        $tenantId = preg_match(QuoteAccessTokens::PATTERN, $plain, $parts) === 1
            ? DB::connection('pgsql_platform')->table('tenants')->where('subdomain', $parts[1])->whereIn('status', ['activo', 'prueba'])->value('id')
            : null;

        if ($tenantId === null) {
            throw self::invalid();
        }

        try {
            return $this->database->run((string) $tenantId, function () use ($plain, $request): array {
                $quoteId = DB::table('quote_access_tokens')->where('token_hash', QuoteAccessTokens::hash($plain))->whereNull('revoked_at')->value('quote_id') ?? throw self::invalid();

                return $this->render((string) $quoteId, $request);
            });
        } finally {
            $this->context->clear();
        }
    }

    private static function invalid(): ApiException
    {
        return ApiException::notFound('El enlace no es válido o fue reemplazado por uno nuevo. Pide a tu asesor que te lo envíe otra vez.');
    }

    private function render(string $quoteId, Request $request): array
    {
        $quote = Quote::query()->whereKey($quoteId)->whereNull('deleted_at')->first() ?? throw ApiException::notFound('La cotización ya no está disponible.');

        if (! in_array((string) $quote->status, self::VISIBLE, true)) {
            throw ApiException::notFound('La cotización todavía no está disponible.');
        }

        $today = Carbon::now($this->context->timezone())->toDateString();
        $expired = in_array((string) $quote->status, self::LIVE, true) && ($quote->valid_until?->toDateString() ?? $today) < $today;

        if (! $expired && in_array((string) $quote->status, self::LIVE, true)) {
            $this->recordView($quote, $request);
        }

        $version = DB::table('quote_versions')->where('id', $quote->current_version_id)->first(['version_no', 'discount_pct', 'tax_pct', 'conditions', 'sale_total', 'discount_total', 'net_total', 'tax_total', 'grand_total']);
        $items = DB::table('quote_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->where('i.quote_version_id', $quote->current_version_id)->orderBy('i.line_no')
            ->get(['p.name', 'i.service_date', 'i.qty', 'i.pax', 'i.segment', 'i.unit_price', 'i.sale_total']);
        $client = DB::table('crm_clients')->where('id', $quote->client_id)->value('name');
        $owner = DB::table('iam_users')->where('id', $quote->owner_id)->first(['name', 'email']);
        $tenant = $this->context->tenant();
        $currency = (string) $quote->currency;

        return [
            'agency' => ['name' => $tenant->commercial_name, 'advisor' => $owner->name ?? null, 'email' => $owner->email ?? null],
            'code' => $quote->code,
            'title' => $quote->title,
            'client' => $client,
            'status' => $expired ? 'vencida' : (string) $quote->status,
            'version' => (int) ($version->version_no ?? $quote->current_version_no),
            'travel_from' => $quote->travel_from?->toDateString(),
            'travel_to' => $quote->travel_to?->toDateString(),
            'valid_until' => $quote->valid_until?->toDateString(),
            'currency' => $currency,
            'pax' => ['adt' => (int) $quote->pax_adt, 'chd' => (int) $quote->pax_chd, 'inf' => (int) $quote->pax_inf],
            'items' => $items->map(fn (object $item): array => [
                'product' => $item->name,
                'date' => $item->service_date,
                'qty' => (int) $item->qty,
                'pax' => (int) $item->pax,
                'segment' => $item->segment,
                'unit_price' => Decimal::toApi((string) $item->unit_price),
                'total' => Decimal::toApi((string) $item->sale_total),
            ])->values(),
            'totals' => $version === null ? null : [
                'sale' => Decimal::toApi((string) $version->sale_total),
                'discount' => Decimal::toApi((string) $version->discount_total),
                'net' => Decimal::toApi((string) $version->net_total),
                'tax' => Decimal::toApi((string) $version->tax_total),
                'tax_pct' => (string) $version->tax_pct,
                'grand' => Decimal::toApi((string) $version->grand_total),
            ],
            'conditions' => $version->conditions ?? null,
            'portal_url' => rtrim((string) config('app.frontend_url'), '/').'/portal',
        ];
    }

    private function recordView(Quote $quote, Request $request): void
    {
        DB::table('quote_views')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $this->context->idOrFail(), 'quote_id' => $quote->id, 'version_no' => $quote->current_version_no, 'viewed_at' => now(), 'source' => 'portal', 'ip' => $request->ip(), 'user_agent' => Str::limit((string) $request->userAgent(), 500, '')]);
        $before = (string) $quote->status;

        if ($before === QuoteStatus::Enviada->value) {
            $this->states->transition($quote, QuoteStatus::Vista);
        }

        $quote->forceFill(['viewed_at' => $quote->viewed_at ?? now()])->save();

        if ($before === QuoteStatus::Enviada->value) {
            $this->audit->log('Cotización', (string) $quote->code, 'vista_portal', $before, 'vista (enlace con token)');
            app(QuoteNotices::class)->viewed($quote);
        }
    }
}
