<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Exception\Auth\RevokedIdToken;
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
            // checkIfRevoked = true: also reject tokens for disabled users and
            // tokens whose validity-time was bumped (Firebase Admin SDK
            // `revokeRefreshTokens`). Without this, a demoted/fired admin keeps
            // their session up to ~1h until natural token expiry.
            $verified = $this->auth->verifyIdToken($header, true);
        } catch (RevokedIdToken $e) {
            return new JsonResponse(['message' => 'Token revoked'], 401);
        } catch (FailedToVerifyToken $e) {
            report($e);
            return new JsonResponse(['message' => 'Invalid token'], 401);
        }

        $request->attributes->set('firebase_uid', $verified->claims()->get('sub'));
        $request->attributes->set('firebase_claims', $verified->claims()->all());

        return $next($request);
    }
}
