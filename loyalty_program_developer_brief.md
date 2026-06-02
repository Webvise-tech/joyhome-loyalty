# Loyalty Program — Developer Technical Brief

**Web Application — Complete Developer Brief**
Home Decor & Kitchenware Shop — Lebanon

---

## 1. Project Overview

Build a Progressive Web App (PWA) loyalty program accessible at a dedicated subdomain (e.g. `loyalty.yourbrand.com`). The platform serves two types of users: customers and admins (shop owners). It connects to the existing Shopify e-commerce store and supports both online and physical in-store purchases.

> **Note:** This is a PWA — not a native mobile app. No App Store submission required. Customers access it via browser on any device. They can add it to their phone home screen as an icon.

| Item | Detail |
|---|---|
| Platform | Progressive Web App (PWA) |
| Domain | loyalty.yourbrand.com (subdomain of existing domain) |
| E-commerce integration | Shopify (via Webhooks) |
| Notifications | WhatsApp via Twilio API (outbound only) |
| Database | To be hosted on backend (Base44 or custom) |
| Admin users | 2 (owner + brother — simple role) |
| Target users | 2,000–10,000 customers |
| Language | Arabic + English (bilingual interface recommended) |

---

## 2. Points Logic & Rules

### 2.1 Earning Points

| Rule | Detail |
|---|---|
| Base rate | $10 spent = 1 point (applies to both online and in-store) |
| Online purchases | Points calculated automatically via Shopify webhook |
| In-store purchases | Customer enters receipt total manually in app — requires admin approval |
| Rounding | Round down to nearest whole point (e.g. $47 = 4 pts) |
| Minimum claim | Receipt total must be at least $10 to earn any points |

### 2.2 Points Expiry

| Rule | Detail |
|---|---|
| Expiry window | 2 months (60 days) from the date each batch of points was earned |
| Batch logic | Each purchase creates a separate dated batch of points |
| Reminder | WhatsApp message sent to customer 14 days before expiry |
| On expiry | Points silently removed from balance — no further notification |
| Clock reset | Expiry resets only if new points are earned before expiry date |

### 2.3 Fraud Protection Rules

| Rule | Detail |
|---|---|
| In-store claims | All in-store claims require manual admin approval before points are credited |
| Duplicate detection | System flags if same customer submits 2 claims within 30 minutes |
| Amount cap | System flags if claimed amount seems unusually high (define threshold) |
| One receipt per claim | System tracks claim timestamps to prevent re-submission of same receipt |
| Admin override | Admin can reject any claim with a reason (logged in system) |

---

## 3. User Flows

### 3.1 Registration Flow

- Customer opens `loyalty.yourbrand.com` in any browser
- Registration screen shown on first visit (no account detected)
- Customer fills in: First Name, Last Name, Phone Number, Date of Birth
- Phone number is used as the unique customer identifier
- OTP sent via WhatsApp to verify phone number
- On successful verification: account created, balance = 0, expiry clock starts
- Customer lands on main dashboard

> **Note:** Phone number = primary key for each customer. It is also the identifier used to send WhatsApp notifications.

### 3.2 Main Dashboard (Customer View)

After login, the customer sees the following sections on their dashboard:

| Section | What Customer Sees | Details |
|---|---|---|
| Catalogue | Grid of reward items with point prices | Manually updated by admin each week. Items shown with name, photo, and points cost. |
| Point Balance | Total points available | Shows current balance + expiry date of oldest batch |
| Purchase History | List of all past orders | Each entry shows: date, purchase type (online/in-store), amount, points earned |
| Redemptions | List of all past redemptions | Shows: date, item redeemed, points used, delivery method |
| Redeem Points | Entry point to redeem | Leads to redemption flow (see Section 3.5) |

### 3.3 Earning Points Flow — Online (Shopify)

- Customer completes checkout on Shopify store
- Shopify fires a webhook to the loyalty backend with order total and customer phone number
- Backend calculates points: `floor(order_total / 10)`
- Points added instantly to customer balance with timestamp
- WhatsApp notification sent: *"You earned X points! New balance: Y pts"*

> **Note:** Shopify customer phone number must match loyalty account phone number. Advise customer to use the same number when registering on Shopify.

### 3.4 Earning Points Flow — In-Store

- Customer completes purchase at physical counter
- Customer opens the loyalty app on their phone
- Customer taps **Claim Points** and enters the receipt total in USD
- Claim is submitted with status: `PENDING`
- Admin receives a push notification in the admin panel: *"New claim from [Name] — $XX"*
- Admin reviews and taps **Approve** or **Reject**
- If approved: points calculated and added to balance, WhatsApp sent to customer
- If rejected: customer notified via WhatsApp with reason

> **Note:** Admin approval is the fraud control gate for all in-store claims. No points are credited before admin approval.

### 3.5 Redemption Flow

- Customer taps **Redeem Points** from dashboard
- Customer browses the weekly catalogue (items priced in points)
- Customer selects desired item
- System checks customer has sufficient points — if not, shows deficit
- Customer is asked to choose redemption method: **In-Store Pickup** or **Online Delivery**

#### In-Store Pickup

- System generates a unique OTP code (6 digits, valid for 10 minutes)
- Customer shows code to cashier at counter
- Cashier enters code in admin panel to confirm redemption
- Points deducted from balance immediately upon confirmation
- WhatsApp sent: *"You used X pts. Remaining balance: Y pts"*

#### Online Delivery

- A delivery form appears in the app
- Customer fills in: full name, address, phone, any delivery notes
- Customer confirms order — points deducted immediately
- Admin receives notification of new online redemption order
- Admin processes and ships the item
- WhatsApp sent to customer: *"Your redemption order has been confirmed!"*

---

## 4. Rewards Catalogue

The catalogue is the public-facing list of items customers can redeem with their points. It serves two purposes: rewarding loyal customers and building curiosity among new visitors who see point-priced items on the website.

| Property | Detail |
|---|---|
| Updated by | Admin only — manual upload each week |
| Fields per item | Item name, photo, points cost, stock quantity, category |
| Availability | Visible in the loyalty app AND on the public Shopify rewards page |
| Pricing | Points only (no USD prices shown on this catalogue) |
| Stock control | Admin can mark items as out of stock or remove them |
| Curiosity mechanic | New visitors on Shopify see point prices and wonder how to earn — this drives sign-ups |

> **Note:** Items in the catalogue should be slow-moving or older inventory from the shop. This helps clear stock while rewarding loyal customers. Suggested starting point: items under $20 retail value.

---

## 5. Admin Panel

The admin panel is accessible only to the two shop owners. It is a separate view within the same web app, protected by a simple login with role = `admin`.

| Section | What Admin Sees / Can Do |
|---|---|
| All Customers | Full list: name, phone, current points balance, registration date, last activity |
| Pending Approvals | In-store claims waiting for approval — shows customer name, claimed amount, timestamp. Tap to Approve or Reject. |
| Top Customers | Ranked list by points balance or total spend — useful for VIP identification |
| Fraud Alerts | Flagged claims: duplicates within 30 mins, unusually high amounts, suspicious patterns |
| Catalogue Management | Upload/edit/remove weekly reward items with photos and point prices |
| Redemption Orders | List of all pending online delivery redemptions to be fulfilled |
| Customer Detail | Click any customer to see full history: purchases, points earned, redemptions used |

---

## 6. WhatsApp Notifications (Twilio)

All customer notifications are sent via a dedicated Twilio WhatsApp number. This is a separate number from the shop's main WhatsApp Business account. Customers cannot reply to this number.

| Trigger | Message Content |
|---|---|
| Registration complete | "Welcome to [Brand] Rewards! Your account is active. Start earning 1 pt for every $10 you spend." |
| Online purchase — points added | "You earned X points from your online order! Balance: Y pts. Expires: [date]" |
| In-store claim approved | "Your claim of $XX was approved. You earned X points! Balance: Y pts." |
| In-store claim rejected | "Your claim of $XX was not approved. Please contact us if you think this is an error." |
| Redemption confirmed (in-store) | "You used X pts. Remaining balance: Y pts. Enjoy your item!" |
| Redemption confirmed (online) | "Your reward order is confirmed and will be delivered soon!" |
| Points expiry reminder | "Reminder: X pts in your account expire on [date]. Redeem them before they expire!" |

---

## 7. Recommended Tech Stack

> This is a recommended stack. Developer is free to propose alternatives as long as the functional requirements are met.

| Layer | Recommended Tool | Why |
|---|---|---|
| Frontend (PWA) | React or Vue.js | PWA-ready, fast, easy to deploy as subdomain |
| Backend / API | Node.js (Express) or Base44 | Handles webhooks, logic, approvals |
| Database | PostgreSQL or Base44 built-in | Stores customers, points batches, claims, catalogue |
| Shopify integration | Shopify Webhooks (orders/create) | Auto-fires when online order is placed |
| WhatsApp notifications | Twilio WhatsApp API | Outbound-only, US number, cheap at low volume |
| Authentication | Phone number + OTP (WhatsApp-based) | No password needed — frictionless for customers |
| Admin auth | Email + password (simple) | Only 2 admin users |
| Hosting | Vercel / Railway / Render (free tier) | PWA + backend, low cost |
| Domain | Subdomain of existing domain | loyalty.yourbrand.com — zero extra cost |

---

## 8. Core Database Entities

The following entities are the minimum required for the system. The developer may normalize or extend as needed.

### 8.1 Customer

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| first_name | String | |
| last_name | String | |
| phone | String | Unique — used as login identifier |
| date_of_birth | Date | |
| created_at | Timestamp | Registration date — expiry clock reference |
| total_points | Integer | Computed from points_batches |

### 8.2 Points Batch

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | FK to Customer |
| points | Integer | Points earned in this batch |
| source | Enum | `ONLINE` or `IN_STORE` |
| amount_usd | Decimal | Receipt amount that generated these points |
| earned_at | Timestamp | When points were credited |
| expires_at | Timestamp | earned_at + 60 days |
| status | Enum | `ACTIVE` or `EXPIRED` |

### 8.3 In-Store Claim

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | FK to Customer |
| claimed_amount | Decimal | Amount customer entered |
| points_to_award | Integer | Calculated: `floor(claimed_amount / 10)` |
| submitted_at | Timestamp | |
| status | Enum | `PENDING`, `APPROVED`, `REJECTED` |
| reviewed_by | String | Admin name who acted on it |
| reviewed_at | Timestamp | |

### 8.4 Redemption

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | FK to Customer |
| catalogue_item_id | UUID | FK to CatalogueItem |
| points_used | Integer | Points cost of item at time of redemption |
| method | Enum | `IN_STORE` or `ONLINE` |
| delivery_address | Text | Only for ONLINE method |
| otp_code | String | Only for IN_STORE — 6-digit, expires in 10 min |
| status | Enum | `PENDING`, `CONFIRMED`, `DELIVERED` |
| created_at | Timestamp | |

### 8.5 Catalogue Item

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | |
| photo_url | String | |
| points_cost | Integer | Price in points |
| category | String | Optional grouping |
| stock_qty | Integer | 0 = out of stock |
| is_active | Boolean | Admin can hide without deleting |
| added_at | Timestamp | |

---

## 9. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| Mobile-first design | App must be fully usable on a phone screen — primary use case is checkout |
| PWA installable | Must pass PWA installability checklist — customers can add to home screen |
| Performance | App must load in under 3 seconds on a 4G connection in Lebanon |
| Bilingual | Support Arabic (RTL) and English — language toggle in settings |
| Offline fallback | Show cached balance and history if offline — sync on reconnect |
| Security | Phone OTP for customer login. Admin has email + password. All API endpoints authenticated. |
| Data privacy | Customer data (name, phone, DOB) must not be exposed publicly |
| Admin notifications | Admin panel must show a badge/count for pending approvals in real time |

---

## 10. Public Rewards Page (Shopify Integration)

In addition to the PWA, a public rewards catalogue page must be embedded on the Shopify website. This is a read-only page showing the current catalogue items priced in points — visible to anyone who visits the website, including non-members.

- URL: `yourbrand.com/rewards` (on Shopify)
- Shows all active catalogue items with point prices
- No USD pricing shown — points only
- A **"Join the loyalty program"** CTA button links to `loyalty.yourbrand.com`
- This page drives curiosity and new sign-ups from website visitors

> **Note:** This page is the main acquisition tool for the program. Visitors see items priced in points, get curious about what points are, and click to join.

---

## 11. Deliverables Checklist

| Deliverable | Description |
|---|---|
| Customer PWA | Full loyalty app at loyalty.yourbrand.com — registration, dashboard, claim, redeem |
| Admin Panel | Protected admin view — approvals, customer list, catalogue management, fraud alerts |
| Shopify Webhook | Backend endpoint that receives Shopify orders and auto-credits points |
| Twilio Integration | WhatsApp notification system for all 7 trigger events listed in Section 6 |
| Public Rewards Page | Read-only catalogue page on Shopify with join CTA |
| Database | All 5 entities from Section 8 with proper indexing |
| OTP System | Phone verification at registration + redemption OTP codes |
| Points Expiry Cron Job | Daily background job that checks and expires overdue point batches |
| Deployment | Hosted on reliable free/low-cost platform with custom subdomain configured |

---

*End of Brief — Version 1.0*
*Questions? Contact the shop owner directly.*
