<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class OAuthTokenError extends RuntimeException
{
    public function __construct(public readonly string $error, string $description, public readonly int $status = 400, public readonly ?string $replayedCode = null)
    {
        parent::__construct($description);
    }

    public function render(): JsonResponse
    {
        $headers = ['Cache-Control' => 'no-store', 'Pragma' => 'no-cache'];

        if ($this->status === 401) {
            $headers['WWW-Authenticate'] = 'Basic realm="KipuControl"';
        }

        return new JsonResponse(['error' => $this->error, 'error_description' => $this->getMessage()], $this->status, $headers);
    }
}
