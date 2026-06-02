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
            } else {
              this.kind = null
              this.customer = null
            }
          } catch (e) {
            console.error('Failed to hydrate user kind:', e)
            this.kind = null
            this.customer = null
          } finally {
            this.ready = true
            resolve()
          }
        })
      })
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
      await signOut(auth)
    },

    async getIdToken(): Promise<string | null> {
      return this.user ? this.user.getIdToken() : null
    },
  },
})
