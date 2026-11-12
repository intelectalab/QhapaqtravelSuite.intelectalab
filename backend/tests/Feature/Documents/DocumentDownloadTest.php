<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function downloadableDocument(string $reservation): string
{
    return withinTenant(tenantA(), function () use ($reservation): string {
        $reservationId = (string) DB::table('booking_reservations')->where('code', $reservation)->value('id');

        return (string) DB::table('sys_documents')->insertGetId([
            'doc_type' => 'itinerario', 'entity_type' => 'booking_reservations', 'entity_id' => $reservationId,
            'storage_disk' => 's3', 'storage_path' => "documentos/{$reservation}/itinerario.pdf", 'file_name' => "{$reservation}-itinerario.pdf",
            'mime_type' => 'application/pdf', 'size_bytes' => 1024, 'sha256' => str_repeat('a', 64),
        ]);
    });
}

beforeEach(function () {
    Storage::fake('s3');
    Storage::disk('s3')->buildTemporaryUrlsUsing(fn (string $path, DateTimeInterface $expiration): string => "https://archivos.prueba/{$path}?vence={$expiration->getTimestamp()}");
});

it('F0-30: GET documents/{id}/download redirige a un enlace firmado de 5 minutos y audita la descarga', function () {
    $id = downloadableDocument('RES-2026-000349');
    actingAsSeed('U01');

    $response = $this->get("/api/v1/documents/{$id}/download")->assertStatus(302);

    expect($response->headers->get('Location'))->toStartWith('https://archivos.prueba/documentos/RES-2026-000349/itinerario.pdf')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Reserva')->where('action', 'descargar')->where('entity_id', 'RES-2026-000349-itinerario.pdf')->exists()))->toBeTrue();
});

it('F0-30: la descarga exige el permiso y la cartera del registro de origen', function () {
    $id = downloadableDocument('RES-2026-000349');

    actingAsSeed('U04');
    expect($this->getJson("/api/v1/documents/{$id}/download"))->toBeApiError(403, 'SEC-BR-09');

    actingAsSeed('U01');
    expect($this->getJson('/api/v1/documents/00000000-0000-0000-0000-000000000000/download'))->toBeApiError(404);
    expect($this->getJson('/api/v1/documents/no-es-un-id/download'))->toBeApiError(404);
});
