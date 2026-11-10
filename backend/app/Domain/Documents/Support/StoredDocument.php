<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

final readonly class StoredDocument
{
    public function __construct(
        public string $id,
        public string $disk,
        public string $path,
        public string $fileName,
        public int $size,
        public string $sha256,
        public int $version,
        public string $createdAt,
        public bool $fresh,
    ) {}

    public static function fromRow(object $row, bool $fresh): self
    {
        return new self((string) $row->id, (string) $row->storage_disk, (string) $row->storage_path, (string) $row->file_name, (int) $row->size_bytes, (string) $row->sha256, (int) $row->version, (string) $row->created_at, $fresh);
    }
}
