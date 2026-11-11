<?php

use App\Domain\Integrations\Fake\FakeMalwareScanner;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Storage::fake((string) config('filesystems.default'));
});

function inboxPdf(string $payload = 'itinerario'): UploadedFile
{
    return UploadedFile::fake()->createWithContent('itinerario.pdf', "%PDF-1.4\n".$payload.str_repeat('z', 256)."\n%%EOF");
}

function inboxAttach(UploadedFile $file): TestResponse
{
    return test()->withHeaders(['Accept' => 'application/json'])->post('/api/v1/inbox/attachments', ['file' => $file]);
}

function inboxFiles(string $code): array
{
    $id = rowOf('collab_conversations', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('collab_message_attachments as a')->join('collab_messages as m', 'm.id', '=', 'a.message_id')->where('m.conversation_id', $id)->get(['a.*'])->all());
}

it('adjuntar un PDF al responder lo guarda revisado, ligado al mensaje y auditado', function () {
    actingAsSeed('U03');

    $upload = inboxAttach(inboxPdf())->assertCreated()->json('data');
    expect($upload['mime'])->toBe('application/pdf')->and($upload['file_name'])->toBe('itinerario.pdf');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Te envío el itinerario.', 'attachments' => [$upload['upload_id']]], critical())->assertCreated();

    $files = inboxFiles('CNV-0105');
    expect($files)->toHaveCount(1)
        ->and($files[0]->scan_status)->toBe('limpio')
        ->and($files[0]->sha256)->toHaveLength(64)
        ->and(Storage::disk((string) config('filesystems.default'))->exists($files[0]->storage_path))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Conversación')->where('entity_id', 'CNV-0105')->where('action', 'adjuntar')->value('after_value')))->toBe('itinerario.pdf');

    $thread = $this->getJson('/api/v1/inbox/conversations/CNV-0105')->assertOk()->json('data');
    expect(collect($thread['messages'])->last()['files'][0]['name'])->toBe('itinerario.pdf');

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Otra vez', 'attachments' => [$upload['upload_id']]], critical()))->toBeApiError(422, 'INB-BR-11');
});

it('se puede enviar solo el adjunto, sin texto', function () {
    actingAsSeed('U03');
    $upload = inboxAttach(inboxPdf('voucher'))->assertCreated()->json('data');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['attachments' => [$upload['upload_id']]], critical())->assertCreated();

    expect(inboxFiles('CNV-0105'))->toHaveCount(1);
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', [], critical()))->toBeApiError(422);
});

it('un adjunto con malware se rechaza, no se guarda y queda auditado', function () {
    actingAsSeed('U03');

    expect(inboxAttach(inboxPdf(FakeMalwareScanner::marker())))->toBeApiError(422, 'FILE_INFECTED')
        ->and(Storage::disk((string) config('filesystems.default'))->allFiles())->toBe([])
        ->and(auditExists(['entity' => 'Conversación', 'entity_id' => 'adjunto', 'action' => 'archivo_bloqueado']))->toBeTrue();
});

it('solo admite imágenes o PDF y un adjunto ajeno no se puede usar', function () {
    actingAsSeed('U03');
    expect(inboxAttach(UploadedFile::fake()->createWithContent('notas.txt', 'texto plano')))->toBeApiError(422, 'INB-BR-11');

    $upload = inboxAttach(inboxPdf())->assertCreated()->json('data');
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Hola', 'attachments' => [$upload['upload_id']]], critical()))->toBeApiError(422, 'INB-BR-11')
        ->and(inboxFiles('CNV-0105'))->toBe([]);
});

it('la carga prefirmada devuelve la URL y no deja enviar hasta que el archivo termina de subir', function () {
    actingAsSeed('U03');

    $signed = $this->postJson('/api/v1/inbox/attachments', ['file_name' => 'foto.jpg', 'mime' => 'image/jpeg', 'size' => 2048, 'sha256' => str_repeat('a', 64)])->assertOk()->json('data');
    expect($signed['method'])->toBe('PUT')->and($signed['url'])->not->toBeEmpty();

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Foto del hotel', 'attachments' => [$signed['upload_id']]], critical()))->toBeApiError(422, 'INB-BR-11')
        ->and($this->postJson('/api/v1/inbox/attachments', ['file_name' => 'foto.exe', 'mime' => 'application/x-msdownload', 'size' => 2048, 'sha256' => str_repeat('a', 64)]))->toBeApiError(422, 'INB-BR-11')
        ->and($this->postJson('/api/v1/inbox/attachments', ['file_name' => 'video.pdf', 'mime' => 'application/pdf', 'size' => 17 * 1024 * 1024, 'sha256' => str_repeat('a', 64)]))->toBeApiError(422, 'INB-BR-11');
});

it('Finanzas no adjunta archivos en la bandeja', function () {
    actingAsSeed('U07');

    expect(inboxAttach(inboxPdf()))->toBeApiError(403);
});
