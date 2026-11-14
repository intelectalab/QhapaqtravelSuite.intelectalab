<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Time\BusinessHours;
use App\Domain\Shared\Time\BusinessSchedule;
use Illuminate\Support\Facades\DB;

final class SaveBusinessHours
{
    public function __construct(
        private readonly TenantSettings $settings,
        private readonly BusinessHours $hours,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function save(array $days, User $actor, ?int $expected = null): array
    {
        foreach (BusinessSchedule::DAYS as $day) {
            $entry = $days[$day] ?? [];

            if (filter_var($entry['open'] ?? false, FILTER_VALIDATE_BOOLEAN) && ! BusinessSchedule::validRange((string) ($entry['from'] ?? ''), (string) ($entry['to'] ?? ''))) {
                throw ApiException::unprocessable('CFG-HRS-01', 'Revisa el horario: el cierre debe ser después de la apertura.', ['field' => "days.{$day}"]);
            }
        }

        $normalized = BusinessSchedule::normalize($days) ?? throw ApiException::unprocessable('CFG-HRS-02', 'Marca al menos un día abierto.');

        return DB::transaction(function () use ($normalized, $actor, $expected): array {
            $row = DB::table('sys_settings')->where('section', BusinessHours::SECTION)->lockForUpdate()->first(['values', 'lock_version']);

            if ($expected !== null && $row !== null) {
                IfMatch::assertMatches($expected, (int) $row->lock_version, 'El horario de atención');
            }

            $before = $this->hours->schedule();
            $after = BusinessSchedule::fromDays($normalized, $this->context->timezone());

            if ($before->configured && $before->days() === $after->days()) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            $this->settings->save(BusinessHours::SECTION, [...$this->settings->section(BusinessHours::SECTION), BusinessHours::KEY => $normalized], $actor);
            $this->audit->log('Configuración', 'general.business_hours', 'actualizar', $before->configured ? $before->summary() : null, $after->summary());
            $this->hours->forget();

            return $this->hours->overview();
        });
    }
}
