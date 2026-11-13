<?php

declare(strict_types=1);

namespace App\Domain\SiteTemplates\Http\Controllers;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\SiteTemplates\Actions\TemplateAdmin;
use App\Domain\SiteTemplates\Support\TemplateCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlatformTemplateController
{
    public function index(TemplateAdmin $admin): JsonResponse
    {
        return response()->json(['data' => $admin->overview()]);
    }

    public function store(Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/'],
            ...$this->rules(true),
            'author_kind' => ['required', Rule::in(['equipo', 'partner'])],
            'author_name' => ['required', 'string', 'max:120'],
            'repo_url' => ['nullable', 'url:https', 'max:300'],
        ], $this->messages());

        return response()->json(['data' => $admin->create($data, $this->user($request))], 201);
    }

    public function update(string $code, Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            ...$this->rules(false),
            'status' => ['sometimes', Rule::in(['publicado', 'retirado'])],
            'is_default' => ['sometimes', 'boolean'],
        ], $this->messages());

        return response()->json(['data' => $admin->update($code, $data, $this->user($request))]);
    }

    public function submissions(TemplateAdmin $admin): JsonResponse
    {
        $items = $admin->submissions();

        return response()->json(['data' => $items, 'meta' => ['total' => count($items), 'pending' => count(array_filter($items, fn (array $item): bool => in_array($item['status'], ['recibida', 'validando'], true)))]]);
    }

    public function submit(Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            'template_code' => ['required', 'string', 'max:20'],
            'version' => ['required', 'string', 'regex:/^[0-9]+\.[0-9]+\.[0-9]+$/'],
            'bundle_path' => ['required', 'string', 'max:300', 'regex:/\.tgz$/'],
            'bundle_sha256' => ['required', 'string', 'regex:/^[0-9a-fA-F]{64}$/'],
            'changelog' => ['nullable', 'string', 'max:4000'],
            'manifest' => ['required', 'array'],
            'manifest.sections' => ['required', 'array', 'min:1'],
            'manifest.tokens' => ['required', 'array'],
            'lighthouse' => ['nullable', 'array'],
            'lighthouse.performance' => ['nullable', 'integer', 'between:0,100'],
            'lighthouse.accessibility' => ['nullable', 'integer', 'between:0,100'],
            'lighthouse.seo' => ['nullable', 'integer', 'between:0,100'],
            'lighthouse.best_practices' => ['nullable', 'integer', 'between:0,100'],
            'checks' => ['nullable', 'array'],
            'checks.*' => ['nullable', Rule::in(['ok', 'falla', 'pendiente'])],
        ], [
            'template_code.required' => 'Indique la plantilla.',
            'version.regex' => 'La versión debe tener el formato semver 1.2.3.',
            'bundle_path.regex' => 'El paquete debe ser un archivo .tgz generado con kipu-tpl submit.',
            'bundle_sha256.regex' => 'El SHA-256 debe tener 64 caracteres hexadecimales.',
            'manifest.required' => 'Adjunte el manifiesto template.json.',
            'manifest.sections.required' => 'El manifiesto debe declarar sus secciones.',
            'manifest.tokens.required' => 'El manifiesto debe declarar sus tokens.',
        ]);

        return response()->json(['data' => $admin->submit([...$data, 'manifest' => (array) $request->input('manifest')], $this->user($request))], 201);
    }

    public function decide(string $code, Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['aprobar', 'rechazar'])],
            'reason' => ['nullable', 'string', 'max:1000', 'required_if:decision,rechazar', 'min:10'],
            'visual_review' => ['nullable', 'boolean'],
        ], [
            'decision.required' => 'Indique si aprueba o rechaza el envío.',
            'reason.required_if' => 'Explique el motivo del rechazo.',
            'reason.min' => 'Explique el motivo con al menos 10 caracteres.',
        ]);

        return response()->json(['data' => $admin->decide($code, $data, $this->user($request))]);
    }

    public function assign(string $id, Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            'template_code' => ['required', 'string', 'max:20'],
            'version' => ['nullable', 'string', 'regex:/^[0-9]+\.[0-9]+\.[0-9]+$/'],
            'note' => ['nullable', 'string', 'max:200'],
        ], ['template_code.required' => 'Elija la plantilla que quiere asignar.', 'note.max' => 'La nota admite hasta 200 caracteres.']);

        return response()->json(['data' => $admin->assign($id, $data, $this->user($request))]);
    }

    public function packs(TemplateAdmin $admin): JsonResponse
    {
        return response()->json(['data' => $admin->packs()]);
    }

    public function updatePack(string $code, Request $request, TemplateAdmin $admin): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0', 'max:99999'],
            'credits' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
            'active' => ['sometimes', 'boolean'],
        ], ['price.min' => 'El precio no puede ser negativo.', 'credits.min' => 'El paquete debe tener al menos un crédito.']);

        return response()->json(['data' => $admin->updatePack($code, $data, $this->user($request))]);
    }

    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:80'],
            'description' => [$required, 'string', 'max:600'],
            'category' => [$required, Rule::in(array_keys(TemplateCatalog::CATEGORIES))],
            'tier' => [$required, Rule::in(array_keys(TemplateCatalog::TIERS))],
            'price_once' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'min_plan_code' => ['nullable', 'string', Rule::exists('pgsql_platform.plans', 'code')],
            'tags' => ['nullable', 'array', 'max:8'],
            'tags.*' => ['string', 'max:30'],
        ];
    }

    private function messages(): array
    {
        return [
            'slug.regex' => 'El identificador usa minúsculas, números y guiones (por ejemplo, inti-raymi).',
            'name.required' => 'Escriba el nombre de la plantilla.',
            'description.required' => 'Escriba una descripción breve.',
            'category.in' => 'Ese tipo de plantilla no existe.',
            'tier.in' => 'Elija incluida o premium.',
            'min_plan_code.exists' => 'Ese plan no existe.',
            'repo_url.url' => 'El repositorio debe ser un enlace https://.',
        ];
    }

    private function user(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.', ['admin.tenant.manage']);
        }

        return $user;
    }
}
