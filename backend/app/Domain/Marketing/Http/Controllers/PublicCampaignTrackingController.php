<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Marketing\Support\CampaignTracking;
use App\Domain\Marketing\Support\DeliveryReceipts;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

final class PublicCampaignTrackingController
{
    public function __construct(private readonly TenantDatabase $database, private readonly DeliveryReceipts $receipts) {}

    public function open(string $token): Response
    {
        $opened = CampaignTracking::opened($token);

        if ($opened !== null) {
            [$tenant, $recipient] = $opened;

            try {
                $this->database->run($tenant, fn () => $this->receipts->track($recipient, 'opened', Carbon::now()->utc()));
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return response((string) base64_decode(CampaignTracking::PIXEL), 200, [
            'Content-Type' => 'image/gif',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function click(string $token): RedirectResponse
    {
        [$tenant, $recipient, $index] = CampaignTracking::clicked($token) ?? throw ApiException::notFound('El enlace no es válido.');

        $target = $this->database->run($tenant, function () use ($recipient, $index): ?string {
            $body = DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id')->where('r.id', $recipient)->where('c.channel', 'email')->value('c.body');
            $target = $body === null ? null : (CampaignTracking::links((string) $body)[$index] ?? null);

            if ($target !== null) {
                $this->receipts->track($recipient, 'clicked', Carbon::now()->utc());
            }

            return $target;
        });

        return redirect()->away($target ?? throw ApiException::notFound('El enlace no es válido.'), 302);
    }
}
