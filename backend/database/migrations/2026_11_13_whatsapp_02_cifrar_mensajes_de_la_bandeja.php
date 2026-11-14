<?php

declare(strict_types=1);

use App\Domain\Inbox\Support\MessageCipher;
use Illuminate\Database\Connection;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    private const CHUNK = 500;

    public function up(): void
    {
        $this->messages(fn (string $body): string => MessageCipher::seal($body), fn (string $body): bool => ! MessageCipher::sealed($body));
        $this->events(fn (array $message): array => MessageCipher::sealPayload($message));
        $this->files(fn (string $contents): string => MessageCipher::sealFile($contents), fn (string $contents): bool => ! MessageCipher::fileSealed($contents));
    }

    public function down(): void
    {
        $this->messages(fn (string $body): string => MessageCipher::open($body), fn (string $body): bool => MessageCipher::sealed($body));
        $this->events(fn (array $message): array => MessageCipher::openPayload($message));
        $this->files(fn (string $contents): string => MessageCipher::openFile($contents), fn (string $contents): bool => MessageCipher::fileSealed($contents));
    }

    private function messages(Closure $transform, Closure $applies): void
    {
        $db = $this->db();
        $db->table('collab_messages')->select(['id', 'body'])->orderBy('id')->chunkById(self::CHUNK, function ($rows) use ($db, $transform, $applies): void {
            foreach ($rows as $row) {
                if ($applies((string) $row->body)) {
                    $db->table('collab_messages')->where('id', $row->id)->update(['body' => $transform((string) $row->body)]);
                }
            }
        });
    }

    private function events(Closure $transform): void
    {
        $db = $this->db();
        $db->table('collab_inbound_events')->select(['id', 'payload'])->orderBy('id')->chunkById(self::CHUNK, function ($rows) use ($db, $transform): void {
            foreach ($rows as $row) {
                $payload = (array) json_decode((string) $row->payload, true);

                if (! isset($payload['message']) || ! is_array($payload['message'])) {
                    continue;
                }

                $message = $transform($payload['message']);

                if ($message !== $payload['message']) {
                    $db->table('collab_inbound_events')->where('id', $row->id)->update(['payload' => json_encode([...$payload, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)]);
                }
            }
        });
    }

    private function files(Closure $transform, Closure $applies): void
    {
        $disk = Storage::disk((string) config('filesystems.default'));

        $this->db()->table('collab_message_attachments')->select(['id', 'storage_path'])->orderBy('id')->chunkById(self::CHUNK, function ($rows) use ($disk, $transform, $applies): void {
            foreach ($rows as $row) {
                $path = (string) $row->storage_path;

                if ($path === '' || ! $disk->exists($path)) {
                    continue;
                }

                $contents = (string) $disk->get($path);

                if ($applies($contents)) {
                    $disk->put($path, $transform($contents));
                }
            }
        });
    }

    private function db(): Connection
    {
        return DB::connection('pgsql_platform');
    }
};
