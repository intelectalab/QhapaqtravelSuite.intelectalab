<?php

use App\Domain\Shared\Time\BusinessHours;
use App\Domain\Shared\Time\BusinessSchedule;
use App\Domain\Site\Actions\WebChat;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Middleware\ThrottleRequests;

function t16opsChat(array $headers): array
{
    return test()->postJson('/api/v1/public/chat/sessions', ['name' => 'Emma Clark', 'email' => 'emma.chat@travel.com', 'message' => 'Do you have spots for Machu Picchu in December?', 'consent' => true], siteOf(extra: $headers))->assertCreated()->json('data');
}

it('duda 11: el chat del sitio responde en el idioma de X-Site-Locale y los mensajes del cliente no se traducen', function () {
    $this->withoutMiddleware(ThrottleRequests::class);

    $english = t16opsChat(['X-Site-Locale' => 'en']);
    $system = collect($english['messages'])->firstWhere('from', 'sistema')['body'];
    expect($system)->toStartWith('Hi, thanks for reaching out.')->not->toContain('gracias')
        ->and(collect($english['messages'])->firstWhere('from', 'contacto')['body'])->toBe('Do you have spots for Machu Picchu in December?');

    $spanish = t16opsChat([]);
    expect(collect($spanish['messages'])->firstWhere('from', 'sistema')['body'])->toStartWith('Hola, gracias por escribirnos.');

    $other = t16opsChat(['X-Site-Locale' => 'fr']);
    expect(collect($other['messages'])->firstWhere('from', 'sistema')['body'])->toStartWith('Hola, gracias por escribirnos.');
});

it('duda 11: fuera de horario la respuesta en inglés trae el horario y la próxima apertura en inglés', function () {
    actingAsSeed('U01');
    $days = BusinessSchedule::defaultDays();
    $days['sat'] = ['open' => true, 'from' => '09:00', 'to' => '13:00'];
    $this->putJson('/api/v1/settings/business-hours', ['days' => $days])->assertOk();

    [$open, $closed, $sunday] = withinTenant(tenantA(), function (): array {
        $chat = app(WebChat::class);
        app(BusinessHours::class)->forget();
        $at = fn (string $moment) => CarbonImmutable::parse($moment, 'America/Lima');

        return [$chat->autoReply($at('2026-11-13 10:00'), 'en'), $chat->autoReply($at('2026-11-13 21:00'), 'en'), $chat->autoReply($at('2026-11-15 10:00'), 'en')];
    });

    expect($open)->toStartWith('Hi, thanks for reaching out.')->not->toContain('currently closed')
        ->and($closed)->toContain('We are currently closed')->toContain('Mon–Fri 08:00–19:00 · Sat 09:00–13:00')->toContain('tomorrow at 09:00')
        ->and($sunday)->toContain('tomorrow at 08:00');
});
