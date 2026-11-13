<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class WebhookDeliveryLogController
{
    private const STATUSES = ['pending', 'delivered', 'retrying', 'failed'];

    public function index(Request $request): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $status = $filters['status'] ?? null;

        if ($status !== null && ! in_array($status, self::STATUSES, true)) {
            throw ApiException::unprocessable('FILTER_INVALID', 'El estado debe ser pending, delivered, retrying o failed.');
        }

        $query = DB::table('integration_webhook_deliveries as d')
            ->join('integration_webhooks as w', 'w.id', '=', 'd.webhook_id')
            ->when($status !== null, fn ($builder) => $builder->where('d.status', $status))
            ->when(isset($filters['webhook']), fn ($builder) => $builder->where('w.code', $filters['webhook']))
            ->select(['d.code', 'd.event_type', 'd.event_id', 'd.entity_code', 'd.attempt', 'd.status', 'd.http_status', 'd.duration_ms', 'd.error', 'd.next_retry_at', 'd.manual', 'd.created_at', 'w.code as webhook', 'w.url']);
        $totals = DB::table('integration_webhook_deliveries')->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return response()->json(CursorPage::respond($request, $query, ['created_at' => 'd.created_at', 'status' => 'd.status', 'attempt' => 'd.attempt'], '-created_at', fn (object $row): array => [
            'code' => $row->code,
            'webhook' => $row->webhook,
            'url' => $row->url,
            'event' => $row->event_type,
            'event_id' => $row->event_id,
            'entity' => $row->entity_code,
            'attempt' => (int) $row->attempt,
            'status' => $row->status,
            'http' => $row->http_status !== null ? (int) $row->http_status : null,
            'ms' => $row->duration_ms !== null ? (int) $row->duration_ms : null,
            'error' => $row->error,
            'manual' => (bool) $row->manual,
            'next_retry_at' => $row->next_retry_at,
            'at' => $row->created_at,
        ], ['totals' => collect(self::STATUSES)->mapWithKeys(fn (string $key): array => [$key => (int) ($totals[$key] ?? 0)])->all()]));
    }
}
