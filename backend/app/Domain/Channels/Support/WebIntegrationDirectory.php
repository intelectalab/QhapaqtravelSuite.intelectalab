<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class WebIntegrationDirectory
{
    public const METHODS = ['webcomponent' => 'Web component', 'iframe' => 'Iframe', 'script' => 'Script con botón', 'link' => 'Enlace directo'];

    public function overview(User $viewer): array
    {
        $config = DB::table('channel_widget_config as w')->leftJoin('iam_users as u', 'u.id', '=', 'w.created_by')->first(['w.*', 'u.name as created_by_name']);
        $defaults = $config ? json_decode((string) $config->defaults, true) : [];
        $subdomain = (string) app(TenantContext::class)->tenant()->subdomain;
        $product = isset($defaults['product']) ? DB::table('catalog_products')->where('ref', $defaults['product'])->orWhere('code', $defaults['product'])->first(['code', 'name']) : null;
        $domains = DB::table('channel_widget_domains as d')->leftJoin('iam_users as u', 'u.id', '=', 'd.created_by')->orderBy('d.created_at')->get(['d.id', 'd.domain', 'd.cms', 'd.status', 'd.verify_token', 'd.verified_at', 'd.created_at', 'u.name as added_by']);
        $events = DB::table('channel_web_events as e')->leftJoin('crm_clients as c', 'c.id', '=', 'e.client_id')->orderByDesc('e.occurred_at')->limit(50)->get(['e.id', 'e.occurred_at', 'e.session_id', 'e.event', 'e.params', 'e.locale', 'e.currency', 'c.name as client']);

        return [
            'config' => $config ? [
                'tenant_slug' => $config->tenant_slug,
                'public_key' => $config->public_key,
                'key_created_at' => $config->created_at,
                'key_created_by' => $config->created_by_name,
                'cdn' => WidgetHosts::cdn(),
                'host' => WidgetHosts::host($subdomain),
                'site' => WidgetHosts::site($subdomain),
                'key_rotated_at' => $config->updated_at,
                'previous_key_until' => $config->prev_expires_at !== null && strtotime((string) $config->prev_expires_at) > time() ? $config->prev_expires_at : null,
            ] : null,
            'defaults' => [
                'product' => $product?->code,
                'product_name' => $product?->name,
                'mode' => $defaults['mode'] ?? 'producto',
                'category' => $defaults['category'] ?? null,
                'lang' => $defaults['lang'] ?? 'es',
                'currency' => $defaults['currency'] ?? 'PEN',
                'theme' => $defaults['theme'] ?? '#0A3A73',
                'radius' => (int) ($defaults['radius'] ?? 10),
                'reviews' => (bool) ($defaults['reviews'] ?? false),
                'method' => $defaults['method'] ?? 'webcomponent',
                'domain' => $defaults['domain'] ?? null,
            ],
            'domains' => $domains->map(fn (object $row): array => [
                'id' => $row->id,
                'domain' => $row->domain,
                'cms' => $row->cms,
                'status' => $row->status,
                'token' => $row->verify_token,
                'verified_at' => $row->verified_at,
                'added_at' => $row->created_at,
                'added_by' => $row->added_by,
            ])->values(),
            'events' => $events->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'at' => $row->occurred_at,
                'session' => $row->session_id,
                'event' => $row->event,
                'params' => json_decode((string) $row->params, true) ?: (object) [],
                'locale' => $row->locale,
                'currency' => $row->currency,
                'client' => $row->client,
            ])->values(),
            'kpis' => [
                'domains' => $domains->count(),
                'verified' => $domains->where('status', 'verificado')->count(),
                'events' => DB::table('channel_web_events')->count(),
                'sessions' => DB::table('channel_web_events')->distinct()->count('session_id'),
                'handoffs' => DB::table('channel_widget_handoffs')->count(),
            ],
            'products' => DB::table('catalog_products as p')
                ->join('catalog_product_channels as c', fn ($join) => $join->on('c.product_id', '=', 'p.id')->where('c.channel', 'ecommerce')->where('c.is_published', true))
                ->whereNull('p.deleted_at')->orderBy('p.name')->get(['p.code', 'p.name']),
            'methods' => collect(self::METHODS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'can_manage' => $viewer->can('channels.ecommerce.manage'),
            'can_rotate' => $viewer->can('admin.api.manage'),
        ];
    }
}
