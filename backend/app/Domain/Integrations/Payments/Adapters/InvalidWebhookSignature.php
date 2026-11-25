<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments\Adapters;

use RuntimeException;

final class InvalidWebhookSignature extends RuntimeException {}
