<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Time\BusinessHours;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final class InboxResponseTimes
{
    public const SECTION = 'notifications';

    public const KEY = 'inbox_sla';

    public const CHANNELS = ['webchat' => 'Chat web', 'form' => 'Formularios', 'portal' => 'Portal del cliente'];

    public const OPTIONS = [15, 30, 60, 120, 240, 480];

    public const DEFAULTS = ['webchat' => 15, 'form' => 120, 'portal' => 240];

    public function __construct(private readonly TenantSettings $settings, private readonly BusinessHours $hours, private readonly AuditLogger $audit) {}

    public function read(): array
    {
        $stored = (array) ($this->settings->section(self::SECTION)[self::KEY] ?? []);

        return collect(self::DEFAULTS)->map(fn (int $default, string $channel): int => in_array((int) ($stored[$channel] ?? 0), self::OPTIONS, true) ? (int) $stored[$channel] : $default)->all();
    }

    public function minutes(string $channel): int
    {
        return $this->read()[$channel] ?? self::DEFAULTS['portal'];
    }

    public function due(CarbonInterface $from, int $minutes): string
    {
        return $this->hours->addMinutes($from, max(1, $minutes))->utc()->toDateTimeString();
    }

    public function dueFor(string $channel, CarbonInterface $from): string
    {
        return $this->due($from, $this->minutes($channel));
    }

    public function overview(): array
    {
        $row = DB::table('sys_settings as s')->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')->where('s.section', self::SECTION)->first(['s.lock_version', 's.updated_at', 'u.name']);
        $values = $this->read();

        return [
            'channels' => collect(self::CHANNELS)->map(fn (string $label, string $channel): array => ['channel' => $channel, 'label' => $label, 'minutes' => $values[$channel], 'default' => self::DEFAULTS[$channel]])->values()->all(),
            'options' => self::OPTIONS,
            'business_hours' => ['summary' => $this->hours->summary(), 'configured' => $this->hours->configured(), 'open_now' => $this->hours->isOpen(CarbonImmutable::now())],
            'lock_version' => (int) ($row->lock_version ?? 0),
            'updated_at' => $row->updated_at ?? null,
        ];
    }

    public function save(array $data, User $actor, ?int $expected): array
    {
        return DB::transaction(function () use ($data, $actor, $expected): array {
            $row = DB::table('sys_settings')->where('section', self::SECTION)->lockForUpdate()->first(['lock_version']);

            if ($expected !== null && $row !== null) {
                IfMatch::assertMatches($expected, (int) $row->lock_version, 'Los plazos de la bandeja');
            }

            $before = $this->read();
            $after = [...$before, ...array_map('intval', array_intersect_key($data, self::DEFAULTS))];

            if ($before === $after) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->save(self::SECTION, [...$this->settings->section(self::SECTION), self::KEY => $after], $actor);

            foreach (self::CHANNELS as $channel => $label) {
                if ($before[$channel] !== $after[$channel]) {
                    $this->audit->log('Configuración', self::SECTION.'.'.self::KEY.'.'.$channel, 'actualizar', "{$label}: {$before[$channel]} min", "{$label}: {$after[$channel]} min", actor: $actor);
                }
            }

            return $this->overview();
        });
    }
}
