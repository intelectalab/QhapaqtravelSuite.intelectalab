<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class AttendDemoRequest
{
    private const CONNECTION = 'pgsql_platform';

    public const TRANSITIONS = [
        'nueva' => ['contactada', 'convertida', 'descartada'],
        'contactada' => ['convertida', 'descartada'],
        'descartada' => ['contactada'],
        'convertida' => [],
    ];

    public function __construct(private readonly PlatformSession $session) {}

    public function __invoke(string $code, string $status, ?string $notes, PlatformUser $actor): void
    {
        $notes = trim((string) $notes) === '' ? null : trim((string) $notes);

        DB::connection(self::CONNECTION)->transaction(function () use ($code, $status, $notes, $actor): void {
            $row = DB::connection(self::CONNECTION)->table('platform_demo_requests')->where('code', $code)->lockForUpdate()->first(['id', 'status', 'company'])
                ?? throw ApiException::notFound('La solicitud no existe.');

            if (! in_array($status, self::TRANSITIONS[$row->status] ?? [], true)) {
                throw ApiException::conflict('DEMO-BR-02', "Una solicitud {$row->status} no puede pasar a {$status}.", ['from' => $row->status, 'to' => $status]);
            }

            if ($status === 'descartada' && $notes === null) {
                throw ApiException::unprocessable('DEMO-BR-03', 'Escribe por qué se descarta la solicitud.');
            }

            DB::connection(self::CONNECTION)->table('platform_demo_requests')->where('id', $row->id)->update([
                'status' => $status,
                'notes' => $notes,
                'handled_by' => $actor->getKey(),
                'handled_at' => now(),
            ]);

            $this->session->log('Solicitud comercial', $code, 'cambiar_estado', $row->status, $status.($notes ? " · {$notes}" : ''), $actor);
        });
    }
}
