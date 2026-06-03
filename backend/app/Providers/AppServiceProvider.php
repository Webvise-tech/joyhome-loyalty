<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $json = env('FIREBASE_CREDENTIALS_JSON');
        if ($json) {
            $path = storage_path('firebase/service-account.json');
            $existing = file_exists($path) ? @file_get_contents($path) : null;
            if ($existing !== $json) {
                @mkdir(dirname($path), 0755, true);
                $tmp = $path.'.tmp';
                if (file_put_contents($tmp, $json) !== false) {
                    @chmod($tmp, 0600);
                    @rename($tmp, $path);
                }
            }
        }
    }

    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
