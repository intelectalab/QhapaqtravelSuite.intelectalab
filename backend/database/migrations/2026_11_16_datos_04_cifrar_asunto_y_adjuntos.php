<?php

declare(strict_types=1);

use App\Domain\Inbox\Support\MessageCipher;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const CHUNK = 500;

    private const COLUMNS = ['collab_conversations' => 'subject', 'collab_message_attachments' => 'file_name'];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $column) {
            $this->transform($table, $column, fn (string $value): string => MessageCipher::seal($value), fn (string $value): bool => ! MessageCipher::sealed($value));
        }
    }

    public function down(): void
    {
        foreach (self::COLUMNS as $table => $column) {
            $this->transform($table, $column, fn (string $value): string => mb_substr(MessageCipher::open($value), 0, MessageCipher::LABEL_MAX), fn (string $value): bool => MessageCipher::sealed($value));
        }
    }

    private function transform(string $table, string $column, Closure $transform, Closure $applies): void
    {
        $db = DB::connection('pgsql_platform');
        $db->table($table)->select(['id', $column])->orderBy('id')->chunkById(self::CHUNK, function ($rows) use ($db, $table, $column, $transform, $applies): void {
            foreach ($rows as $row) {
                $value = (string) $row->{$column};

                if ($applies($value)) {
                    $db->table($table)->where('id', $row->id)->update([$column => $transform($value)]);
                }
            }
        });
    }
};
