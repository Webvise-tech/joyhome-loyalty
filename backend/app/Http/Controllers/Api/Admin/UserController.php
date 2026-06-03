<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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

    /*
     * Change a user's `role` custom claim WITHOUT wiping their other claims.
     * The previous implementation called `setCustomUserClaims($uid, null)` on
     * demotion, which removed every custom claim Firebase Auth was carrying for
     * that user — fine today, but a footgun the moment we add a second claim.
     *
     * We also log every change (caller, target, before, after) so role escalation
     * is auditable from `storage/logs/laravel.log` (or your hosted log drain).
     */
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

        $existing = $auth->getUser($uid)->customClaims ?? [];
        $oldRole = $existing['role'] ?? null;
        $newRole = $request->input('role');

        $next = $existing;
        if ($newRole === 'super_admin') {
            $next['role'] = 'super_admin';
        } else {
            unset($next['role']);
        }

        if ($next === $existing) {
            return response()->json(['ok' => true, 'unchanged' => true]);
        }

        // Empty array vs null: kreait treats both the same here, but passing null
        // when there are no claims left is the documented "clear" call.
        $auth->setCustomUserClaims($uid, $next === [] ? null : $next);

        $callerClaims = $request->attributes->get('firebase_claims', []);
        Log::info('admin.role_changed', [
            'caller_uid' => $callerUid,
            'caller_email' => is_array($callerClaims) ? ($callerClaims['email'] ?? null) : null,
            'target_uid' => $uid,
            'old_role' => $oldRole,
            'new_role' => $newRole === 'super_admin' ? 'super_admin' : 'user',
        ]);

        return response()->json(['ok' => true]);
    }
}
