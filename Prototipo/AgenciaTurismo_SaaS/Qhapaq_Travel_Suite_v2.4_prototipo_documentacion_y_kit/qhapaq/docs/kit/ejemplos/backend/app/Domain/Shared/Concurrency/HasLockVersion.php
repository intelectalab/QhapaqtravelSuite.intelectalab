<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Concurrencia optimista con `lock_version integer not null default 0` (CONVENCIONES §2; 39 tablas del SQL).
 *
 * Dos formas de uso:
 *
 * A) Recurso ya bloqueado en la transacción (`lockForUpdate()`): comparar y guardar.
 *      $quote = Quote::query()->whereKey($id)->lockForUpdate()->firstOrFail();
 *      $quote->assertLockVersion($ifMatch);            // 409 STALE_VERSION si difiere
 *      ... cambios vía máquina de estados ...
 *      $quote->save();                                  // incrementa lock_version
 *
 * B) Sin bloqueo previo: UPDATE condicional (compare-and-set). 0 filas afectadas ⇒ 409.
 *      $reservation->saveWithLockVersion($ifMatch);
 *
 * El trigger `app_bump_lock_version` (BD) incrementa lock_version si la aplicación no lo hizo; aquí se
 * incrementa explícitamente para que el modelo en memoria quede con el valor correcto sin releer.
 *
 * @mixin Model
 */
trait HasLockVersion
{
    public static function bootHasLockVersion(): void
    {
        static::updating(function (Model $model): void {
            if (! $model->isDirty('lock_version')) {
                $model->setAttribute('lock_version', (int) $model->getOriginal('lock_version') + 1);
            }
        });
    }

    public function assertLockVersion(?int $expected): void
    {
        if ($expected === null) {
            return; // operaciones internas (jobs) sin If-Match
        }
        IfMatch::assertMatches($expected, (int) $this->getAttribute('lock_version'), $this->lockVersionLabel());
    }

    /** UPDATE … WHERE id = ? AND lock_version = ? (patrón B). */
    public function saveWithLockVersion(int $expected): void
    {
        $dirty = $this->getDirty();
        if ($dirty === []) {
            return;
        }

        $dirty['lock_version'] = $expected + 1;
        if ($this->usesTimestamps()) {
            $dirty[$this->getUpdatedAtColumn()] = $this->freshTimestampString();
        }

        /** @var Builder<static> $query */
        $query = static::query()->whereKey($this->getKey())->where('lock_version', $expected);
        $affected = $query->toBase()->update($dirty);

        if ($affected === 0) {
            $current = (int) static::query()->whereKey($this->getKey())->value('lock_version');
            IfMatch::assertMatches($expected, $current, $this->lockVersionLabel());
            // Misma versión pero 0 filas: el registro ya no es visible (borrado u otro tenant).
            throw \App\Domain\Shared\Errors\ApiException::notFound();
        }

        $this->forceFill($dirty)->syncOriginal();
    }

    protected function lockVersionLabel(): string
    {
        return 'El registro';
    }
}
