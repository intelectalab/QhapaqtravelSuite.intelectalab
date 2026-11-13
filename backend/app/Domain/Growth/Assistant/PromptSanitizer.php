<?php

declare(strict_types=1);

namespace App\Domain\Growth\Assistant;

final class PromptSanitizer
{
    private const PATTERNS = [
        '/\b(?:\d[ -]?){13,19}\b/u' => '[tarjeta omitida]',
        '/\b(contrase(?:ñ|n)a|password|clave|pin)\s*[:=]?\s*\S+/iu' => '$1 [omitida]',
        '/\b(dni|c\.?e\.?|carn[eé] de extranjer[ií]a|pasaporte|ruc|documento)\s*(?:n[°ºo.]*\s*)?[:#]?\s*[A-Z0-9-]{6,15}\b/iu' => '$1 [omitido]',
        '/\b\d{8}\b/u' => '[documento omitido]',
        '/\b(cvv|cvc)\s*[:=]?\s*\d{3,4}\b/iu' => '$1 [omitido]',
    ];

    public function clean(string $prompt): string
    {
        $clean = $prompt;

        foreach (self::PATTERNS as $pattern => $replacement) {
            $clean = preg_replace($pattern, $replacement, $clean) ?? $clean;
        }

        return trim($clean);
    }

    public function changed(string $prompt): bool
    {
        return $this->clean($prompt) !== trim($prompt);
    }
}
