<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $claims = $request->attributes->get('firebase_claims', []);

        if (! is_array($claims) || ($claims['role'] ?? null) !== 'super_admin') {
            return new JsonResponse(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
