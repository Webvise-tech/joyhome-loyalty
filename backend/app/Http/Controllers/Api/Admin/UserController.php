<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;
use Kreait\Firebase\Contract\Firestore;

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

    public function setRole(Request $request, string $uid, Firestore $firestore): JsonResponse
    {
        $request->validate(['role' => 'required|in:super_admin,user']);

        $firestore->database()->collection('users')->document($uid)->set(
            ['role' => $request->input('role')],
            ['merge' => true]
        );

        return response()->json(['ok' => true]);
    }
}
