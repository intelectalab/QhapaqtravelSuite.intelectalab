<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Eloquent\Model;

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
            return;
        }
        IfMatch::assertMatches($expected, (int) $this->getAttribute('lock_version'), $this->lockVersionLabel());
    }

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

        $query = static::query()->whereKey($this->getKey())->where('lock_version', $expected);
        $affected = $query->toBase()->update($dirty);

        if ($affected === 0) {
            $current = (int) static::query()->whereKey($this->getKey())->value('lock_version');
            IfMatch::assertMatches($expected, $current, $this->lockVersionLabel());

            throw ApiException::notFound();
        }

        $this->forceFill($dirty)->syncOriginal();
    }

    protected function lockVersionLabel(): string
    {
        return 'El registro';
    }
}
