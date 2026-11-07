<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Quotes\Enums\QuoteStatus;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Quotes\Support\QuoteDirectory;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;

final class ExpireQuotes extends TenantJob
{
    protected function run(): string
    {
        $today = CarbonImmutable::now(app(TenantContext::class)->timezone())->toDateString();
        $states = app(QuoteStateMachine::class);
        $audit = app(AuditLogger::class);
        $quotes = Quote::query()->whereIn('status', QuoteDirectory::OPEN)->where('valid_until', '<', $today)->orderBy('id')->lockForUpdate()->get();

        foreach ($quotes as $quote) {
            $before = $states->transition($quote, QuoteStatus::Vencida);
            $quote->save();
            $audit->log('Cotización', (string) $quote->code, 'vencer', $before, 'vencida', evidence: ['valid_until' => $quote->valid_until?->toDateString()]);
        }

        return $quotes->isEmpty() ? 'Sin cotizaciones por vencer' : self::plural($quotes->count(), 'cotización vencida', 'cotizaciones vencidas');
    }
}
