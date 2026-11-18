<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageAgencyMail;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Mail\AgencyMailbox;
use App\Domain\Integrations\Support\AgencyIntegrations;
use App\Domain\Integrations\Support\IntegrationReadiness;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AgencyIntegrationsController
{
    public function readiness(Request $request, AgencyIntegrations $integrations): JsonResponse
    {
        $items = $integrations->items();

        return response()->json(['data' => [
            'enforced' => IntegrationReadiness::enforced(),
            'items' => $items,
            'pending' => count(array_filter($items, fn (array $item): bool => $item['status'] !== 'conectado')),
            'features' => IntegrationReadiness::features(),
            'can_manage' => $this->user($request)->can('admin.settings.manage'),
        ]]);
    }

    public function mail(AgencyMailbox $mailbox): JsonResponse
    {
        return response()->json(['data' => $mailbox->summary()]);
    }

    public function connectMail(Request $request, ManageAgencyMail $mail): JsonResponse
    {
        return response()->json(['data' => $mail->connect($request->all(), $this->user($request))]);
    }

    public function disconnectMail(Request $request, ManageAgencyMail $mail): JsonResponse
    {
        return response()->json(['data' => $mail->disconnect($this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
