<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\AuditDirectory;
use App\Domain\Admin\Support\Branding;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use stdClass;

final class SiteDesignStudio
{
    public const AUDIT = 'Sitio web';

    public const IMAGE_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

    public function __construct(
        private readonly TenantContext $context,
        private readonly Branding $branding,
        private readonly AuditLogger $audit,
        private readonly AuditDirectory $history,
        private readonly AttachmentGuard $guard,
    ) {}

    public function overview(User $viewer): array
    {
        $row = $this->row();
        $draft = $this->draftOf($row);
        $published = $row?->published !== null ? SiteDesign::fill($this->decode($row->published)) : null;
        $tenant = $this->context->tenant();

        return [
            'draft' => $draft,
            'published' => $published,
            'pending' => SiteDesign::areas($published ?? $this->initial(), $draft),
            'lock_version' => (int) ($row->lock_version ?? 0),
            'published_version' => (int) ($row->published_version ?? 0),
            'published_at' => $row?->published_at ? Carbon::parse($row->published_at)->toIso8601String() : null,
            'draft_updated_at' => $row?->draft_updated_at ? Carbon::parse($row->draft_updated_at)->toIso8601String() : null,
            'panel_colors' => array_intersect_key($this->branding->current(), array_flip(['brand', 'accent', 'menu'])),
            'site' => ['subdomain' => $tenant->subdomain, 'name' => $tenant->commercial_name],
            'images' => $this->imageList(),
            'versions' => $this->versions(),
            'catalog' => SiteDesign::catalog(),
            'history' => $this->history->recent([self::AUDIT], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }

    public function saveDraft(array $design, int $expected, User $user): array
    {
        return DB::transaction(function () use ($design, $expected, $user): array {
            $row = $this->lockedRow();
            $current = (int) ($row->lock_version ?? 0);

            if ($row !== null && $current !== $expected) {
                throw ApiException::conflict('SITE-BR-01', 'Otra persona cambió el diseño mientras editabas. Recarga para ver su versión.', ['lock_version' => $current]);
            }

            $normalized = SiteDesign::normalize($design);
            $this->ensureImages($normalized);
            $values = ['draft' => json_encode($normalized, JSON_UNESCAPED_UNICODE), 'draft_updated_at' => now()->utc(), 'draft_updated_by' => $user->getKey()];

            if ($row === null) {
                DB::table('site_designs')->insert([...$values, 'lock_version' => 1]);
            } else {
                DB::table('site_designs')->where('id', $row->id)->update($values);
            }

            $saved = $this->row();
            $published = $saved->published !== null ? SiteDesign::fill($this->decode($saved->published)) : $this->initial();

            return ['lock_version' => (int) $saved->lock_version, 'draft_updated_at' => Carbon::parse($saved->draft_updated_at)->toIso8601String(), 'pending' => SiteDesign::areas($published, $normalized)];
        });
    }

    public function publish(?string $note, User $user): array
    {
        return DB::transaction(function () use ($note, $user): array {
            $row = $this->lockedRow();
            $draft = $this->draftOf($row);
            $before = $row?->published !== null ? SiteDesign::fill($this->decode($row->published)) : $this->initial();
            $areas = SiteDesign::areas($before, $draft);

            if ($row !== null && $row->published !== null && $areas === []) {
                throw ApiException::unprocessable('SITE-BR-02', 'El sitio ya muestra estos cambios: no hay nada nuevo que publicar.');
            }

            $version = (int) ($row->published_version ?? 0) + 1;
            $json = json_encode($draft, JSON_UNESCAPED_UNICODE);
            $values = ['draft' => $json, 'published' => $json, 'published_version' => $version, 'published_at' => now()->utc(), 'published_by' => $user->getKey()];

            if ($row === null) {
                DB::table('site_designs')->insert([...$values, 'lock_version' => 1]);
            } else {
                DB::table('site_designs')->where('id', $row->id)->update($values);
            }

            DB::table('site_design_versions')->insert(['version' => $version, 'design' => $json, 'note' => $note, 'published_by' => $user->getKey(), 'published_by_name' => $user->name]);
            $this->audit->log(self::AUDIT, "v{$version}", 'publicar', implode(', ', $areas) ?: null, $note);

            return ['version' => $version, 'areas' => $areas, 'lock_version' => (int) $this->row()->lock_version];
        });
    }

    public function discard(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $row = $this->lockedRow();
            $published = $row?->published !== null ? SiteDesign::fill($this->decode($row->published)) : null;
            $base = $published ?? $this->initial();

            if ($row === null || SiteDesign::areas($base, $this->draftOf($row)) === []) {
                throw ApiException::unprocessable('SITE-BR-03', 'El borrador no tiene cambios sin publicar.');
            }

            DB::table('site_designs')->where('id', $row->id)->update(['draft' => json_encode($base, JSON_UNESCAPED_UNICODE), 'draft_updated_at' => now()->utc(), 'draft_updated_by' => $user->getKey()]);
            $this->audit->log(self::AUDIT, 'borrador', 'descartar', implode(', ', SiteDesign::areas($base, $this->draftOf($row))), null);

            return ['lock_version' => (int) $this->row()->lock_version];
        });
    }

    public function restore(int $version, User $user): array
    {
        return DB::transaction(function () use ($version, $user): array {
            $stored = DB::table('site_design_versions')->where('version', $version)->value('design');

            if ($stored === null) {
                throw ApiException::notFound('Esa versión del sitio no existe.');
            }

            $design = SiteDesign::fill($this->decode($stored));
            $design['hero']['image_id'] = $this->liveImage($design['hero']['image_id']);
            $design['promos'] = array_map(fn (array $promo): array => [...$promo, 'image_id' => $this->liveImage($promo['image_id'])], $design['promos']);
            $row = $this->lockedRow();
            $values = ['draft' => json_encode($design, JSON_UNESCAPED_UNICODE), 'draft_updated_at' => now()->utc(), 'draft_updated_by' => $user->getKey()];

            if ($row === null) {
                DB::table('site_designs')->insert([...$values, 'lock_version' => 1]);
            } else {
                DB::table('site_designs')->where('id', $row->id)->update($values);
            }

            $this->audit->log(self::AUDIT, "v{$version}", 'restaurar', null, 'Copiada al borrador');

            return ['lock_version' => (int) $this->row()->lock_version, 'draft' => $design];
        });
    }

    public function uploadImage(UploadedFile $file, User $user): array
    {
        $mime = (string) $file->getMimeType();

        if (! isset(self::IMAGE_MIME[$mime])) {
            throw ApiException::unprocessable('SITE-BR-04', 'Sube una imagen JPG, PNG o WebP.');
        }

        if ($file->getSize() > self::IMAGE_MAX_BYTES) {
            throw ApiException::unprocessable('SITE-BR-04', 'La imagen pesa más de 4 MB. Redúcela y vuelve a intentarlo.');
        }

        $id = (string) Str::uuid7();
        $name = Str::limit($file->getClientOriginalName() ?: 'imagen.'.self::IMAGE_MIME[$mime], 190, '');
        $this->guard->ensureCleanFile((string) $file->getRealPath(), $name, self::AUDIT, $id);
        $size = @getimagesize((string) $file->getRealPath()) ?: [null, null];
        $disk = (string) config('filesystems.default');
        $path = "tenants/{$this->context->id()}/site/{$id}.".self::IMAGE_MIME[$mime];

        if (! Storage::disk($disk)->put($path, (string) file_get_contents((string) $file->getRealPath()))) {
            throw ApiException::unprocessable('SITE-BR-04', 'No pudimos guardar la imagen. Inténtalo de nuevo.');
        }

        DB::table('site_design_images')->insert(['id' => $id, 'file_name' => $name, 'mime' => $mime, 'size_bytes' => (int) $file->getSize(), 'width' => $size[0], 'height' => $size[1], 'storage_disk' => $disk, 'storage_path' => $path, 'uploaded_by' => $user->getKey()]);
        $this->audit->log(self::AUDIT, $id, 'subir imagen', null, $name);

        return $this->image(DB::table('site_design_images')->where('id', $id)->first());
    }

    public function deleteImage(string $id): void
    {
        $image = DB::table('site_design_images')->where('id', $id)->whereNull('deleted_at')->first();

        if ($image === null) {
            throw ApiException::notFound('La imagen no existe.');
        }

        $row = $this->row();
        $inUse = array_merge(SiteDesign::images($this->draftOf($row)), $row?->published !== null ? SiteDesign::images(SiteDesign::fill($this->decode($row->published))) : []);

        if (in_array($id, $inUse, true)) {
            throw ApiException::unprocessable('SITE-BR-05', 'La imagen se usa en el borrador o en el sitio publicado. Quítala de la portada o del banner antes de borrarla.');
        }

        DB::table('site_design_images')->where('id', $id)->update(['deleted_at' => now()->utc()]);
        $this->audit->log(self::AUDIT, $id, 'borrar imagen', $image->file_name, null);
    }

    public function publicDesign(Carbon $today): array
    {
        $row = $this->row();

        return SiteDesign::forVisitors($row?->published !== null ? SiteDesign::fill($this->decode($row->published)) : $this->initial(), $today);
    }

    public function previewDesign(Carbon $today): array
    {
        return SiteDesign::forVisitors($this->draftOf($this->row()), $today);
    }

    public function imageFile(string $id): ?stdClass
    {
        $image = DB::table('site_design_images')->where('id', $id)->first();

        return $image !== null && Storage::disk((string) $image->storage_disk)->exists((string) $image->storage_path) ? $image : null;
    }

    private function initial(): array
    {
        $design = SiteDesign::defaults();
        $design['theme'] = [...$design['theme'], ...array_intersect_key($this->branding->current(), array_flip(['brand', 'accent', 'menu']))];

        return SiteDesign::normalize($design);
    }

    private function draftOf(?stdClass $row): array
    {
        $stored = $row !== null ? $this->decode($row->draft) : [];

        return $stored === [] ? $this->initial() : SiteDesign::fill($stored);
    }

    private function ensureImages(array $design): void
    {
        $ids = SiteDesign::images($design);

        if ($ids === []) {
            return;
        }

        $found = DB::table('site_design_images')->whereIn('id', $ids)->whereNull('deleted_at')->count();

        if ($found !== count($ids)) {
            throw ApiException::unprocessable('SITE-BR-06', 'Una de las imágenes elegidas ya no existe. Elige otra.');
        }
    }

    private function liveImage(?string $id): ?string
    {
        return $id !== null && DB::table('site_design_images')->where('id', $id)->whereNull('deleted_at')->exists() ? $id : null;
    }

    private function imageList(): array
    {
        return DB::table('site_design_images')->whereNull('deleted_at')->orderByDesc('created_at')->limit(60)->get()->map($this->image(...))->all();
    }

    private function image(stdClass $image): array
    {
        return ['id' => $image->id, 'name' => $image->file_name, 'mime' => $image->mime, 'size' => (int) $image->size_bytes, 'width' => $image->width !== null ? (int) $image->width : null, 'height' => $image->height !== null ? (int) $image->height : null, 'uploaded_at' => Carbon::parse($image->created_at)->toIso8601String()];
    }

    private function versions(): array
    {
        return DB::table('site_design_versions')->orderByDesc('version')->limit(20)->get(['version', 'note', 'published_by_name', 'created_at'])
            ->map(fn (stdClass $version): array => ['version' => (int) $version->version, 'note' => $version->note, 'by' => $version->published_by_name, 'at' => Carbon::parse($version->created_at)->toIso8601String()])->all();
    }

    private function row(): ?stdClass
    {
        return DB::table('site_designs')->first();
    }

    private function lockedRow(): ?stdClass
    {
        return DB::table('site_designs')->lockForUpdate()->first();
    }

    private function decode(mixed $value): array
    {
        return is_string($value) ? (json_decode($value, true) ?: []) : (array) $value;
    }
}
