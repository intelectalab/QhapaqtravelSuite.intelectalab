<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use Illuminate\Support\Facades\DB;

final class NavCounts
{
    public function for(User $viewer): array
    {
        if (! RoleExperience::isBackoffice($viewer)) {
            return ['leads' => 0, 'activities' => 0, 'quotes' => 0, 'incidents' => 0];
        }

        return [
            'leads' => Portfolio::scope(DB::table('crm_leads')->whereNull('deleted_at')->where('status', 'nuevo'), $viewer, 'owner_id')->count(),
            'activities' => Portfolio::scope(DB::table('crm_activities')->where('status', '<>', 'completada'), $viewer, 'owner_id')->count(),
            'quotes' => Portfolio::scope(DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', ['enviada', 'vista', 'negociacion']), $viewer, 'owner_id')->count(),
            'incidents' => DB::table('ops_incidents')->whereNotIn('status', ['resuelta', 'cerrada'])->count(),
        ];
    }
}
