<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use Illuminate\Support\Str;

final class CampaignTracking
{
    public const PIXEL = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    private const LINK = '~(https?://[^\s<>"\']*[^\s<>"\'.,;:!?)\]])~i';

    private const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    public static function links(string $template): array
    {
        preg_match_all(self::LINK, $template, $matches);

        return array_values(array_unique($matches[1]));
    }

    public static function openToken(string $tenantId, string $recipientId): string
    {
        return "{$tenantId}.{$recipientId}.".self::sign("open|{$tenantId}|{$recipientId}");
    }

    public static function clickToken(string $tenantId, string $recipientId, int $index): string
    {
        return "{$tenantId}.{$recipientId}.{$index}.".self::sign("click|{$tenantId}|{$recipientId}|{$index}");
    }

    public static function openUrl(string $tenantId, string $recipientId): string
    {
        return self::base().'/open/'.self::openToken($tenantId, $recipientId);
    }

    public static function clickUrl(string $tenantId, string $recipientId, int $index): string
    {
        return self::base().'/click/'.self::clickToken($tenantId, $recipientId, $index);
    }

    public static function opened(string $token): ?array
    {
        if (preg_match('/^('.self::UUID.')\.('.self::UUID.')\.[0-9a-f]{64}$/', $token, $match) !== 1 || ! Str::isUuid($match[1]) || ! Str::isUuid($match[2])) {
            return null;
        }

        return hash_equals(self::openToken($match[1], $match[2]), $token) ? [$match[1], $match[2]] : null;
    }

    public static function clicked(string $token): ?array
    {
        if (preg_match('/^('.self::UUID.')\.('.self::UUID.')\.(\d{1,4})\.[0-9a-f]{64}$/', $token, $match) !== 1 || ! Str::isUuid($match[1]) || ! Str::isUuid($match[2])) {
            return null;
        }

        return hash_equals(self::clickToken($match[1], $match[2], (int) $match[3]), $token) ? [$match[1], $match[2], (int) $match[3]] : null;
    }

    public static function prepare(string $tenantId, string $recipientId, string $template, string $rendered): array
    {
        $links = self::links($template);
        $parts = preg_split(self::LINK, $rendered, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$rendered];
        $text = '';
        $html = '';

        foreach ($parts as $position => $part) {
            if ($position % 2 === 0) {
                $text .= $part;
                $html .= nl2br(e($part), false);

                continue;
            }

            $index = array_search($part, $links, true);
            $target = $index === false ? $part : self::clickUrl($tenantId, $recipientId, (int) $index);
            $text .= $target;
            $html .= '<a href="'.e($target).'">'.e($part).'</a>';
        }

        $html = '<!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">'
            .$html
            .'<img src="'.e(self::openUrl($tenantId, $recipientId)).'" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"></body></html>';

        return ['text' => $text, 'html' => $html];
    }

    private static function base(): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/public/campaigns';
    }

    private static function sign(string $payload): string
    {
        return hash_hmac('sha256', 'campaign-tracking|'.$payload, (string) config('app.key'));
    }
}
