<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use stdClass;

final class ReviewRequestSender
{
    public function __construct(private readonly MessagingChannel $messaging, private readonly TenantContext $context) {}

    public function send(stdClass $request, bool $reminder = false): bool
    {
        $settings = OwnReviewSettings::read()['invite'];
        $tenant = $this->context->tenant();
        $reservation = DB::table('booking_reservations')->where('id', $request->reservation_id)->first(['title']);
        $client = DB::table('crm_clients')->where('id', $request->client_id)->first(['name']);
        $name = trim(explode(' ', trim((string) ($client->name ?? '')))[0]);
        $link = ReviewLinks::url((string) $tenant->subdomain, (string) $tenant->getKey(), (string) $request->code);
        $values = ['{nombre}' => $name !== '' ? $name : 'viajero', '{tour}' => (string) ($reservation->title ?? 'tu viaje'), '{agencia}' => (string) $tenant->commercial_name, '{enlace}' => $link];
        $body = strtr((string) $settings['body'], $values);
        $body = str_contains((string) $settings['body'], '{enlace}') ? $body : $body."\n\n".$link;
        $subject = strtr((string) $settings['subject'], $values);

        $result = $this->messaging->send(new OutboundMessage((string) $request->channel, (string) $request->to_address, $reminder ? "Recordatorio: {$subject}" : $subject, $body, null, ['link' => $link], (string) ($request->lang ?? 'es')));

        return $result->ok;
    }
}
