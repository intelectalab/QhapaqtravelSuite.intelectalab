<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

final class GenerateDocumentPdf implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public const QUEUE = 'documents';

    public int $tries = 3;

    public int $uniqueFor = 300;

    public function __construct(public readonly string $kind, public readonly string $entityId)
    {
        $this->onQueue(self::QUEUE);
    }

    public function backoff(): array
    {
        return [15, 60, 180];
    }

    public function uniqueId(): string
    {
        return "{$this->tenantId}:{$this->kind}:{$this->entityId}";
    }

    public function handle(ClientDocuments $documents): void
    {
        $documents->generate($this->kind, $this->entityId, self::class);
    }
}
