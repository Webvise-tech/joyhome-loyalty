import { defineStore } from 'pinia'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export type UserKind = 'admin' | 'customer' | null

/*
 * Force a fresh ID token + re-hydrated role/profile on this cadence. The
 * Firebase ID token has a 1h TTL, so if an admin is demoted (custom claim
 * removed) the role flips here within at most this interval — without it the
 * stale claim grants admin UI access until the next natural refresh. Also
 * surfaces server-side token revocation: `getIdToken(true)` rejects for
 * disabled / revoked users, and we sign them out on failure.
 */
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000

let refreshHandle: ReturnType<typeof setInterval> | null = null

function stopRefreshTimer(): void {
  if (refreshHandle) {
    clearInterval(refreshHandle)
    refreshHandle = null
  }
}

export interface CustomerProfile {
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth?: string
  total_points?: number
}

interface AuthState {
  user: User | null
  kind: UserKind
  customer: CustomerProfile | null
  ready: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    kind: null,
    customer: null,
    ready: false,
  }),

  getters: {
    isAuthenticated: (s) => s.user !== null,
    isAdmin: (s) => s.kind === 'admin',
    isCustomer: (s) => s.kind === 'customer',
  },

  actions: {
    init() {
      return new Promise<void>((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          this.user = user
          try {
            if (user) {
              await this.hydrateUserKind()
              this.startTokenRefreshTimer()
            } else {
              this.kind = null
              this.customer = null
              stopRefreshTimer()
            }
          } catch (e) {
            console.error('Failed to hydrate user kind:', e)
            this.kind = null
            this.customer = null
            stopRefreshTimer()
          } finally {
            this.ready = true
            resolve()
          }
        })
      })
    },

    /*
     * Idempotent: replaces any existing timer. Fires every 5 min while signed
     * in. On a force-refresh failure (revoked token / disabled account) we
     * sign out — the api/client.ts 401 toast would already have surfaced this
     * to the user on their next API call, but this catches them sooner.
     */
    startTokenRefreshTimer(): void {
      stopRefreshTimer()
      refreshHandle = setInterval(async () => {
        if (!this.user) {
          stopRefreshTimer()
          return
        }
        try {
          await this.user.getIdToken(true)
          await this.hydrateUserKind()
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('Token refresh failed; signing out.', e)
          }
          try { await this.logout() } catch { /* ignore */ }
        }
      }, TOKEN_REFRESH_INTERVAL_MS)
    },

    async hydrateUserKind() {
      if (!this.user) {
        this.kind = null
        this.customer = null
        return
      }

      // Admin detection via ID token custom claim (no Firestore read needed)
      const tokenResult = await this.user.getIdTokenResult()
      if (tokenResult.claims.role === 'super_admin') {
        this.kind = 'admin'
        this.customer = null
        return
      }

      // Customer detection via Firestore profile doc
      try {
        const snap = await getDoc(doc(db, 'customers', this.user.uid))
        if (snap.exists()) {
          this.kind = 'customer'
          this.customer = snap.data() as CustomerProfile
          return
        }
      } catch (e) {
        console.warn('Failed to load customer profile:', e)
      }

      this.kind = null
      this.customer = null
    },

    async adminLogin(email: string, password: string) {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      // Force a token refresh so custom claims set after the user existed land in this session
      await cred.user.getIdToken(true)
      await this.hydrateUserKind()
    },

    async customerLogin(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password)
      await this.hydrateUserKind()
    },

    async customerRegister(payload: {
      first_name: string
      last_name: string
      email: string
      password: string
      phone: string
      date_of_birth: string
    }) {
      const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password)

      try {
        await updateProfile(cred.user, {
          displayName: `${payload.first_name} ${payload.last_name}`.trim(),
        })

        await setDoc(doc(db, 'customers', cred.user.uid), {
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone,
          date_of_birth: payload.date_of_birth,
          total_points: 0,
          created_at: new Date().toISOString(),
        })

        await this.hydrateUserKind()
      } catch (e) {
        // Roll back the orphan auth user if the Firestore write failed
        try { await cred.user.delete() } catch { /* ignore */ }
        throw e
      }
    },

    async logout() {
      stopRefreshTimer()
      await signOut(auth)
    },

    async getIdToken(): Promise<string | null> {
      return this.user ? this.user.getIdToken() : null
    },
  },
})
