<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function quoteNotices(string $code, string $event): array
{
    $id = rowOf('quote_quotes', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('source_type', 'quote')->where('source_id', $id)->where('event_code', $event)->pluck('recipient_user_id')->map(fn ($user) => (string) $user)->all());
}

it('pedir aprobación avisa a Gerencia y la decisión vuelve al asesor (03 §8)', function () {
    Queue::fake();
    withinTenant(tenantA(), function () {
        $versionId = DB::table('quote_quotes')->where('code', 'COT-2026-00185')->value('current_version_id');
        DB::table('quote_versions')->where('id', $versionId)->update(['discount_pct' => 12]);
    });
    $owner = (string) rowOf('quote_quotes', 'COT-2026-00185')->owner_id;

    actingAsSeed('U04');
    $this->postJson('/api/v1/quotes/COT-2026-00185/internal-approval-requests', ['note' => 'Descuento por grupo grande'], critical())->assertSuccessful();
    expect(quoteNotices('COT-2026-00185', 'cotizacion.aprobacion_solicitada'))->toContain(idOf('iam_users', 'U02'))->not->toContain(idOf('iam_users', 'U04'));

    actingAsSeed('U02');
    decideInternally('COT-2026-00185', 'approve')->assertSuccessful();
    expect(quoteNotices('COT-2026-00185', 'cotizacion.aprobacion_aprobada'))->toBe([$owner]);
});

it('reasignar avisa al nuevo asesor', function () {
    Queue::fake();
    actingAsSeed('U02');
    $quote = rowOf('quote_quotes', 'COT-2026-00185');
    $target = collect(['U04', 'U03', 'U06'])->map(fn (string $code): string => idOf('iam_users', $code))->first(fn (string $id): bool => $id !== (string) $quote->owner_id);

    $this->postJson('/api/v1/quotes/COT-2026-00185/reassign', ['owner_id' => $target, 'note' => 'Cubre vacaciones'], critical((int) $quote->lock_version))->assertSuccessful();

    expect(quoteNotices('COT-2026-00185', 'cotizacion.reasignada'))->toBe([$target]);
});
