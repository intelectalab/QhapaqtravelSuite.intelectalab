<?php

use Illuminate\Support\Facades\DB;

it('la configuración distingue cada serie del mismo documento y edita la serie indicada', function () {
    actingAsSeed('U01');
    $rows = fn () => withinTenant(tenantA(), fn () => DB::table('sys_sequences')->where('doc_type', 'quote')->orderBy('series')->get(['series', 'prefix', 'next_number'])->keyBy('series'));
    $before = $rows();
    $series = $before->keys()->map(fn ($key): string => (string) $key)->sort()->values();
    $year = $series->first(fn (string $key): bool => $key !== 'default');

    expect($year)->not->toBeNull();

    $listed = collect($this->getJson('/api/v1/settings')->assertOk()->json('data.sequences'))->where('doc_type', 'quote');
    expect($listed->pluck('series')->map(fn ($key): string => (string) $key)->sort()->values()->all())->toBe($series->all());

    $this->patchJson('/api/v1/settings/sequences', ['sequences' => [['doc_type' => 'quote', 'series' => $year, 'prefix' => $before[$year]->prefix, 'next_number' => $before[$year]->next_number + 5]]])->assertOk();

    $after = $rows();
    expect((int) $after[$year]->next_number)->toBe($before[$year]->next_number + 5)
        ->and((int) $after['default']->next_number)->toBe((int) $before['default']->next_number);
});
