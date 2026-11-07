<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Policies;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Models\Quote;
use App\Domain\Shared\Errors\ApiException;

final class QuotePolicy
{
    public function view(User $user, Quote $quote): bool
    {
        $this->assertInPortfolio($user, $quote);

        return true;
    }

    public function convert(User $user, Quote $quote): bool
    {
        $this->assertInPortfolio($user, $quote);

        return true;
    }

    private function assertInPortfolio(User $user, Quote $quote): void
    {
        if (Portfolio::ownOnly($user) && (string) $quote->owner_id !== (string) $user->getKey()) {
            throw ApiException::forbidden(
                'SEC-BR-09',
                'Esta cotización pertenece a la cartera de otro asesor. Si necesitas trabajarla, pide a tu gerente que te la reasigne.',
            );
        }
    }
}
