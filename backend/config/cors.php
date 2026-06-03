<?php

/*
 * Allowed origins come from two env vars merged with localhost defaults:
 *   FRONTEND_URL            — single canonical frontend URL
 *   CORS_ALLOWED_ORIGINS    — comma-separated additional origins (admin host,
 *                             preview deployments, second frontend, etc.)
 *
 * No wildcard patterns. Previously this config accepted any `*.vercel.app`
 * origin via `allowed_origins_patterns`, which let any Vercel-hosted page on
 * the internet call the API from a victim's browser. Whitelist explicit hosts.
 */

$envOrigins = array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        [
            env('FRONTEND_URL'),
            'http://localhost:5173',
            'http://localhost:3000',
        ],
        $envOrigins,
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
