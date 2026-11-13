<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Site\Support\SiteDesign;
use App\Domain\Site\Support\SiteDesignStudio;
use App\Domain\Site\Support\SiteProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

final class SiteDesignController
{
    public function show(Request $request, SiteDesignStudio $studio): JsonResponse
    {
        return response()->json(['data' => $studio->overview($this->user($request))]);
    }

    public function saveDraft(Request $request, SiteDesignStudio $studio): JsonResponse
    {
        $data = $request->validate([...SiteDesign::rules(), 'lock_version' => ['required', 'integer', 'min:0']], SiteDesign::messages());
        $errors = [...SiteDesign::textErrors((array) ($request->input('design.texts') ?? [])), ...SiteDesign::andesErrors((array) ($request->input('design.andes') ?? []))];

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return response()->json(['data' => $studio->saveDraft($data['design'], (int) $data['lock_version'], $this->user($request))]);
    }

    public function publish(Request $request, SiteDesignStudio $studio): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:200']], ['note.max' => 'La nota admite hasta 200 caracteres.']);

        return response()->json(['data' => $studio->publish(isset($data['note']) ? trim((string) $data['note']) ?: null : null, $this->user($request))]);
    }

    public function discard(Request $request, SiteDesignStudio $studio): JsonResponse
    {
        return response()->json(['data' => $studio->discard($this->user($request))]);
    }

    public function restore(Request $request, int $version, SiteDesignStudio $studio): JsonResponse
    {
        return response()->json(['data' => $studio->restore($version, $this->user($request))]);
    }

    public function preview(SiteDesignStudio $studio, SiteProfile $profile): JsonResponse
    {
        return response()->json(['data' => ['subdomain' => $profile->subdomain(), ...$profile->presentation($studio->previewDesign($profile->today()))]]);
    }

    public function upload(Request $request, SiteDesignStudio $studio): JsonResponse
    {
        $request->validate(['file' => ['required', 'file']], ['file.*' => 'Elige una imagen para subir.']);
        $file = $request->file('file');
        assert($file instanceof UploadedFile);

        return response()->json(['data' => $studio->uploadImage($file, $this->user($request))], 201);
    }

    public function destroyImage(string $id, SiteDesignStudio $studio): Response
    {
        $studio->deleteImage($id);

        return response()->noContent();
    }

    public function image(string $id, SiteDesignStudio $studio): Response
    {
        $image = $studio->imageFile($id);
        abort_if($image === null, 404);

        return response((string) Storage::disk((string) $image->storage_disk)->get((string) $image->storage_path), 200, [
            'Content-Type' => $image->mime,
            'Cache-Control' => 'public, max-age=86400, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
