<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;

class UserController extends Controller
{
    public function index(FirebaseAuth $auth): JsonResponse
    {
        $users = [];
        foreach ($auth->listUsers(1000) as $user) {
            $users[] = [
                'uid' => $user->uid,
                'email' => $user->email,
                'displayName' => $user->displayName,
                'disabled' => $user->disabled,
                'createdAt' => $user->metadata->createdAt?->format(DATE_ATOM),
            ];
        }

        return response()->json(['users' => $users]);
    }

    public function setRole(Request $request, string $uid, FirebaseAuth $auth): JsonResponse
    {
        $request->validate(['role' => 'required|in:super_admin,user']);

        $callerUid = $request->attributes->get('firebase_uid');
        if ($callerUid === $uid) {
            return response()->json(
                ['message' => 'You cannot change your own role.'],
                403,
            );
        }

        $claims = $request->input('role') === 'super_admin'
            ? ['role' => 'super_admin']
            : null;

        $auth->setCustomUserClaims($uid, $claims);

        return response()->json(['ok' => true]);
    }
}
