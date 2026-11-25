<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Tracking\Support\AnalyticsScope;
use App\Domain\Tracking\Support\WebAnalyticsRollup;

final class AggregatePlatformWebAnalytics extends PlatformJob
{
    public const QUEUE = 'reports';

    protected function run(): string
    {
        return WebAnalyticsRollup::summary(app(WebAnalyticsRollup::class)->run(AnalyticsScope::platform()));
    }
}
