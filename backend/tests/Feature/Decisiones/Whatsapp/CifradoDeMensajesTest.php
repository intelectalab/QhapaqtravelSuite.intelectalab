<?php

use App\Domain\Inbox\Support\MessageCipher;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

function wadecConversation(): object
{
    return withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('channel', 'whatsapp')->orderBy('code')->first());
}

it('las respuestas de la bandeja se guardan cifradas y la bandeja las muestra en claro', function () {
    actingAsSeed('U01');
    $conversation = wadecConversation();
    withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('id', $conversation->id)->update(['last_inbound_at' => now()]));

    $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/messages", ['body' => 'Le confirmo la recogida a las 07:30 en su hotel.'], critical())->assertSuccessful();

    $stored = withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->where('direction', 'out')->orderByDesc('sent_at')->value('body'));
    $thread = $this->getJson("/api/v1/inbox/conversations/{$conversation->code}")->assertOk()->json('data.messages');
    $list = collect($this->getJson('/api/v1/inbox/conversations')->assertOk()->json('data.items'))->firstWhere('code', $conversation->code);

    expect($stored)->toStartWith(MessageCipher::PREFIX)
        ->and($stored)->not->toContain('recogida')
        ->and(MessageCipher::open($stored))->toBe('Le confirmo la recogida a las 07:30 en su hotel.')
        ->and(collect($thread)->pluck('body'))->toContain('Le confirmo la recogida a las 07:30 en su hotel.')
        ->and(collect($thread)->pluck('body')->filter(fn ($body) => str_starts_with((string) $body, MessageCipher::PREFIX)))->toBeEmpty()
        ->and($list['preview'])->toBe('Le confirmo la recogida a las 07:30 en su hotel.');
});

it('los mensajes de desarrollo sin cifrar se siguen leyendo y la migración cifra y descifra de forma reversible', function () {
    Storage::fake((string) config('filesystems.default'));
    $conversation = wadecConversation();
    $path = 'tenants/'.tenantA()->getKey().'/inbox/'.Str::uuid7().'.pdf';
    Storage::disk((string) config('filesystems.default'))->put($path, "%PDF-1.4\n%adjunto de prueba\n");
    withinTenant(tenantA(), fn () => DB::table('collab_messages')->insert(['conversation_id' => $conversation->id, 'channel' => 'whatsapp', 'direction' => 'in', 'body' => 'Mensaje de desarrollo en claro', 'sent_at' => now()->subYear()]));

    actingAsSeed('U01');
    expect(collect($this->getJson("/api/v1/inbox/conversations/{$conversation->code}")->assertOk()->json('data.messages'))->pluck('body'))->toContain('Mensaje de desarrollo en claro');

    $platform = DB::connection('pgsql_platform');
    $tenant = (string) tenantA()->getKey();
    $messageId = (string) Str::uuid7();
    $eventId = (string) Str::uuid7();
    $platform->table('collab_messages')->insert(['id' => $messageId, 'tenant_id' => $tenant, 'conversation_id' => $conversation->id, 'channel' => 'whatsapp', 'direction' => 'in', 'body' => 'Mensaje antiguo en claro', 'sent_at' => now()->subYear()]);
    $platform->table('collab_message_attachments')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $tenant, 'message_id' => $messageId, 'file_name' => 'antiguo.pdf', 'mime' => 'application/pdf', 'size_bytes' => 28, 'storage_path' => $path, 'sha256' => str_repeat('a', 64), 'scan_status' => 'limpio']);
    $platform->table('collab_inbound_events')->insert(['id' => $eventId, 'tenant_id' => $tenant, 'channel' => 'whatsapp', 'external_event_id' => 'wamid.antiguo-'.$eventId, 'payload' => json_encode(['account_id' => null, 'message' => ['body' => 'Evento antiguo en claro']]), 'status' => 'procesado']);

    $migration = require base_path('database/migrations/2026_11_13_whatsapp_02_cifrar_mensajes_de_la_bandeja.php');
    $migration->up();

    $body = fn () => (string) $platform->table('collab_messages')->where('id', $messageId)->value('body');
    $payload = fn () => (string) $platform->table('collab_inbound_events')->where('id', $eventId)->value('payload');
    $file = fn () => (string) Storage::disk((string) config('filesystems.default'))->get($path);

    expect($body())->toStartWith(MessageCipher::PREFIX)
        ->and(MessageCipher::open($body()))->toBe('Mensaje antiguo en claro')
        ->and($payload())->not->toContain('Evento antiguo en claro')
        ->and(MessageCipher::open(json_decode($payload(), true)['message']['body']))->toBe('Evento antiguo en claro')
        ->and($file())->toStartWith(MessageCipher::FILE_PREFIX)
        ->and(MessageCipher::openFile($file()))->toBe("%PDF-1.4\n%adjunto de prueba\n");

    $migration->up();
    expect(MessageCipher::open($body()))->toBe('Mensaje antiguo en claro');

    $migration->down();
    expect($body())->toBe('Mensaje antiguo en claro')
        ->and($payload())->toContain('Evento antiguo en claro')
        ->and($file())->toBe("%PDF-1.4\n%adjunto de prueba\n");
});

it('los adjuntos se guardan cifrados en el almacenamiento y se descargan en claro', function () {
    Storage::fake((string) config('filesystems.default'));
    actingAsSeed('U01');
    $conversation = wadecConversation();
    withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('id', $conversation->id)->update(['last_inbound_at' => now()]));
    $pdf = "%PDF-1.4\n%voucher del pasajero\n";

    $upload = $this->post('/api/v1/inbox/attachments', ['file' => UploadedFile::fake()->createWithContent('voucher.pdf', $pdf)], ['Accept' => 'application/json'])->assertSuccessful()->json('data.upload_id');
    $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/messages", ['body' => 'Adjunto su voucher.', 'attachments' => [$upload]], critical())->assertSuccessful();

    $attachment = withinTenant(tenantA(), fn () => DB::table('collab_message_attachments as a')->join('collab_messages as m', 'm.id', '=', 'a.message_id')->where('m.conversation_id', $conversation->id)->orderByDesc('a.created_at')->first(['a.id', 'a.storage_path']));
    $raw = (string) Storage::disk((string) config('filesystems.default'))->get($attachment->storage_path);

    expect($raw)->toStartWith(MessageCipher::FILE_PREFIX)
        ->and($raw)->not->toContain('voucher del pasajero');

    $download = $this->get("/api/v1/inbox/conversations/{$conversation->code}/attachments/{$attachment->id}", ['Accept' => 'application/json'])->assertOk();
    expect($download->streamedContent())->toBe($pdf)
        ->and($download->headers->get('Content-Disposition'))->toContain('voucher.pdf');
});
