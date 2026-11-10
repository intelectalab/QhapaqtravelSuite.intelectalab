<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

final readonly class DocumentDraft
{
    public const FOLDER = 'documents';

    public function __construct(
        public string $docType,
        public string $entityType,
        public string $entityId,
        public string $view,
        public string $title,
        public string $fileName,
        public array $data,
    ) {}

    public function fingerprint(): string
    {
        return substr(hash('sha256', (string) json_encode([$this->view, $this->data, self::templates()], JSON_UNESCAPED_UNICODE)), 0, 24);
    }

    public static function templates(): string
    {
        static $hash = null;

        if (is_string($hash)) {
            return $hash;
        }

        $files = [...(glob(resource_path('views/'.self::FOLDER.'/*.blade.php')) ?: []), ...(glob(resource_path('views/'.self::FOLDER.'/partials/*.blade.php')) ?: [])];
        sort($files);

        return $hash = hash('xxh3', implode('|', array_map(fn (string $file): string => (string) hash_file('xxh3', $file), $files)));
    }

    public function html(): string
    {
        return view($this->view, $this->data)->render();
    }
}
