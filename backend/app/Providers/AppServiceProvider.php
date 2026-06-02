<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $json = env('FIREBASE_CREDENTIALS_JSON');
        if ($json) {
            $path = storage_path('firebase/service-account.json');
            if (! file_exists($path)) {
                @mkdir(dirname($path), 0755, true);
                file_put_contents($path, $json);
            }
        }
    }

    public function boot(): void
    {
        //
    }
}
