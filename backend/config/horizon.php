<?php

use Illuminate\Support\Str;

return [

    'name' => env('HORIZON_NAME'),

    'domain' => env('HORIZON_DOMAIN'),

    'path' => env('HORIZON_PATH', 'horizon'),

    'use' => 'default',

    'prefix' => env(
        'HORIZON_PREFIX',
        Str::slug(env('APP_NAME', 'laravel'), '_').'_horizon:'
    ),

    'middleware' => ['web'],

    'waits' => [
        'redis:critical' => 30,
        'redis:default' => 60,
        'redis:notifications' => 120,
        'redis:integrations' => 300,
    ],

    'trim' => [
        'recent' => 60,
        'pending' => 60,
        'completed' => 60,
        'recent_failed' => 10080,
        'failed' => 10080,
        'monitored' => 10080,
    ],

    'silenced' => [

    ],

    'silenced_tags' => [

    ],

    'metrics' => [
        'trim_snapshots' => [
            'job' => 24,
            'queue' => 24,
        ],
    ],

    'fast_termination' => false,

    'memory_limit' => 64,

    'defaults' => [
        'supervisor-critical' => [
            'connection' => 'redis',
            'queue' => ['critical'],
            'balance' => 'simple',
            'maxProcesses' => 1,
            'memory' => 128,
            'tries' => 1,
            'timeout' => 60,
        ],
        'supervisor-default' => [
            'connection' => 'redis',
            'queue' => ['default', 'documents', 'reports', 'low'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 1,
            'memory' => 128,
            'tries' => 1,
            'timeout' => 120,
        ],
        'supervisor-messages' => [
            'connection' => 'redis',
            'queue' => ['notifications', 'integrations'],
            'balance' => 'auto',
            'autoScalingStrategy' => 'time',
            'maxProcesses' => 1,
            'memory' => 128,
            'tries' => 1,
            'timeout' => 90,
        ],
    ],

    'environments' => [
        'production' => [
            'supervisor-critical' => ['maxProcesses' => 4],
            'supervisor-default' => ['maxProcesses' => 6, 'balanceMaxShift' => 1, 'balanceCooldown' => 3],
            'supervisor-messages' => ['maxProcesses' => 4, 'balanceMaxShift' => 1, 'balanceCooldown' => 3],
        ],

        'local' => [
            'supervisor-critical' => ['maxProcesses' => 1],
            'supervisor-default' => ['maxProcesses' => 2],
            'supervisor-messages' => ['maxProcesses' => 2],
        ],
    ],

    'watch' => [
        'app',
        'bootstrap',
        'config/**/*.php',
        'database/**/*.php',
        'public/**/*.php',
        'resources/**/*.php',
        'routes',
        'composer.lock',
        'composer.json',
        '.env',
    ],
];
