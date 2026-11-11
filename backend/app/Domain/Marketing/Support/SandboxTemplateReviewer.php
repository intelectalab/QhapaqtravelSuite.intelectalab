<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Integrations\Data\AdapterResult;
use Illuminate\Support\Str;

final class SandboxTemplateReviewer
{
    public const RESPONSES = ['aprobada', 'rechazada'];

    public function submit(string $name, string $category, string $body, ?string $providerId): AdapterResult
    {
        return AdapterResult::success('en_revision', $providerId ?? 'wa_tpl_sbx_'.Str::lower(Str::random(10)), ['simulated' => true, 'name' => $name, 'category' => $category, 'length' => mb_strlen($body)]);
    }

    public function respond(string $providerId, string $status): AdapterResult
    {
        return in_array($status, self::RESPONSES, true)
            ? AdapterResult::success($status, $providerId, ['simulated' => true])
            : AdapterResult::permanent('Respuesta de revisión desconocida.');
    }
}
