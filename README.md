# JoyHome Loyalty

A loyalty-program web app.

- **Frontend:** Vite + Vue 3 + TypeScript (`frontend/`)
- **Backend:** Laravel 12 API (`backend/`)
- **Auth + Database:** Firebase Auth + Firestore

The Laravel backend only handles privileged operations (super-admin actions, bulk imports). Regular reads/writes go directly from the frontend to Firestore, secured by Firestore rules.

---

## 1. Firebase project setup (give this to the client)

The Firebase project must live in the **client's** Google account — they own billing, data, and ownership of the project.

### Steps for the client

1. Sign in to https://console.firebase.google.com with the Google account that should own the project.
2. Click **Add project** → name it (e.g. `joyhome-loyalty`) → enable Google Analytics if desired → **Create project**.
3. Once created:
   - **Authentication** → **Get started** → **Sign-in method** → enable **Email/Password** (and any other providers you want).
   - **Firestore Database** → **Create database** → start in **production mode** → pick a region (one closest to your users).
   - **Project Settings** (gear icon) → **General** → scroll to **Your apps** → click the web icon `</>` → register a web app → copy the `firebaseConfig` values, send them to the developer.
4. **Invite the developer** as Editor:
   - Project Settings → **Users and permissions** → **Add member** → enter the developer's Google email → role **Editor** → **Add member**.
5. **Service account for the backend:**
   - Project Settings → **Service accounts** → **Generate new private key** → confirm → a JSON file downloads.
   - Send this file to the developer through a secure channel (1Password, encrypted email — *not* a public chat).
6. **Billing (when ready for production):**
   - Upgrade to the **Blaze plan** (pay-as-you-go) — required for outbound network calls in Cloud Functions and for higher Firestore limits. Add a credit card under the client's billing account.

### What the developer needs from the client

- The web app `firebaseConfig` object (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
- The service-account JSON file
- An Editor invite to the Firebase Console

---

## 2. Local development setup

### Prerequisites

- PHP 8.2+ and Composer
- Node 20+ and npm
- A Firebase project (see section 1)

### Backend (`backend/`)

```bash
cd backend
cp .env.example .env  # if .env doesn't exist
php artisan key:generate
```

Place the Firebase service-account JSON at:

```
backend/storage/firebase/service-account.json
```

(This path is gitignored.)

Edit `backend/.env`:

```
FIREBASE_CREDENTIALS=storage/firebase/service-account.json
FIREBASE_PROJECT_ID=your-firebase-project-id
```

Run the API:

```bash
php artisan serve
# http://localhost:8000
```

### Frontend (`frontend/`)

```bash
cd frontend
```

Edit `frontend/.env` with the values from the client's `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://localhost:8000/api
```

Run the dev server:

```bash
npm run dev
# http://localhost:5173
```

---

## 3. Creating the first super admin

1. Register a user (or create one in Firebase Console → Authentication → Add user).
2. In Firebase Console → **Firestore** → create a collection `users` if it doesn't exist.
3. Add a document with **ID = the user's UID** (from the Auth tab) and fields:
   ```
   role: "super_admin"
   email: "<their email>"
   ```
4. Sign in to the frontend with that user — the dashboard now shows the super-admin section.

---

## 4. How auth works

1. Frontend signs the user in with Firebase Auth → receives an ID token.
2. Frontend calls Laravel API endpoints with `Authorization: Bearer <id-token>`.
3. Laravel middleware `firebase.auth` verifies the token via the Firebase Admin SDK and sets `firebase_uid` on the request.
4. The `firebase.superadmin` middleware additionally checks the Firestore `users/{uid}.role == "super_admin"`.

API endpoints:

- `GET /api/me` — current user (any authenticated user)
- `GET /api/admin/users` — list all Firebase users (super-admin only)
- `POST /api/admin/users/{uid}/role` — set a user's role (super-admin only)

---

## 5. Production checklist

- [ ] Set up Firestore security rules so non-admins can only read/write their own data
- [ ] Move Firebase project to client's Google account if it started elsewhere
- [ ] Enable App Check on Firebase to prevent abuse
- [ ] Configure CORS on the Laravel backend (`config/cors.php`) to allow the production frontend origin
- [ ] Set `APP_ENV=production`, `APP_DEBUG=false` in `backend/.env`
- [ ] Upgrade Firebase project to Blaze plan
