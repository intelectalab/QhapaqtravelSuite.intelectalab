<?php

declare(strict_types=1);

namespace App\Domain\Shared\Outbox;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Support\Facades\DB;

final class OutboxWriter
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    public function add(string $aggregateType, string $aggregateId, string $event, array $payload): void
    {
        DB::table('sys_outbox')->insert([
            'tenant_id' => $this->context->id(),
            'aggregate_type' => $aggregateType,
            'aggregate_id' => $aggregateId,
            'event' => $event,
            'payload' => json_encode($payload + ['correlation_id' => AssignCorrelationId::current()], JSON_UNESCAPED_UNICODE),
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => now(),
        ]);
    }
}
