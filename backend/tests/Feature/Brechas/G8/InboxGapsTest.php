<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function g8InboxMessages(string $code): array
{
    $id = rowOf('collab_conversations', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $id)->orderBy('sent_at')->get()->all());
}

it('abrir una conversación pone en cero sus no leídos', function () {
    actingAsSeed('U01');
    expect((int) rowOf('collab_conversations', 'CNV-0101')->unread_count)->toBeGreaterThan(0);

    $thread = $this->getJson('/api/v1/inbox/conversations/CNV-0101')->assertOk()->json('data');

    expect($thread['unread'])->toBe(0)
        ->and((int) rowOf('collab_conversations', 'CNV-0101')->unread_count)->toBe(0);
});

it('responder una conversación sin responsable deja el evento de autoasignación en el hilo', function () {
    $seller = actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Hola, te ayudo con tu consulta.'], critical())->assertCreated();

    $messages = collect(g8InboxMessages('CNV-0105'));
    $system = $messages->where('direction', 'system')->last();
    expect($system->body)->toBe("Asignada automáticamente a {$seller->name} al responder.")
        ->and($messages->last()->direction)->toBe('out');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Te escribo de nuevo.'], critical())->assertCreated();
    expect(collect(g8InboxMessages('CNV-0105'))->where('direction', 'system')->count())->toBe($messages->where('direction', 'system')->count());
});

it('la auditoría de la conversación lista las acciones con su autor', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/inbox/conversations/CNV-0101/messages', ['body' => 'Revisar el traslado con operaciones.', 'internal' => true], critical())->assertCreated();

    $audit = $this->getJson('/api/v1/inbox/conversations/CNV-0101/audit')->assertOk()->json('data');
    expect(collect($audit)->pluck('action'))->toContain('nota_interna')
        ->and($audit[0])->toHaveKeys(['code', 'action', 'before', 'after', 'actor', 'ip', 'at']);
    $this->getJson('/api/v1/inbox/conversations/CNV-9999/audit')->assertNotFound();
});

it('un adjunto se descarga y se ve en línea solo desde su conversación', function () {
    Storage::fake((string) config('filesystems.default'));
    actingAsSeed('U03');
    $file = UploadedFile::fake()->createWithContent('itinerario.pdf', "%PDF-1.4\nitinerario".str_repeat('z', 256)."\n%%EOF");
    $upload = $this->withHeaders(['Accept' => 'application/json'])->post('/api/v1/inbox/attachments', ['file' => $file])->assertCreated()->json('data');
    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Te envío el itinerario.', 'attachments' => [$upload['upload_id']]], critical())->assertCreated();

    $item = collect($this->getJson('/api/v1/inbox/conversations/CNV-0105')->json('data.messages'))->last()['files'][0];
    expect($item)->toHaveKeys(['id', 'name', 'mime', 'size', 'available'])->and($item['available'])->toBeTrue();

    $download = $this->get("/api/v1/inbox/conversations/CNV-0105/attachments/{$item['id']}");
    $download->assertOk();
    expect($download->headers->get('content-disposition'))->toContain('attachment')->toContain('itinerario.pdf');

    $inline = $this->get("/api/v1/inbox/conversations/CNV-0105/attachments/{$item['id']}?inline=1");
    $inline->assertOk();
    expect($inline->headers->get('content-disposition'))->toContain('inline');

    $this->getJson("/api/v1/inbox/conversations/CNV-0101/attachments/{$item['id']}")->assertNotFound();
});

it('la bandeja informa el alcance del rol y los datos de la agencia para las plantillas', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/inbox/conversations')->assertOk()->json('data');
    expect($data['scope'])->toBe('all')
        ->and($data['agency'])->toHaveKeys(['name', 'emergency_phone']);

    $card = $this->getJson('/api/v1/inbox/conversations/CNV-0101')->json('data.card');
    expect($card)->toHaveKeys(['in_trip', 'ticket']);
});
