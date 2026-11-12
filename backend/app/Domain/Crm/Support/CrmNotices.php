<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Facades\DB;

final class CrmNotices
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function leadAssigned(string $code, string $ownerId, string $actorId): void
    {
        $lead = $this->lead($code);
        $this->notices->toUser($ownerId, 'lead.asignado', "{$code} · lead asignado a ti", $lead->name, 'lead', $lead->id, null, $actorId);
    }

    public function leadTaken(string $code, string $actorId, string $actorName): void
    {
        $lead = $this->lead($code);
        $this->notices->toManagers('lead.tomado', "{$code} · {$actorName} tomó el lead", $lead->name, 'lead', $lead->id, null, $actorId);
    }

    public function leadConverted(string $code, ?string $ownerId, string $opportunityCode, string $actorId): void
    {
        $lead = $this->lead($code);
        $this->notices->toRoles(StaffNotices::MANAGERS, 'lead.convertido', "{$code} · convertido en {$opportunityCode}", $lead->name, 'lead', $lead->id, null, [$ownerId], $actorId);
    }

    public function opportunityAssigned(string $code, string $ownerId, string $actorId): void
    {
        $opportunity = $this->opportunity($code);
        $this->notices->toUser($ownerId, 'oportunidad.asignada', "{$code} · oportunidad a tu cargo", $opportunity->title, 'opportunity', $opportunity->id, null, $actorId);
    }

    public function opportunityClosed(string $code, bool $won, string $actorId): void
    {
        $opportunity = $this->opportunity($code);
        $verb = $won ? 'ganada' : 'perdida';
        $this->notices->toRoles(StaffNotices::MANAGERS, "oportunidad.{$verb}", "{$code} · oportunidad {$verb}", $opportunity->title, 'opportunity', $opportunity->id, null, [$opportunity->owner_id], $actorId);
    }

    public function activityAssigned(string $code, string $ownerId, string $actorId): void
    {
        $activity = DB::table('crm_activities')->where('code', $code)->first(['id', 'subject', 'due_at']);
        $this->notices->toUser($ownerId, 'actividad.asignada', "{$code} · actividad asignada a ti", $activity?->subject, 'activity', $activity?->id, null, $actorId);
    }

    public function clientReassigned(string $code, string $ownerId, string $actorId): void
    {
        $client = DB::table('crm_clients')->where('code', $code)->first(['id', 'name']);
        $this->notices->toUser($ownerId, 'cliente.reasignado', "{$code} · cliente a tu cargo", $client?->name, 'client', $client?->id, null, $actorId);
    }

    public function caseAssigned(string $code, ?string $ownerId, ?string $actorId): void
    {
        $case = DB::table('crm_cases')->where('code', $code)->first(['id', 'subject']);
        $this->notices->toUser($ownerId, 'caso.asignado', "{$code} · caso de postventa a tu cargo", $case?->subject, 'case', $case?->id, null, $actorId);
    }

    public function detractor(string $caseCode, ?string $ownerId, string $client, int $score, ?string $comment): void
    {
        $case = DB::table('crm_cases')->where('code', $caseCode)->first(['id']);
        $body = "{$client} respondió la encuesta con NPS {$score}.".($comment ? "\n\nComentario: {$comment}" : '')."\n\nSe abrió el caso {$caseCode} y una actividad para contactarlo mañana.";
        $this->notices->toUser($ownerId, 'nps.detractor', "Detractor NPS {$score} · {$client}", $body, 'case', $case?->id);
        $this->notices->emailUser($ownerId, 'nps.detractor', "Detractor NPS {$score} · {$client}", $body, 'case', $case?->id);
    }

    public function caseClosed(string $caseId): ?string
    {
        $case = DB::table('crm_cases as k')->join('crm_clients as c', 'c.id', '=', 'k.client_id')->where('k.id', $caseId)->first(['k.code', 'k.subject', 'k.resolution', 'k.client_id', 'c.name', 'c.email']);

        if ($case === null) {
            return null;
        }

        $body = "Hola, {$case->name}:\n\nCerramos tu caso {$case->code} ({$case->subject}).\n\n".($case->resolution ? "Resolución: {$case->resolution}\n\n" : '').'Gracias por ayudarnos a mejorar.'."\n\n".$this->notices->agency();

        return $this->notices->email($case->email, 'caso.cerrado', "Tu caso {$case->code} quedó cerrado · ".$this->notices->agency(), $body, 'case', $caseId, 'client', ['client_id' => $case->client_id]);
    }

    private function lead(string $code): object
    {
        $lead = DB::table('crm_leads')->where('code', $code)->first(['id', 'full_name']);

        return (object) ['id' => $lead?->id, 'name' => (string) ($lead->full_name ?? $code)];
    }

    private function opportunity(string $code): object
    {
        $row = DB::table('crm_opportunities')->where('code', $code)->first(['id', 'title', 'owner_id']);

        return (object) ['id' => $row?->id, 'title' => (string) ($row->title ?? $code), 'owner_id' => $row?->owner_id];
    }
}
