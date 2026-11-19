<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Mail\QueuedMail;
use App\Domain\Showcase\Support\ShowcaseRules;
use Illuminate\Support\Facades\DB;

final class ShowcaseReminder extends PlatformJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $tomorrow = $this->today()->addDay();
        $rows = DB::connection('pgsql_platform')->table('platform_showcase_bookings as b')
            ->join('platform_showcase_listings as l', 'l.id', '=', 'b.listing_id')
            ->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')
            ->where('b.status', 'confirmada')
            ->where('b.service_date', $tomorrow->toDateString())
            ->orderBy('b.start_time')
            ->get(['b.code', 'b.traveler_name', 'b.traveler_email', 'b.pax', 'b.start_time', 'b.cancel_token', 'l.title', 'l.meeting_point', 'l.model', 'a.name as agency_name', 'a.phone as agency_phone']);
        $mail = app(QueuedMail::class);
        $date = $tomorrow->locale('es')->translatedFormat('l j \d\e F');
        $base = rtrim((string) config('app.frontend_url'), '/');

        foreach ($rows as $row) {
            $mail->send((string) $row->traveler_email, (string) $row->traveler_name, "Mañana es tu tour: {$row->title}", $this->body($row, $date, $base));
        }

        return $rows->isEmpty() ? 'Sin salidas de la vitrina mañana' : self::plural($rows->count(), 'recordatorio enviado', 'recordatorios enviados').' para las salidas de mañana';
    }

    private function body(object $row, string $date, string $base): string
    {
        $people = (int) $row->pax === 1 ? '1 persona' : "{$row->pax} personas";
        $lines = [
            "Hola, {$row->traveler_name}:",
            '',
            "Te recordamos tu reserva {$row->code} para mañana, {$date}.",
            '',
            "Tour: {$row->title}",
            "Hora: {$row->start_time}",
            "Punto de encuentro: {$row->meeting_point}",
            "Personas: {$people}",
            "Agencia: {$row->agency_name}".($row->agency_phone ? " · {$row->agency_phone}" : ''),
            '',
            $row->model === 'propina' ? 'Es un free tour: al final puedes dejar la propina que consideres justa.' : 'Llega unos minutos antes para que el guía confirme tu reserva.',
            '',
            "Si ya no puedes ir, cancela aquí para liberar tu cupo: {$base}/vitrina/cancelar/{$row->cancel_token}",
            '',
            ShowcaseRules::BRAND,
        ];

        return implode("\n", $lines);
    }
}
