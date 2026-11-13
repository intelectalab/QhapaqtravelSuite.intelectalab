<?php

declare(strict_types=1);

namespace App\Domain\Shared\Http\Controllers;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Response;

final class OpenApiController
{
    public const FILE = '../docs/kit/api/openapi.json';

    public function __invoke(): Response
    {
        $path = base_path(self::FILE);

        if (! is_file($path)) {
            throw ApiException::notFound('La documentación de la API no está publicada en este servidor.');
        }

        $etag = '"'.md5_file($path).'"';

        if (request()->header('If-None-Match') === $etag) {
            return response('', 304, ['ETag' => $etag]);
        }

        return response((string) file_get_contents($path), 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Cache-Control' => 'public, max-age=600',
            'ETag' => $etag,
        ]);
    }
}
