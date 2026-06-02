<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;

class AuthController extends Controller
{
    public function me(Request $request, FirebaseAuth $auth): JsonResponse
    {
        $uid = $request->attributes->get('firebase_uid');
        $user = $auth->getUser($uid);

        return response()->json([
            'uid' => $user->uid,
            'email' => $user->email,
            'displayName' => $user->displayName,
            'emailVerified' => $user->emailVerified,
        ]);
    }
}
