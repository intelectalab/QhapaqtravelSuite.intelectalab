<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('jobs:run-due')->everyMinute()->withoutOverlapping(5)->onOneServer();

Schedule::command('horizon:snapshot')->everyFiveMinutes();
