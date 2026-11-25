<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\PaymentMethods;
use App\Domain\Finance\Support\TreasuryRouting;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaymentMethodCatalog
{
    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly TreasuryRouting $routing) {}

    public function list(User $viewer): array
    {
        $uses = DB::table('fin_payments')->groupBy('method')->selectRaw('method, count(*) as total')->pluck('total', 'method');
        $routes = collect($this->routing->rules())->keyBy('method');

        $rows = DB::table('fin_payment_methods')->orderByDesc('active')->orderBy('label')->get(['code', 'label', 'requires_reference', 'is_b2b_credit', 'active', 'updated_at'])
            ->map(function (object $row) use ($uses, $routes): array {
                $route = $routes->get($row->code);

                return [
                    'code' => (string) $row->code,
                    'label' => (string) $row->label,
                    'requires_reference' => (bool) $row->requires_reference,
                    'b2b' => (bool) $row->is_b2b_credit,
                    'active' => (bool) $row->active,
                    'uses' => (int) ($uses[$row->code] ?? 0),
                    'accounts' => $route['accounts'] ?? ['PEN' => null, 'USD' => null],
                    'destination' => $route['destination'] ?? null,
                    'bank' => $route['bank'] ?? null,
                    'updated_at' => $row->updated_at,
                ];
            })->values()->all();

        return ['rows' => $rows, 'can' => ['manage' => $viewer->can('admin.settings.manage')]];
    }

    public function create(array $data, User $actor): string
    {
        $label = $this->cleanLabel((string) $data['label']);
        $code = PaymentMethods::code($label);

        if ($code === '' || DB::table('fin_payment_methods')->where('code', $code)->exists() || $this->labelTaken($label, null)) {
            throw ApiException::conflict('FIN-PM-01', "Ya existe un medio de cobro llamado «{$label}».");
        }

        DB::table('fin_payment_methods')->insert([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'code' => $code,
            'label' => $label,
            'requires_reference' => (bool) ($data['requires_reference'] ?? true),
            'is_b2b_credit' => false,
            'active' => true,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->audit->log('Medio de cobro', $code, 'crear', null, $label);

        return $code;
    }

    public function update(string $code, array $data, User $actor): string
    {
        $method = $this->find($code);
        $values = [];

        if (array_key_exists('label', $data)) {
            $label = $this->cleanLabel((string) $data['label']);
            if ($this->labelTaken($label, $code)) {
                throw ApiException::conflict('FIN-PM-01', "Ya existe un medio de cobro llamado «{$label}».");
            }
            $values['label'] = $label;
        }

        if (array_key_exists('requires_reference', $data)) {
            $values['requires_reference'] = (bool) $data['requires_reference'];
        }

        if (array_key_exists('active', $data)) {
            if ($method->is_b2b_credit && ! $data['active']) {
                throw ApiException::conflict('FIN-PM-02', 'El crédito B2B no se desactiva: lo usan los convenios con agencias aliadas.');
            }
            if (! $data['active'] && DB::table('fin_payment_methods')->where('active', true)->where('is_b2b_credit', false)->where('code', '<>', $code)->doesntExist()) {
                throw ApiException::conflict('FIN-PM-03', 'Debe quedar al menos un medio de cobro activo.');
            }
            $values['active'] = (bool) $data['active'];
        }

        if ($values === []) {
            return $code;
        }

        DB::table('fin_payment_methods')->where('code', $code)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $before = ['label' => (string) $method->label, 'requires_reference' => (bool) $method->requires_reference, 'active' => (bool) $method->active];
        $this->audit->log('Medio de cobro', $code, 'editar', (string) $method->label, (string) ($values['label'] ?? $method->label), ['before' => array_intersect_key($before, $values), 'after' => $values]);

        return $code;
    }

    public function delete(string $code): void
    {
        $method = $this->find($code);

        if ($method->is_b2b_credit) {
            throw ApiException::conflict('FIN-PM-02', 'El crédito B2B no se elimina: lo usan los convenios con agencias aliadas.');
        }

        $uses = DB::table('fin_payments')->where('method', $code)->count();
        if ($uses > 0) {
            throw ApiException::conflict('FIN-PM-04', "Este medio ya tiene {$uses} ".($uses === 1 ? 'pago registrado' : 'pagos registrados').'. Desactívalo en lugar de eliminarlo.');
        }

        if ($method->active && DB::table('fin_payment_methods')->where('active', true)->where('is_b2b_credit', false)->where('code', '<>', $code)->doesntExist()) {
            throw ApiException::conflict('FIN-PM-03', 'Debe quedar al menos un medio de cobro activo.');
        }

        DB::table('fin_payment_methods')->where('code', $code)->delete();
        $this->audit->log('Medio de cobro', $code, 'eliminar', (string) $method->label);
    }

    private function find(string $code): object
    {
        return DB::table('fin_payment_methods')->where('code', $code)->first(['code', 'label', 'requires_reference', 'is_b2b_credit', 'active'])
            ?? throw ApiException::notFound('El medio de cobro no existe.');
    }

    private function cleanLabel(string $label): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $label));
    }

    private function labelTaken(string $label, ?string $except): bool
    {
        return DB::table('fin_payment_methods')->whereRaw('lower(label) = ?', [mb_strtolower($label)])->when($except, fn ($query) => $query->where('code', '<>', $except))->exists();
    }
}
