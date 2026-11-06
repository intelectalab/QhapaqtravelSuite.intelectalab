<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\DestinationDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class DestinationRegistry
{
    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function create(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $parent = $this->parent($data);
            $this->guard($data, $parent, null);
            $ref = $this->codes->next('catalog_destinations', 'D', 2, 'ref');
            DB::table('catalog_destinations')->insert([
                ...$this->values($data),
                'ref' => $ref,
                'parent_id' => $parent?->id,
                'level' => $parent ? min(6, (int) $parent->level + 1) : 0,
                'path' => $parent ? "{$parent->path} / ".trim($data['name']) : trim($data['name']),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Destino', $ref, 'crear', after: $parent ? "{$parent->path} / {$data['name']}" : $data['name']);

            return $ref;
        });
    }

    public function update(string $ref, array $data, User $actor): string
    {
        return DB::transaction(function () use ($ref, $data, $actor): string {
            $node = $this->node($ref);
            $parent = $this->parent($data);

            if ($parent && ($parent->id === $node->id || str_starts_with($parent->path, "{$node->path} / "))) {
                throw ApiException::unprocessable('PROC-011', 'Referencia circular: el nuevo padre está dentro de este destino.');
            }

            $this->guard($data, $parent, $node);
            $path = $parent ? "{$parent->path} / ".trim($data['name']) : trim($data['name']);
            $level = $parent ? min(6, (int) $parent->level + 1) : 0;
            DB::table('catalog_destinations')->where('id', $node->id)->update([...$this->values($data), 'parent_id' => $parent?->id, 'level' => $level, 'path' => $path, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->reindex($node->id, $path, $level);
            $this->audit->log('Destino', $ref, 'modificar', "{$node->path} · {$node->type}", "{$path} · {$data['type']}");

            return $ref;
        });
    }

    public function delete(string $ref, string $reason, User $actor): void
    {
        DB::transaction(function () use ($ref, $reason, $actor): void {
            $node = $this->node($ref);

            if (DB::table('catalog_destinations')->where('parent_id', $node->id)->whereNull('deleted_at')->exists()) {
                throw ApiException::conflict('CAT-BR-39', 'Tiene subdestinos: muévelos o elimínalos primero.');
            }

            $products = DB::table('catalog_products')->whereNull('deleted_at')->where(fn ($query) => $query->where('primary_destination_id', $node->id)
                ->orWhereIn('id', DB::table('catalog_product_destinations')->where('destination_id', $node->id)->select('product_id')))->count();

            if ($products > 0) {
                throw ApiException::conflict('CAT-BR-39', "Lo usan {$products} productos: cámbiales el destino antes de eliminarlo.");
            }

            DB::table('catalog_destinations')->where('id', $node->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Destino', $ref, 'eliminar', $node->path, $reason);
        });
    }

    private function node(string $ref): object
    {
        return DB::table('catalog_destinations')->where('ref', $ref)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound('El destino no existe.');
    }

    private function parent(array $data): ?object
    {
        if (blank($data['parent_id'] ?? null)) {
            return null;
        }

        return DB::table('catalog_destinations')->where('id', $data['parent_id'])->whereNull('deleted_at')->first() ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El destino padre no existe.');
    }

    private function guard(array $data, ?object $parent, ?object $node): void
    {
        $rank = DestinationDirectory::RANKS[$data['type']];

        if ($parent === null && $data['type'] !== 'País') {
            throw ApiException::unprocessable('CAT-BR-39', 'Solo un país puede ir sin destino padre.');
        }

        if ($parent && $data['type'] === 'País') {
            throw ApiException::unprocessable('CAT-BR-39', 'Un país no puede depender de otro destino.');
        }

        if ($parent && $rank <= DestinationDirectory::RANKS[$parent->type]) {
            throw ApiException::unprocessable('PROC-011', "Jerarquía inválida: un destino de tipo {$data['type']} no puede ir dentro de {$parent->type}.");
        }

        if ($node) {
            $childTypes = DB::table('catalog_destinations')->where('parent_id', $node->id)->whereNull('deleted_at')->pluck('type');

            if ($childTypes->contains(fn (string $type) => DestinationDirectory::RANKS[$type] <= $rank)) {
                throw ApiException::unprocessable('CAT-BR-39', "Con el tipo {$data['type']}, algunos subdestinos quedarían al mismo nivel o por encima.");
            }
        }

        $sibling = DB::table('catalog_destinations')->whereNull('deleted_at')->whereRaw('lower(name) = lower(?)', [trim($data['name'])])
            ->when($parent, fn ($query) => $query->where('parent_id', $parent->id), fn ($query) => $query->whereNull('parent_id'))
            ->when($node, fn ($query) => $query->where('id', '<>', $node->id))->exists();

        if ($sibling) {
            throw ApiException::unprocessable('CAT-BR-39', 'Ya existe un destino con ese nombre en el mismo nivel.');
        }
    }

    private function reindex(string $parentId, string $path, int $level): void
    {
        foreach (DB::table('catalog_destinations')->where('parent_id', $parentId)->whereNull('deleted_at')->get(['id', 'name']) as $child) {
            $childPath = "{$path} / {$child->name}";
            $childLevel = min(6, $level + 1);
            DB::table('catalog_destinations')->where('id', $child->id)->update(['path' => $childPath, 'level' => $childLevel]);
            $this->reindex($child->id, $childPath, $childLevel);
        }
    }

    private function values(array $data): array
    {
        return [
            'name' => trim($data['name']),
            'type' => $data['type'],
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'description' => $data['description'] ?? null,
        ];
    }
}
