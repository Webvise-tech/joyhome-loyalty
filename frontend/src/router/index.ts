import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Hostnames are configured per environment via Vercel env vars. In local dev they're
// left empty so both UIs are accessible from localhost.
const ADMIN_HOST = (import.meta.env.VITE_ADMIN_HOST ?? '').trim()
const CUSTOMER_HOST = (import.meta.env.VITE_CUSTOMER_HOST ?? '').trim()

function hostname(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname
}

function isAdminSubdomain(): boolean {
  return ADMIN_HOST.length > 0 && hostname() === ADMIN_HOST
}

function isCustomerSubdomain(): boolean {
  return CUSTOMER_HOST.length > 0 && hostname() === CUSTOMER_HOST
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Customer auth (public) — root paths, what the QR code points to
    {
      path: '/',
      component: () => import('../layouts/GuestLayout.vue'),
      meta: { guestOnly: true, kind: 'customer' },
      children: [
        { path: '', name: 'home', redirect: { name: 'login' } },
        { path: 'login', name: 'login', component: () => import('../views/Login.vue') },
        { path: 'register', name: 'register', component: () => import('../views/Register.vue') },
      ],
    },

    // Customer app (protected)
    {
      path: '/',
      component: () => import('../layouts/CustomerLayout.vue'),
      meta: { requiresAuth: true, requiresKind: 'customer' },
      children: [
        { path: 'dashboard', name: 'customer.dashboard', component: () => import('../views/Dashboard.vue') },
        { path: 'history', name: 'customer.history', component: () => import('../views/History.vue') },
      ],
    },

    // Admin login (public, separate URL not advertised to customers)
    {
      path: '/admin/login',
      name: 'admin.login',
      component: () => import('../views/admin/Login.vue'),
      meta: { guestOnly: true, kind: 'admin' },
    },

    // Admin app (protected)
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, requiresKind: 'admin' },
      redirect: { name: 'admin.dashboard' },
      children: [
        { path: 'dashboard', name: 'admin.dashboard', component: () => import('../views/admin/Dashboard.vue') },
        { path: 'customers', name: 'admin.customers', component: () => import('../views/admin/Customers.vue') },
        { path: 'approvals', name: 'admin.approvals', component: () => import('../views/admin/Approvals.vue') },
        { path: 'catalogue', name: 'admin.catalogue', component: () => import('../views/admin/Catalogue.vue') },
        { path: 'redemptions', name: 'admin.redemptions', component: () => import('../views/admin/Redemptions.vue') },
        { path: 'fraud', name: 'admin.fraud', component: () => import('../views/admin/FraudAlerts.vue') },
      ],
    },

    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

router.beforeEach(async (to) => {
  const store = useAuthStore()
  if (!store.ready) await store.init()

  // Authenticated but unknown kind (stale token / orphan account): sign out cleanly
  // so the user can re-authenticate with a fresh ID token.
  if (store.isAuthenticated && store.kind === null) {
    await store.logout()
    return to.path.startsWith('/admin') ? { name: 'admin.login' } : { name: 'login' }
  }

  const isAdminPath = to.path.startsWith('/admin')

  // Wrong-role-for-host sign-out: a customer browsing the admin subdomain (or vice
  // versa) gets logged out so the host's intended UI shows cleanly.
  if (isAdminSubdomain() && store.isAuthenticated && store.kind === 'customer') {
    await store.logout()
  }
  if (isCustomerSubdomain() && store.isAuthenticated && store.kind === 'admin') {
    await store.logout()
  }

  // Host gating — keep each subdomain restricted to its intended routes.
  if (isAdminSubdomain() && !isAdminPath) {
    return store.isAuthenticated && store.kind === 'admin'
      ? { name: 'admin.dashboard' }
      : { name: 'admin.login' }
  }
  if (isCustomerSubdomain() && isAdminPath) {
    return store.isAuthenticated && store.kind === 'customer'
      ? { name: 'customer.dashboard' }
      : { name: 'home' }
  }

  if (to.meta.requiresAuth) {
    if (!store.isAuthenticated) {
      return to.meta.requiresKind === 'admin' ? { name: 'admin.login' } : { name: 'login' }
    }
    if (to.meta.requiresKind && store.kind !== to.meta.requiresKind) {
      return store.kind === 'admin'
        ? { name: 'admin.dashboard' }
        : { name: 'customer.dashboard' }
    }
  }

  if (to.meta.guestOnly && store.isAuthenticated) {
    return store.kind === 'admin'
      ? { name: 'admin.dashboard' }
      : { name: 'customer.dashboard' }
  }
})

export default router
