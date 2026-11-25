<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class CommittedSnapshot
{
    private const IGNORED = ['zz_test_fingerprint', 'migrations'];

    private array $tables = [];

    private function __construct(private readonly ConnectionInterface $owner) {}

    public static function take(): self
    {
        $owner = DB::connection('pgsql_owner');

        if ($owner->transactionLevel() > 0 || $owner->getDatabaseName() !== TestDatabase::NAME) {
            throw new RuntimeException('La foto de datos comprometidos necesita la conexión de dueño de '.TestDatabase::NAME.' fuera de una transacción.');
        }

        $snapshot = new self($owner);
        $names = collect($owner->select("select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition order by c.relname"))
            ->pluck('name')->reject(fn (string $name): bool => in_array($name, self::IGNORED, true))->values();

        foreach ($names as $index => $name) {
            $copy = "zz_snapshot_{$index}";
            $owner->statement("drop table if exists {$copy}");
            $owner->statement("create temp table {$copy} as select * from \"{$name}\"");
            $snapshot->tables[$name] = $copy;
        }

        return $snapshot;
    }

    public function changed(): array
    {
        return collect($this->tables)->filter(fn (string $copy, string $name): bool => $this->digest("\"{$name}\"") !== $this->digest($copy))->keys()->all();
    }

    public function restore(): array
    {
        $changed = $this->changed();
        $this->owner->statement('set session_replication_role = replica');

        try {
            foreach ($changed as $name) {
                $copy = $this->tables[$name];
                $columns = collect($this->owner->select("select column_name from information_schema.columns where table_schema = 'public' and table_name = ? and is_generated = 'NEVER' order by ordinal_position", [$name]))
                    ->map(fn (object $row): string => '"'.$row->column_name.'"')->implode(', ');

                $this->owner->statement("delete from \"{$name}\" x where md5(x::text) not in (select md5(s::text) from {$copy} s)");
                $this->owner->statement("insert into \"{$name}\" ({$columns}) overriding system value select {$columns} from {$copy} s where md5(s::text) not in (select md5(x::text) from \"{$name}\" x)");
            }
        } finally {
            $this->owner->statement('set session_replication_role = origin');
        }

        $left = $this->changed();

        foreach ($this->tables as $copy) {
            $this->owner->statement("drop table if exists {$copy}");
        }

        if ($left !== []) {
            throw new RuntimeException('No se pudo dejar '.TestDatabase::NAME.' como estaba: '.implode(', ', $left).'. Corre las pruebas con KIPUCONTROL_TEST_REFRESH=1.');
        }

        return $changed;
    }

    private function digest(string $relation): string
    {
        return (string) $this->owner->selectOne("select count(*) || ':' || coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text))), '') as digest from {$relation} x")->digest;
    }
}
