<?php

declare(strict_types=1);

namespace App\Domain\Finance\Http\Controllers\Concerns;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\Request;

trait ResolvesActor
{
    private function actor(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }

    private function requireOperator(User $user): void
    {
        if (! $user->can('finance.payments.register')) {
            throw ApiException::forbidden('FIN-BR-59', 'Esta acción la registra el perfil operativo de tesorería.', ['finance.payments.register']);
        }
    }
}
