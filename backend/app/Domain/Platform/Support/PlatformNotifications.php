<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Models\PlatformUser;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlatformNotifications
{
    public const LABELS = [
        'cobranza' => 'Cobranza',
        'prueba' => 'Pruebas',
        'suspendida' => 'Agencias',
        'excepcion' => 'Excepciones del plan',
        'uso' => 'Uso del plan',
        'tarea' => 'Tareas e integraciones',
        'demo' => 'Solicitudes comerciales',
    ];

    public function __construct(private readonly PlatformHome $home) {}

    public function feed(PlatformUser $user): array
    {
        $alerts = $this->alerts();
        $state = $this->state($user);
        $now = now()->toIso8601String();
        $seen = [];

        foreach ($alerts as $alert) {
            $seen[$alert['key']] = $state['seen'][$alert['key']] ?? $alert['at'] ?? $now;
        }

        $read = array_values(array_intersect($state['read'], array_keys($seen)));
        $this->store($user, ['seen' => $seen, 'read' => $read]);

        $items = $alerts->map(fn (array $alert): array => [
            'id' => $alert['key'],
            'code' => null,
            'event_code' => $alert['kind'],
            'event_label' => self::LABELS[$alert['kind']] ?? 'Plataforma',
            'channel' => 'portal',
            'subject' => $alert['title'],
            'body' => $alert['detail'],
            'source_type' => null,
            'status' => 'enviado',
            'created_at' => $seen[$alert['key']],
            'read_at' => null,
            'read' => in_array($alert['key'], $read, true),
            'href' => $alert['href'],
            'tone' => $alert['tone'],
        ])->sortByDesc('created_at')->values();

        return ['items' => $items->all(), 'unread' => $items->where('read', false)->count()];
    }

    public function readAll(PlatformUser $user): int
    {
        $state = $this->state($user);
        $keys = $this->alerts()->pluck('key')->all();
        $marked = count(array_diff($keys, $state['read']));
        $this->store($user, ['seen' => $state['seen'], 'read' => $keys]);

        return $marked;
    }

    private function alerts(): Collection
    {
        $demos = DB::connection('pgsql_platform')->table('platform_demo_requests')->where('status', 'nueva')->orderByDesc('created_at')->limit(20)
            ->get(['code', 'kind', 'full_name', 'company', 'created_at'])
            ->map(fn (object $row): array => [
                'tone' => 'info',
                'kind' => 'demo',
                'title' => ($row->kind === 'trial' ? 'Solicitud de prueba' : 'Solicitud de demo').' de '.($row->company ?: $row->full_name),
                'detail' => "{$row->full_name} · {$row->code}",
                'href' => null,
                'at' => Carbon::parse($row->created_at)->toIso8601String(),
            ]);

        return $this->home->alerts()->map(fn (array $alert): array => [...$alert, 'at' => null])->concat($demos)
            ->map(fn (array $alert): array => [...$alert, 'key' => substr(hash('sha256', $alert['kind'].'|'.$alert['title']), 0, 24)])
            ->unique('key')->values();
    }

    private function state(PlatformUser $user): array
    {
        $state = PlatformSettings::read($this->key($user));

        return ['seen' => (array) ($state['seen'] ?? []), 'read' => array_values((array) ($state['read'] ?? []))];
    }

    private function store(PlatformUser $user, array $state): void
    {
        if ($state !== $this->state($user)) {
            PlatformSettings::write($this->key($user), $state, (string) $user->getKey());
        }
    }

    private function key(PlatformUser $user): string
    {
        return 'notif:'.str_replace('-', '', (string) $user->getKey());
    }
}
