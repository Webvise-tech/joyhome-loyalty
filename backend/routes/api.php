<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\UserController;
use Illuminate\Support\Facades\Route;

/*
 * Authenticated, read-only endpoints — token signature is verified but the
 * revocation check is skipped to avoid the ~100–300 ms per-request hit it
 * adds. A demoted admin still loses elevated access immediately (admin routes
 * below use strict mode); the only thing they keep is the ability to read
 * their own /me until natural token expiry (≤1h).
 */
Route::middleware(['throttle:60,1', 'firebase.auth'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
});

/*
 * Admin endpoints — strict verification: revoked tokens and disabled users
 * are rejected immediately (extra round-trip to Firebase Auth). Worth the
 * cost because these grant privileged operations.
 */
Route::middleware(['throttle:60,1', 'firebase.auth:strict', 'firebase.superadmin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users/{uid}/role', [UserController::class, 'setRole']);
    });
