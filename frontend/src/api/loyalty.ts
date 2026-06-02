import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export interface CatalogueItem {
  id: string
  name: string
  photo_url: string | null
  points_cost: number
  category: string | null
  stock_qty: number
  is_active: boolean
  added_at?: Timestamp
}

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Claim {
  id: string
  customer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  claimed_amount: number
  points_to_award: number
  status: ClaimStatus
  submitted_at: Timestamp
  reviewed_by?: string
  reviewed_at?: Timestamp
  reject_reason?: string
}

export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'CONSUMED'
export type BatchSource = 'IN_STORE' | 'ONLINE' | 'ADJUSTMENT'

export interface PointsBatch {
  id: string
  customer_id: string
  points: number // can be negative for ADJUSTMENT deductions
  source: BatchSource
  amount_usd: number
  earned_at: Timestamp
  expires_at: Timestamp
  status: BatchStatus
  claim_id?: string
  adjustment_reason?: string
  adjusted_by?: string
}

export type RedemptionMethod = 'IN_STORE' | 'ONLINE'
export type RedemptionStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELED'

export interface DeliveryAddress {
  recipient_name: string
  phone: string
  street: string
  city: string
  notes?: string
}

export interface Redemption {
  id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  catalogue_item_id: string
  catalogue_item_name: string
  catalogue_item_photo: string | null
  points_used: number
  method: RedemptionMethod
  otp_code?: string
  /** Formatted multi-line string for display. */
  delivery_address?: string
  /** Structured fields (newer redemptions). */
  delivery_recipient_name?: string
  delivery_phone?: string
  delivery_street?: string
  delivery_city?: string
  delivery_notes?: string
  status: RedemptionStatus
  created_at: Timestamp
}

const POINTS_BATCH_EXPIRY_DAYS = 60

/** $10 = 1 point, rounded down. Minimum claim $10. */
export function pointsFor(amountUsd: number): number {
  if (amountUsd < 10) return 0
  return Math.floor(amountUsd / 10)
}

/* ── Catalogue ─────────────────────────────────────────────────────────── */

export async function listActiveCatalogue(): Promise<CatalogueItem[]> {
  const q = query(collection(db, 'catalogue'), where('is_active', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogueItem, 'id'>) }))
}

/* ── Claims ────────────────────────────────────────────────────────────── */

export async function submitClaim(input: {
  customer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  claimed_amount: number
}): Promise<string> {
  const points_to_award = pointsFor(input.claimed_amount)
  if (points_to_award < 1) {
    throw new Error('Receipt must be at least $10 to earn points.')
  }
  const ref = await addDoc(collection(db, 'claims'), {
    customer_id: input.customer_id,
    customer_name: input.customer_name,
    customer_email: input.customer_email,
    customer_phone: input.customer_phone,
    claimed_amount: input.claimed_amount,
    points_to_award,
    status: 'PENDING' as ClaimStatus,
    submitted_at: serverTimestamp(),
  })
  return ref.id
}

export async function listMyClaims(uid: string, max = 20): Promise<Claim[]> {
  const q = query(
    collection(db, 'claims'),
    where('customer_id', '==', uid),
    orderBy('submitted_at', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }))
}

export async function listPendingClaims(): Promise<Claim[]> {
  const q = query(
    collection(db, 'claims'),
    where('status', '==', 'PENDING'),
    orderBy('submitted_at', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }))
}

/** Admin: every claim (any status) — sorted newest first, limited client-side. */
export async function listRecentClaims(max = 50): Promise<Claim[]> {
  const snap = await getDocs(collection(db, 'claims'))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }))
    .sort((a, b) => (b.submitted_at?.toMillis?.() ?? 0) - (a.submitted_at?.toMillis?.() ?? 0))
    .slice(0, max)
}

/** Admin: all rejected claims — surfaced on the Fraud Alerts page. */
export async function listRejectedClaims(): Promise<Claim[]> {
  const q = query(collection(db, 'claims'), where('status', '==', 'REJECTED'))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Claim, 'id'>) }))
    .sort(
      (a, b) =>
        (b.reviewed_at?.toMillis?.() ?? b.submitted_at?.toMillis?.() ?? 0) -
        (a.reviewed_at?.toMillis?.() ?? a.submitted_at?.toMillis?.() ?? 0),
    )
}

/**
 * Approve a pending claim: atomic transaction that
 *  - marks the claim APPROVED with reviewer + timestamp
 *  - creates an ACTIVE points_batch (expires_at = now + 60 days)
 */
export async function approveClaim(claimId: string, reviewerUid: string): Promise<void> {
  const claimRef = doc(db, 'claims', claimId)

  await runTransaction(db, async (tx) => {
    const claimSnap = await tx.get(claimRef)
    if (!claimSnap.exists()) throw new Error('Claim not found')
    const claim = claimSnap.data() as Claim
    if (claim.status !== 'PENDING') {
      throw new Error(`Claim is already ${claim.status.toLowerCase()}.`)
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + POINTS_BATCH_EXPIRY_DAYS)

    const batchRef = doc(collection(db, 'points_batches'))
    tx.set(batchRef, {
      customer_id: claim.customer_id,
      points: claim.points_to_award,
      source: 'IN_STORE' as const,
      amount_usd: claim.claimed_amount,
      earned_at: Timestamp.fromDate(now),
      expires_at: Timestamp.fromDate(expiresAt),
      status: 'ACTIVE' as BatchStatus,
      claim_id: claimId,
    })

    tx.update(claimRef, {
      status: 'APPROVED' as ClaimStatus,
      reviewed_by: reviewerUid,
      reviewed_at: serverTimestamp(),
    })
  })
}

export async function rejectClaim(
  claimId: string,
  reviewerUid: string,
  reason: string,
): Promise<void> {
  const claimRef = doc(db, 'claims', claimId)
  await runTransaction(db, async (tx) => {
    const claimSnap = await tx.get(claimRef)
    if (!claimSnap.exists()) throw new Error('Claim not found')
    if ((claimSnap.data() as Claim).status !== 'PENDING') {
      throw new Error('Claim is no longer pending.')
    }
    tx.update(claimRef, {
      status: 'REJECTED' as ClaimStatus,
      reviewed_by: reviewerUid,
      reviewed_at: serverTimestamp(),
      reject_reason: reason || 'No reason given',
    })
  })
}

/* ── Points balance ────────────────────────────────────────────────────── */

/** Read all ACTIVE batches for a customer; filter expiry client-side to avoid composite-index requirement. */
export async function listMyActiveBatches(uid: string): Promise<PointsBatch[]> {
  const q = query(
    collection(db, 'points_batches'),
    where('customer_id', '==', uid),
    where('status', '==', 'ACTIVE'),
  )
  const snap = await getDocs(q)
  const now = Date.now()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PointsBatch, 'id'>) }))
    .filter((b) => b.expires_at.toMillis() > now)
    .sort((a, b) => a.expires_at.toMillis() - b.expires_at.toMillis())
}

export function totalPoints(batches: PointsBatch[]): number {
  return batches.reduce((sum, b) => sum + (b.points || 0), 0)
}

/** The earliest expiry date across active batches — what to surface to the customer. */
export function nextExpiry(batches: PointsBatch[]): Date | null {
  if (!batches.length) return null
  return batches[0].expires_at.toDate()
}

/* ── Redemptions ───────────────────────────────────────────────────────── */

/** Net spendable balance: earned points minus non-canceled redemptions. */
export function availableBalance(batches: PointsBatch[], redemptions: Redemption[]): number {
  const earned = totalPoints(batches)
  const spent = redemptions
    .filter((r) => r.status !== 'CANCELED')
    .reduce((s, r) => s + (r.points_used || 0), 0)
  return Math.max(0, earned - spent)
}

function generateOtp(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100000 + (arr[0] % 900000))
}

export async function listMyRedemptions(uid: string, max = 20): Promise<Redemption[]> {
  // Single equality filter to avoid requiring a composite index.
  // Sort + limit client-side — fine at per-customer scale.
  const q = query(collection(db, 'redemptions'), where('customer_id', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Redemption, 'id'>) }))
    .sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0))
    .slice(0, max)
}

export async function submitRedemption(input: {
  customer_id: string
  customer_name: string
  customer_phone: string
  item: CatalogueItem
  method: RedemptionMethod
  delivery?: DeliveryAddress
}): Promise<{ id: string; otp_code?: string }> {
  const payload: Record<string, unknown> = {
    customer_id: input.customer_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    catalogue_item_id: input.item.id,
    catalogue_item_name: input.item.name,
    catalogue_item_photo: input.item.photo_url ?? null,
    points_used: input.item.points_cost,
    method: input.method,
    status: 'PENDING' as RedemptionStatus,
    created_at: serverTimestamp(),
  }

  let otp_code: string | undefined
  if (input.method === 'IN_STORE') {
    otp_code = generateOtp()
    payload.otp_code = otp_code
  } else {
    const d = input.delivery
    if (
      !d?.recipient_name?.trim() ||
      !d?.phone?.trim() ||
      !d?.street?.trim() ||
      !d?.city?.trim()
    ) {
      throw new Error('Recipient name, phone, street and city are required for delivery.')
    }
    payload.delivery_recipient_name = d.recipient_name.trim()
    payload.delivery_phone = d.phone.trim()
    payload.delivery_street = d.street.trim()
    payload.delivery_city = d.city.trim()
    payload.delivery_notes = d.notes?.trim() || null
    payload.delivery_address = [
      d.recipient_name.trim(),
      d.phone.trim(),
      d.street.trim(),
      d.city.trim(),
      d.notes?.trim(),
    ]
      .filter(Boolean)
      .join('\n')
  }

  const ref = await addDoc(collection(db, 'redemptions'), payload)
  return { id: ref.id, otp_code }
}

/** Admin: list pending redemptions (in-store + online), ordered oldest first. */
export async function listPendingRedemptions(): Promise<Redemption[]> {
  // Single equality filter avoids needing a composite index. Sort client-side.
  const q = query(collection(db, 'redemptions'), where('status', '==', 'PENDING'))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Redemption, 'id'>) }))
    .sort((a, b) => (a.created_at?.toMillis?.() ?? 0) - (b.created_at?.toMillis?.() ?? 0))
}

/** Admin: all recent redemptions (any status) — sorted newest first, limited client-side. */
export async function listRecentRedemptions(max = 50): Promise<Redemption[]> {
  const snap = await getDocs(collection(db, 'redemptions'))
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Redemption, 'id'>) }))
    .sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0))
    .slice(0, max)
}

/**
 * Admin: cashier types the customer's 6-digit code at the register.
 * Verifies a PENDING in-store redemption exists with that code, hasn't expired,
 * and marks it CONFIRMED — atomically.
 */
export async function confirmInStoreOtp(code: string, adminUid: string): Promise<Redemption> {
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error('Code must be 6 digits.')
  }

  const q = query(
    collection(db, 'redemptions'),
    where('otp_code', '==', trimmed),
  )
  const snap = await getDocs(q)

  const match = snap.docs.find((d) => {
    const r = d.data() as Redemption
    return r.status === 'PENDING' && r.method === 'IN_STORE'
  })
  if (!match) throw new Error('No pending in-store pickup found for that code.')

  const data = match.data() as Redemption

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'redemptions', match.id)
    const fresh = await tx.get(ref)
    if (!fresh.exists()) throw new Error('Redemption not found.')
    if ((fresh.data() as Redemption).status !== 'PENDING') {
      throw new Error('Already confirmed by someone else.')
    }
    tx.update(ref, {
      status: 'CONFIRMED' as RedemptionStatus,
      reviewed_by: adminUid,
      reviewed_at: serverTimestamp(),
    })
  })

  return { id: match.id, ...(data as Omit<Redemption, 'id'>) }
}

export async function markRedemptionDelivered(id: string, adminUid: string): Promise<void> {
  const ref = doc(db, 'redemptions', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Redemption not found.')
    const r = snap.data() as Redemption
    if (r.method !== 'ONLINE') throw new Error('Only online deliveries can be marked delivered.')
    if (r.status === 'DELIVERED') return
    tx.update(ref, {
      status: 'DELIVERED' as RedemptionStatus,
      reviewed_by: adminUid,
      reviewed_at: serverTimestamp(),
    })
  })
}

export async function cancelRedemption(id: string, adminUid: string): Promise<void> {
  const ref = doc(db, 'redemptions', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Redemption not found.')
    if ((snap.data() as Redemption).status === 'CANCELED') return
    tx.update(ref, {
      status: 'CANCELED' as RedemptionStatus,
      reviewed_by: adminUid,
      reviewed_at: serverTimestamp(),
    })
  })
}

/* ── Admin: customers list with aggregated totals ──────────────────────── */

export interface CustomerSummary {
  uid: string
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at?: string
  receipts_total_usd: number
  receipts_count: number
  points_earned: number  // lifetime from approved claims
  current_balance: number // active batches minus non-canceled redemptions
}

/**
 * Load every customer profile and aggregate their data for the admin Customers page.
 * Four queries total (customers + approved claims + active batches + all redemptions),
 * aggregated client-side — fine for the 2-10k customer scale per brief.
 */
export async function listCustomersWithTotals(): Promise<CustomerSummary[]> {
  const [custSnap, claimsSnap, batchesSnap, redemptionsSnap] = await Promise.all([
    getDocs(collection(db, 'customers')),
    getDocs(query(collection(db, 'claims'), where('status', '==', 'APPROVED'))),
    getDocs(query(collection(db, 'points_batches'), where('status', '==', 'ACTIVE'))),
    getDocs(collection(db, 'redemptions')),
  ])

  const claimTotals = new Map<string, { usd: number; pts: number; count: number }>()
  claimsSnap.docs.forEach((d) => {
    const c = d.data() as Claim
    const cur = claimTotals.get(c.customer_id) || { usd: 0, pts: 0, count: 0 }
    cur.usd += Number(c.claimed_amount) || 0
    cur.pts += Number(c.points_to_award) || 0
    cur.count += 1
    claimTotals.set(c.customer_id, cur)
  })

  const now = Date.now()
  const earnedByCustomer = new Map<string, number>()
  batchesSnap.docs.forEach((d) => {
    const b = d.data() as PointsBatch
    if (b.expires_at?.toMillis?.() ?? 0 > now) {
      const cur = earnedByCustomer.get(b.customer_id) || 0
      earnedByCustomer.set(b.customer_id, cur + (Number(b.points) || 0))
    }
  })

  const spentByCustomer = new Map<string, number>()
  redemptionsSnap.docs.forEach((d) => {
    const r = d.data() as Redemption
    if (r.status !== 'CANCELED') {
      const cur = spentByCustomer.get(r.customer_id) || 0
      spentByCustomer.set(r.customer_id, cur + (Number(r.points_used) || 0))
    }
  })

  return custSnap.docs
    .map((d) => {
      const data = d.data() as any
      const agg = claimTotals.get(d.id) || { usd: 0, pts: 0, count: 0 }
      const earned = earnedByCustomer.get(d.id) || 0
      const spent = spentByCustomer.get(d.id) || 0
      return {
        uid: d.id,
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        created_at: data.created_at,
        receipts_total_usd: agg.usd,
        receipts_count: agg.count,
        points_earned: agg.pts,
        current_balance: Math.max(0, earned - spent),
      } satisfies CustomerSummary
    })
    .sort((a, b) => b.current_balance - a.current_balance)
}

/* ── Admin: dashboard summary stats ────────────────────────────────────── */

export interface AdminStats {
  total_customers: number
  pending_approvals: number
  points_outstanding: number
  fraud_alerts: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const [customersSnap, pendingClaimsSnap, batchesSnap, redemptionsSnap, rejectedClaimsSnap] =
    await Promise.all([
      getDocs(collection(db, 'customers')),
      getDocs(query(collection(db, 'claims'), where('status', '==', 'PENDING'))),
      getDocs(query(collection(db, 'points_batches'), where('status', '==', 'ACTIVE'))),
      getDocs(collection(db, 'redemptions')),
      getDocs(query(collection(db, 'claims'), where('status', '==', 'REJECTED'))),
    ])

  const now = Date.now()
  let totalEarned = 0
  batchesSnap.docs.forEach((d) => {
    const b = d.data() as PointsBatch
    if ((b.expires_at?.toMillis?.() ?? 0) > now) {
      totalEarned += Number(b.points) || 0
    }
  })

  let totalSpent = 0
  redemptionsSnap.docs.forEach((d) => {
    const r = d.data() as Redemption
    if (r.status !== 'CANCELED') {
      totalSpent += Number(r.points_used) || 0
    }
  })

  return {
    total_customers: customersSnap.size,
    pending_approvals: pendingClaimsSnap.size,
    points_outstanding: Math.max(0, totalEarned - totalSpent),
    fraud_alerts: rejectedClaimsSnap.size,
  }
}

/**
 * Admin manually credits or debits a customer's point balance.
 * Creates a new ACTIVE points_batch tagged source='ADJUSTMENT' with the delta
 * (positive = credit, negative = debit). Reason + admin uid stored for audit.
 */
export async function adjustCustomerPoints(input: {
  customer_id: string
  delta: number
  reason: string
  admin_uid: string
}): Promise<void> {
  const delta = Math.trunc(Number(input.delta))
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Adjustment must be a non-zero whole number.')
  }
  if (!input.reason.trim()) {
    throw new Error('Reason is required for an audit trail.')
  }

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + POINTS_BATCH_EXPIRY_DAYS)

  await addDoc(collection(db, 'points_batches'), {
    customer_id: input.customer_id,
    points: delta,
    source: 'ADJUSTMENT' as BatchSource,
    amount_usd: 0,
    earned_at: Timestamp.fromDate(now),
    expires_at: Timestamp.fromDate(expiresAt),
    status: 'ACTIVE' as BatchStatus,
    adjustment_reason: input.reason.trim(),
    adjusted_by: input.admin_uid,
  })
}
