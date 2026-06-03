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

    /*
     * `$mode` controls the revocation check (kreait's `$checkIfRevoked`):
     *   - 'lax' (default): only verify the JWT signature + claims. Cheap, no
     *     network call to Firebase Auth. Used for read-only endpoints like
     *     /me where stale-by-up-to-1h is acceptable.
     *   - 'strict': additionally fetch the user record and reject the token
     *     if it was revoked or the user is disabled. Adds ~100–300 ms per
     *     request (HTTPS round-trip Heroku → Firebase Auth REST). Used for
     *     admin endpoints so a demoted/fired admin loses access immediately.
     */
    public function handle(Request $request, Closure $next, string $mode = 'lax'): Response
    {
        $header = $request->bearerToken();

        if (! $header) {
            return new JsonResponse(['message' => 'Missing bearer token'], 401);
        }

        $checkRevoked = $mode === 'strict';

        try {
            $verified = $this->auth->verifyIdToken($header, $checkRevoked);
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
