<?php

declare(strict_types=1);

namespace App\Domain\Landing\Contracts;

use App\Domain\Landing\Fake\FakeRucLookup;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeRucLookup::class)]
interface RucLookup
{
    public function find(string $ruc): ?array;
}
