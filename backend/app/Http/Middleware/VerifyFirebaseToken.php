<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Symfony\Component\HttpFoundation\Response;

class VerifyFirebaseToken
{
    public function __construct(private FirebaseAuth $auth) {}

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->bearerToken();

        if (! $header) {
            return new JsonResponse(['message' => 'Missing bearer token'], 401);
        }

        try {
            $verified = $this->auth->verifyIdToken($header);
        } catch (FailedToVerifyToken $e) {
            report($e);
            return new JsonResponse(['message' => 'Invalid token'], 401);
        }

        $request->attributes->set('firebase_uid', $verified->claims()->get('sub'));
        $request->attributes->set('firebase_claims', $verified->claims()->all());

        return $next($request);
    }
}
