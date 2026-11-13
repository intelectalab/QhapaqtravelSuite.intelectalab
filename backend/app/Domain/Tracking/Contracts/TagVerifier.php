<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Tracking\Fake\FakeTagVerifier;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeTagVerifier::class)]
interface TagVerifier
{
    public function verify(object $tag, string $url): AdapterResult;
}
