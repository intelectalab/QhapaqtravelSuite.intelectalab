<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class MessageCipher
{
    public const PREFIX = 'kc1:';

    public const FILE_PREFIX = "KCENC1\n";

    public static function seal(?string $text): string
    {
        $text = (string) $text;

        return self::sealed($text) ? $text : self::PREFIX.Crypt::encryptString($text);
    }

    public static function open(mixed $stored): string
    {
        $stored = (string) $stored;

        if (! self::sealed($stored)) {
            return $stored;
        }

        try {
            return Crypt::decryptString(substr($stored, strlen(self::PREFIX)));
        } catch (DecryptException) {
            return 'No pudimos descifrar este mensaje.';
        }
    }

    public static function sealed(string $value): bool
    {
        return str_starts_with($value, self::PREFIX);
    }

    public static function sealFile(string $contents): string
    {
        return self::fileSealed($contents) ? $contents : self::FILE_PREFIX.Crypt::encryptString($contents);
    }

    public static function openFile(string $contents): string
    {
        return self::fileSealed($contents) ? Crypt::decryptString(substr($contents, strlen(self::FILE_PREFIX))) : $contents;
    }

    public static function fileSealed(string $contents): bool
    {
        return str_starts_with($contents, self::FILE_PREFIX);
    }

    public static function sealPayload(array $message): array
    {
        if (array_key_exists('body', $message)) {
            $message['body'] = self::seal((string) $message['body']);
        }

        if (isset($message['attachments']) && is_array($message['attachments'])) {
            $message['attachments'] = array_map(fn (mixed $file): mixed => is_array($file) && isset($file['content']) && ! self::sealed((string) $file['content']) ? [...$file, 'content' => self::seal((string) $file['content'])] : $file, $message['attachments']);
        }

        return $message;
    }

    public static function openPayload(array $message): array
    {
        if (array_key_exists('body', $message)) {
            $message['body'] = self::open($message['body']);
        }

        if (isset($message['attachments']) && is_array($message['attachments'])) {
            $message['attachments'] = array_map(fn (mixed $file): mixed => is_array($file) && isset($file['content']) ? [...$file, 'content' => self::open($file['content'])] : $file, $message['attachments']);
        }

        return $message;
    }
}
