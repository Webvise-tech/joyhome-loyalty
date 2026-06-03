<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\UserController;
use Illuminate\Support\Facades\Route;

// Authenticated routes — throttled per IP to protect Firebase quota and prevent DoS.
Route::middleware(['throttle:60,1', 'firebase.auth'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware('firebase.superadmin')->prefix('admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users/{uid}/role', [UserController::class, 'setRole']);
    });
});
