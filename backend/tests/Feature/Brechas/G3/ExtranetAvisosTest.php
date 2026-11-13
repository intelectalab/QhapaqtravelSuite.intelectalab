<?php

use App\Domain\Operations\Support\OpsMail;
use App\Domain\SupplierPortal\Support\SupplierNotices;
use Illuminate\Support\Facades\DB;

function g3SupplierProvider(string $user = 'U17'): string
{
    return (string) rowOf('iam_users', $user)->provider_id;
}

it('06 §2: la extranet muestra los contactos de la agencia para operaciones, pagos y emergencias 24 h', function () {
    actingAsSeed('U17');

    $contacts = collect($this->getJson('/api/v1/supplier/company')->assertOk()->json('data.agency_contacts'));

    expect($contacts->pluck('kind')->all())->toBe(['operaciones', 'pagos', 'emergencias'])
        ->and($contacts->firstWhere('kind', 'emergencias')['phone'])->not->toBeNull()
        ->and($contacts->firstWhere('kind', 'operaciones')['name'])->not->toBe('');
});

it('06 §2: todas las pantallas de la extranet reciben los 4 indicadores del marco común', function () {
    actingAsSeed('U17');

    $frame = $this->getJson('/api/v1/supplier/session')->assertOk()->json('data.frame');
    $home = $this->getJson('/api/v1/supplier/home')->assertOk()->json('data.kpis');

    expect($frame)->toHaveKeys(['pending', 'alternatives', 'response_hours', 'upcoming', 'upcoming_pax', 'receivable', 'open_incidents'])
        ->and($frame['pending'])->toBe($home['pending'])
        ->and($frame['upcoming'])->toBe($home['upcoming'])
        ->and($frame['open_incidents'])->toBe($home['open_incidents']);
});

it('06 §8: una solicitud nueva deja un aviso en la extranet a los usuarios del proveedor', function () {
    actingAsSeed('U05');
    $provider = (string) serviceRow('RS-3491')->provider_id;

    $this->postJson('/api/v1/reservations/RES-2026-000349/services/RS-3491/request', ['note' => 'Grupo con niños'])->assertOk();

    $users = withinTenant(tenantA(), fn () => DB::table('iam_users')->where('provider_id', $provider)->where('status', 'activo')->whereNull('deleted_at')->pluck('id'));
    $notices = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'proveedor.solicitud')->where('channel', 'portal')->whereIn('recipient_user_id', $users->all())->count());
    expect($notices)->toBe($users->count());
});

it('06 §8: el voucher emitido o anulado y la rooming list reenviada aparecen en los avisos del proveedor', function () {
    $provider = g3SupplierProvider();
    withinTenant(tenantA(), function () use ($provider): void {
        $voucher = DB::table('ops_vouchers')->where('provider_id', $provider)->orderBy('code')->value('id');
        app(OpsMail::class)->voucher((string) $voucher, 'voided', 'Cambio de proveedor');
        $list = DB::table('ops_rooming_lists')->where('hotel_provider_id', $provider)->whereNull('deleted_at')->value('id');
        if ($list !== null) {
            DB::table('ops_rooming_lists')->where('id', $list)->update(['sent_version' => 2]);
            app(OpsMail::class)->rooming((string) $list);
        }
        app(SupplierNotices::class)->toProvider($provider, 'proveedor.solicitud', 'Nueva solicitud RS-PRUEBA · Traslado', 'Confirme o proponga una alternativa.', 'booking_service', (string) DB::table('booking_reservation_services')->value('id'));
    });
    actingAsSeed('U17');

    $alerts = collect($this->getJson('/api/v1/supplier/home')->assertOk()->json('data.alerts'));

    expect($alerts->pluck('kind')->all())->toContain('voucher', 'request')
        ->and($alerts->firstWhere('kind', 'voucher')['title'])->toContain('anulado')
        ->and($alerts->firstWhere('kind', 'voucher')['href'])->toBe('/proveedor/vouchers');
});
