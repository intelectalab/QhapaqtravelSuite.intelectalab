<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Time\BusinessHours;
use Illuminate\Support\Facades\DB;

final class TransferSettings
{
    public const SECTION = 'ecommerce';

    public const KEY = 'transfers';

    public const CANCEL_HOURS = [24, 48, 72];

    public const ALERT_MINUTES = [120, 240, 480];

    public const REMINDER_MINUTES = [30, 60, 120];

    public const ESCALATE_MINUTES = [60, 120, 240];

    public const CLIENT_WARNING_MINUTES = 120;

    public const DEFAULTS = [
        'alert_finance' => true,
        'alert_minutes' => 240,
        'auto_cancel' => false,
        'cancel_hours' => 24,
        'reminder_minutes' => 60,
        'escalate_minutes' => 120,
    ];

    private const LABELS = [
        'alert_finance' => 'Avisar a Finanzas',
        'alert_minutes' => 'Aviso a Finanzas (minutos hábiles)',
        'auto_cancel' => 'Cancelar y liberar cupos',
        'cancel_hours' => 'Plazo para cancelar (horas)',
        'reminder_minutes' => 'Recordatorio a Finanzas (minutos hábiles)',
        'escalate_minutes' => 'Escalamiento a Gerencia (minutos hábiles)',
    ];

    public function __construct(private readonly TenantSettings $settings, private readonly AuditLogger $audit, private readonly BusinessHours $hours) {}

    public function read(): array
    {
        return self::merge((array) ($this->settings->section(self::SECTION)[self::KEY] ?? []));
    }

    public function overview(): array
    {
        $row = DB::table('sys_settings as s')->leftJoin('iam_users as u', 'u.id', '=', 's.updated_by')->where('s.section', self::SECTION)->first(['s.lock_version', 's.updated_at', 'u.name']);

        return [
            ...$this->read(),
            'options' => ['cancel_hours' => self::CANCEL_HOURS, 'alert_minutes' => self::ALERT_MINUTES, 'reminder_minutes' => self::REMINDER_MINUTES, 'escalate_minutes' => self::ESCALATE_MINUTES],
            'client_warning_minutes' => self::CLIENT_WARNING_MINUTES,
            'business_hours' => ['summary' => $this->hours->summary(), 'configured' => $this->hours->configured()],
            'lock_version' => (int) ($row->lock_version ?? 0),
            'updated_at' => $row->updated_at ?? null,
            'updated_by' => $row->name ?? null,
        ];
    }

    public function save(array $data, User $actor, ?int $expected): array
    {
        return DB::transaction(function () use ($data, $actor, $expected): array {
            $row = DB::table('sys_settings')->where('section', self::SECTION)->lockForUpdate()->first(['lock_version']);

            if ($expected !== null && $row !== null) {
                IfMatch::assertMatches($expected, (int) $row->lock_version, 'La configuración de pagos');
            }

            $before = $this->read();
            $after = self::merge([...$before, ...array_intersect_key($data, self::DEFAULTS)]);
            $changed = array_keys(array_filter(self::DEFAULTS, fn (mixed $value, string $key): bool => $before[$key] !== $after[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed === []) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->save(self::SECTION, [...$this->settings->section(self::SECTION), self::KEY => $after], $actor);

            foreach ($changed as $key) {
                $this->audit->log('Configuración', self::SECTION.'.'.self::KEY.'.'.$key, 'actualizar', self::LABELS[$key].': '.TenantSettings::text($before[$key]), self::LABELS[$key].': '.TenantSettings::text($after[$key]), actor: $actor);
            }

            return $this->overview();
        });
    }

    public static function merge(array $stored): array
    {
        $pick = fn (string $key, array $allowed): int => in_array((int) ($stored[$key] ?? 0), $allowed, true) ? (int) $stored[$key] : self::DEFAULTS[$key];

        return [
            'alert_finance' => array_key_exists('alert_finance', $stored) ? filter_var($stored['alert_finance'], FILTER_VALIDATE_BOOLEAN) : self::DEFAULTS['alert_finance'],
            'alert_minutes' => $pick('alert_minutes', self::ALERT_MINUTES),
            'auto_cancel' => array_key_exists('auto_cancel', $stored) ? filter_var($stored['auto_cancel'], FILTER_VALIDATE_BOOLEAN) : self::DEFAULTS['auto_cancel'],
            'cancel_hours' => $pick('cancel_hours', self::CANCEL_HOURS),
            'reminder_minutes' => $pick('reminder_minutes', self::REMINDER_MINUTES),
            'escalate_minutes' => $pick('escalate_minutes', self::ESCALATE_MINUTES),
        ];
    }
}
