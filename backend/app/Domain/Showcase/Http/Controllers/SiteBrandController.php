<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Showcase\Actions\ManageSiteBrand;
use App\Domain\Showcase\Support\BrandDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class SiteBrandController
{
    public function domains(BrandDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->domains()]);
    }

    public function storeDomain(Request $request, ManageSiteBrand $brand): JsonResponse
    {
        $request->merge(['host' => mb_strtolower(trim((string) $request->input('host')))]);
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253', 'regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/'],
            'purpose' => ['nullable', 'in:'.implode(',', ManageSiteBrand::PURPOSES)],
        ], ['host.*' => 'Escribe un dominio válido, por ejemplo tours.miagencia.pe.', 'purpose.*' => 'Elige el uso del dominio.']);

        return response()->json(['data' => $brand->addDomain($data, $this->user($request))]);
    }

    public function verifyDomain(string $id, ManageSiteBrand $brand): JsonResponse
    {
        return response()->json(['data' => $brand->verify($id)]);
    }

    public function retireDomain(string $id, ManageSiteBrand $brand): Response
    {
        $brand->retire($id);

        return response()->noContent();
    }

    public function pages(BrandDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->pages()]);
    }

    public function updatePage(Request $request, string $id, ManageSiteBrand $brand): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'min:5', 'max:120'],
            'meta_description' => ['nullable', 'string', 'max:320'],
            'focus_keyword' => ['nullable', 'string', 'max:120'],
            'schema_types' => ['nullable', 'array', 'max:6'],
            'schema_types.*' => ['string', 'max:40'],
            'canonical_url' => ['nullable', 'string', 'max:400'],
            'indexable' => ['nullable', 'boolean'],
        ], ['title.*' => 'El título va de 5 a 120 caracteres.', 'meta_description.*' => 'La descripción admite hasta 320 caracteres.']);

        return response()->json(['data' => $brand->updatePage($id, $data)]);
    }

    public function audit(ManageSiteBrand $brand): JsonResponse
    {
        return response()->json(['data' => $brand->audit()]);
    }

    public function redirects(BrandDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->redirects()]);
    }

    public function storeRedirect(Request $request, ManageSiteBrand $brand): JsonResponse
    {
        $data = $request->validate([
            'from_path' => ['required', 'string', 'max:300', 'regex:/^\/\S*$/'],
            'to_path' => ['required', 'string', 'max:400'],
            'code' => ['nullable', 'in:301,302'],
        ], ['from_path.*' => 'La ruta de origen empieza con / y no tiene espacios.', 'to_path.*' => 'Indica la ruta o la URL de destino.', 'code.*' => 'Elige 301 (permanente) o 302 (temporal).']);

        return response()->json(['data' => $brand->addRedirect($data, $this->user($request))]);
    }

    public function deleteRedirect(string $id, ManageSiteBrand $brand): Response
    {
        $brand->deactivateRedirect($id);

        return response()->noContent();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
