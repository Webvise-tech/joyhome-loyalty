import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
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
export type RedemptionStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELED' | 'EXPIRED'

/** In-store pickup codes are valid for this many hours after creation. */
export const REDEMPTION_OTP_EXPIRY_HOURS = 48

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
  /**
   * SHA-256 hex of the 6-digit pickup code. The plaintext code is shown to
   * the customer once at submission and never persisted. The admin's "confirm
   * OTP" flow hashes the entered code and queries this field.
   */
  otp_hash?: string
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

/**
 * $1 = 0.1 point (i.e. $10 = 1 point), counted per whole dollar — cents are
 * ignored. Any receipt of $1 or more earns something; below $1 earns 0.
 * e.g. $5 → 0.5, $12.99 → 1.2, $0.99 → 0.
 */
export function pointsFor(amountUsd: number): number {
  if (!(amountUsd > 0)) return 0
  return roundPts(Math.floor(amountUsd) / 10)
}

/**
 * Snap a points value to 1-decimal granularity (the smallest unit is 0.1).
 * Use on every balance write/read so floating-point sums (0.1 + 0.2 …) don't
 * drift into long fractions.
 */
export function roundPts(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10
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
  if (points_to_award <= 0) {
    throw new Error('Receipt must be at least $1 to earn points.')
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
 *  - increments customers/{cid}.total_points by the awarded amount
 *
 * The counter on customers/{cid}.total_points is the source of truth the
 * redemption rule reads to enforce balance — see firestore.rules.
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

    const customerRef = doc(db, 'customers', claim.customer_id)
    const customerSnap = await tx.get(customerRef)
    if (!customerSnap.exists()) {
      throw new Error('Customer profile not found for this claim.')
    }
    const currentTotal = roundPts(
      Number((customerSnap.data() as { total_points?: number }).total_points) || 0,
    )
    const award = roundPts(Number(claim.points_to_award) || 0)

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

    tx.update(customerRef, { total_points: roundPts(currentTotal + award) })
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
  return roundPts(batches.reduce((sum, b) => sum + (b.points || 0), 0))
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
  return Math.max(0, roundPts(earned - spent))
}

function generateOtp(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100000 + (arr[0] % 900000))
}

/**
 * The moment an in-store pickup code stops being valid:
 * created_at + REDEMPTION_OTP_EXPIRY_HOURS. Null for non-IN_STORE or if the
 * created_at timestamp isn't readable yet (just-written serverTimestamp).
 */
export function redemptionOtpExpiresAt(r: Redemption): Date | null {
  if (r.method !== 'IN_STORE') return null
  const createdMs = r.created_at?.toMillis?.()
  if (!createdMs) return null
  return new Date(createdMs + REDEMPTION_OTP_EXPIRY_HOURS * 3600 * 1000)
}

/** True if the redemption is a PENDING in-store pickup whose OTP window has passed. */
export function isRedemptionOtpExpired(r: Redemption, nowMs = Date.now()): boolean {
  if (r.status !== 'PENDING' || r.method !== 'IN_STORE') return false
  const expiresAt = redemptionOtpExpiresAt(r)
  if (!expiresAt) return false
  return nowMs > expiresAt.getTime()
}

/**
 * Status to display in the UI. Returns 'EXPIRED' for a PENDING in-store pickup
 * whose 48h window has passed, even if the Firestore doc still says PENDING
 * (because the admin sweep hasn't run yet). For every other case, returns the
 * persisted status unchanged.
 */
export function effectiveRedemptionStatus(r: Redemption, nowMs = Date.now()): RedemptionStatus {
  return isRedemptionOtpExpired(r, nowMs) ? 'EXPIRED' : r.status
}

/**
 * SHA-256 hex digest of a string. Used to store only the hash of the redemption
 * OTP in Firestore — the plaintext is shown to the customer once and never
 * persisted server-side. Determinism (no salt) is required so the admin's
 * confirm flow can re-hash the entered code and look it up via `where()`.
 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const view = new Uint8Array(digest)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0')
  }
  return out
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

/**
 * Create a PENDING redemption for the signed-in customer.
 *
 * Runs inside a Firestore transaction that
 *   1) reads customers/{uid} and catalogue/{itemId},
 *   2) validates the item is active + priced + that the customer has the balance,
 *   3) decrements customers/{uid}.total_points,
 *   4) writes the redemption with server-anchored customer + catalogue fields.
 *
 * The same checks are mirrored in firestore.rules so a tampered client that
 * skips the decrement (or fakes the customer name / catalogue price / OTP shape)
 * is still rejected. Concurrent redemptions retry on contention, so two parallel
 * submissions cannot both pass the balance check against the same starting total.
 *
 * customer_name and customer_phone are NOT taken from the caller — they are read
 * from the customer profile inside the transaction. This stops a tampered client
 * from impersonating someone else on the cashier screen.
 */
export async function submitRedemption(input: {
  customer_id: string
  item: CatalogueItem
  method: RedemptionMethod
  delivery?: DeliveryAddress
}): Promise<{ id: string; otp_code?: string }> {
  // Client-side pre-check on delivery fields for UX. Rules + transaction are the gate.
  let deliveryFields: Record<string, string | null> | null = null
  if (input.method === 'ONLINE') {
    const d = input.delivery
    if (
      !d?.recipient_name?.trim() ||
      !d?.phone?.trim() ||
      !d?.street?.trim() ||
      !d?.city?.trim()
    ) {
      throw new Error('Recipient name, phone, street and city are required for delivery.')
    }
    const recipient = d.recipient_name.trim()
    const phone = d.phone.trim()
    const street = d.street.trim()
    const city = d.city.trim()
    const notes = d.notes?.trim() || ''
    if (recipient.length > 200) throw new Error('Recipient name is too long.')
    if (phone.length > 50) throw new Error('Phone number is too long.')
    if (street.length > 300) throw new Error('Street address is too long.')
    if (city.length > 100) throw new Error('City name is too long.')
    if (notes.length > 1000) throw new Error('Delivery notes are too long.')
    deliveryFields = {
      delivery_recipient_name: recipient,
      delivery_phone: phone,
      delivery_street: street,
      delivery_city: city,
      delivery_notes: notes || null,
      delivery_address: [recipient, phone, street, city, notes].filter(Boolean).join('\n'),
    }
  }

  // OTP generated once; the same value is used across transaction retries.
  // The plaintext is returned to the caller (shown once in the UI) and only
  // its SHA-256 hash is persisted to Firestore.
  const otp_code = input.method === 'IN_STORE' ? generateOtp() : undefined
  const otp_hash = otp_code !== undefined ? await sha256Hex(otp_code) : undefined

  let createdId = ''
  await runTransaction(db, async (tx) => {
    const customerRef = doc(db, 'customers', input.customer_id)
    const itemRef = doc(db, 'catalogue', input.item.id)

    // All reads must happen before any writes inside a Firestore transaction.
    const customerSnap = await tx.get(customerRef)
    const itemSnap = await tx.get(itemRef)

    if (!customerSnap.exists()) {
      throw new Error('Customer profile not found. Please complete sign-up first.')
    }
    if (!itemSnap.exists()) {
      throw new Error('This reward is no longer available.')
    }

    const customer = customerSnap.data() as {
      first_name?: string
      last_name?: string
      phone?: string
      total_points?: number
    }
    const item = itemSnap.data() as CatalogueItem

    if (!item.is_active) {
      throw new Error('This reward is no longer available.')
    }
    const cost = Math.trunc(Number(item.points_cost) || 0)
    if (cost <= 0) {
      throw new Error('This reward is mis-priced. Please contact support.')
    }
    const balance = roundPts(Number(customer.total_points) || 0)
    if (balance < cost) {
      throw new Error(
        `You don't have enough points: you have ${balance}, this reward costs ${cost}.`,
      )
    }

    // Atomic: decrement counter and create the redemption together.
    tx.update(customerRef, { total_points: roundPts(balance - cost) })

    const redemptionRef = doc(collection(db, 'redemptions'))
    const customerName = `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
    const payload: Record<string, unknown> = {
      customer_id: input.customer_id,
      customer_name: customerName,
      customer_phone: customer.phone ?? '',
      catalogue_item_id: input.item.id,
      catalogue_item_name: item.name,
      catalogue_item_photo: item.photo_url ?? null,
      points_used: cost,
      method: input.method,
      status: 'PENDING' as RedemptionStatus,
      created_at: serverTimestamp(),
    }
    if (otp_hash !== undefined) {
      payload.otp_hash = otp_hash
    }
    if (deliveryFields) {
      Object.assign(payload, deliveryFields)
    }

    tx.set(redemptionRef, payload)
    createdId = redemptionRef.id
  })

  return { id: createdId, otp_code }
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

  // The stored field is the SHA-256 hex of the OTP — hash the entered code
  // and look it up by hash so we never have to compare plaintext.
  const enteredHash = await sha256Hex(trimmed)
  const q = query(
    collection(db, 'redemptions'),
    where('otp_hash', '==', enteredHash),
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
    const freshData = fresh.data() as Redemption
    if (freshData.status !== 'PENDING') {
      throw new Error('Already confirmed by someone else.')
    }
    // 48h expiry: if the OTP window has passed, transition the redemption to
    // EXPIRED in this same transaction (so it leaves the pending queue and the
    // customer's history reflects what actually happened) and surface a clear
    // error to the cashier. Points are NOT refunded — expiry is "use it or lose it".
    if (isRedemptionOtpExpired(freshData)) {
      tx.update(ref, {
        status: 'EXPIRED' as RedemptionStatus,
        reviewed_by: adminUid,
        reviewed_at: serverTimestamp(),
      })
      throw new Error(
        `This pickup code has expired (codes are valid for ${REDEMPTION_OTP_EXPIRY_HOURS}h).`,
      )
    }
    tx.update(ref, {
      status: 'CONFIRMED' as RedemptionStatus,
      reviewed_by: adminUid,
      reviewed_at: serverTimestamp(),
    })
  })

  return { id: match.id, ...(data as Omit<Redemption, 'id'>) }
}

/**
 * Admin sweep: scan all PENDING IN_STORE redemptions and transition any whose
 * 48h window has passed to EXPIRED. Points are not refunded. Returns the count
 * of redemptions expired.
 *
 * Cheap to call — no-op if nothing is overdue. Intended to run at the start of
 * the admin Redemptions page load so the pending queue is always accurate.
 */
export async function expireOverduePendingInStoreRedemptions(
  adminUid: string,
): Promise<number> {
  const q = query(
    collection(db, 'redemptions'),
    where('status', '==', 'PENDING'),
    where('method', '==', 'IN_STORE'),
  )
  const snap = await getDocs(q)
  const now = Date.now()
  const overdue = snap.docs.filter((d) =>
    isRedemptionOtpExpired({ id: d.id, ...(d.data() as Omit<Redemption, 'id'>) }, now),
  )
  if (!overdue.length) return 0

  // Each transition runs in its own transaction so an admin-side cancel/confirm
  // racing with the sweep doesn't fail the whole batch.
  let expired = 0
  for (const d of overdue) {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'redemptions', d.id)
        const fresh = await tx.get(ref)
        if (!fresh.exists()) return
        const r = fresh.data() as Redemption
        if (r.status !== 'PENDING') return
        if (!isRedemptionOtpExpired(r)) return
        tx.update(ref, {
          status: 'EXPIRED' as RedemptionStatus,
          reviewed_by: adminUid,
          reviewed_at: serverTimestamp(),
        })
      })
      expired += 1
    } catch {
      // Skip and continue — a concurrent admin action transitioned this doc.
    }
  }
  return expired
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

/**
 * Cancel a redemption. Refunds the points to customers/{cid}.total_points
 * so the customer can spend them again. Idempotent: cancelling a CANCELED
 * redemption is a no-op (no double refund).
 */
export async function cancelRedemption(id: string, adminUid: string): Promise<void> {
  const ref = doc(db, 'redemptions', id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Redemption not found.')
    const r = snap.data() as Redemption
    if (r.status === 'CANCELED') return

    const customerRef = doc(db, 'customers', r.customer_id)
    const customerSnap = await tx.get(customerRef)
    const refund = Math.trunc(Number(r.points_used) || 0)

    tx.update(ref, {
      status: 'CANCELED' as RedemptionStatus,
      reviewed_by: adminUid,
      reviewed_at: serverTimestamp(),
    })

    if (customerSnap.exists() && refund > 0) {
      const currentTotal = roundPts(
        Number((customerSnap.data() as { total_points?: number }).total_points) || 0,
      )
      tx.update(customerRef, { total_points: roundPts(currentTotal + refund) })
    }
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
 * Atomic transaction:
 *  - creates a new ACTIVE points_batch tagged source='ADJUSTMENT' with the delta
 *    (positive = credit, negative = debit), reason + admin uid for audit
 *  - updates customers/{cid}.total_points by the same delta, clamped at >= 0
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

  const customerRef = doc(db, 'customers', input.customer_id)

  await runTransaction(db, async (tx) => {
    const customerSnap = await tx.get(customerRef)
    if (!customerSnap.exists()) {
      throw new Error('Customer not found.')
    }
    const currentTotal = roundPts(
      Number((customerSnap.data() as { total_points?: number }).total_points) || 0,
    )
    const newTotal = Math.max(0, roundPts(currentTotal + delta))

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + POINTS_BATCH_EXPIRY_DAYS)

    const batchRef = doc(collection(db, 'points_batches'))
    tx.set(batchRef, {
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
    tx.update(customerRef, { total_points: newTotal })
  })
}

/* ── Admin: backfill / repair the total_points counter ──────────────────── */

/**
 * Recompute one customer's `total_points` counter from the underlying ledger
 * (active non-expired batches minus non-canceled redemptions) and persist it.
 *
 * Run this once after deploying the balance-gated rules — existing customers
 * whose claims were approved before the counter started being maintained will
 * otherwise show 0 and be unable to redeem.
 */
export async function recalculateBalanceForCustomer(uid: string): Promise<number> {
  const [batchesSnap, redemptionsSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'points_batches'),
        where('customer_id', '==', uid),
        where('status', '==', 'ACTIVE'),
      ),
    ),
    getDocs(query(collection(db, 'redemptions'), where('customer_id', '==', uid))),
  ])

  const now = Date.now()
  let earned = 0
  batchesSnap.docs.forEach((d) => {
    const b = d.data() as PointsBatch
    if ((b.expires_at?.toMillis?.() ?? 0) > now) {
      earned += Number(b.points) || 0
    }
  })
  let spent = 0
  redemptionsSnap.docs.forEach((d) => {
    const r = d.data() as Redemption
    if (r.status !== 'CANCELED') {
      spent += Number(r.points_used) || 0
    }
  })
  const total = Math.max(0, roundPts(earned - spent))
  await updateDoc(doc(db, 'customers', uid), { total_points: total })
  return total
}

/** Recompute total_points for every customer. Admin-only. Use after the rules deploy. */
export async function recalculateAllBalances(): Promise<{ uid: string; total: number }[]> {
  const custSnap = await getDocs(collection(db, 'customers'))
  const results: { uid: string; total: number }[] = []
  for (const d of custSnap.docs) {
    const total = await recalculateBalanceForCustomer(d.id)
    results.push({ uid: d.id, total })
  }
  return results
}
