import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

export type ParsedServiceAccount = {
  type?: string
  project_id?: string
  client_email?: string
  private_key?: string
  client_id?: string
}

function tryParseJson(value: string): ParsedServiceAccount | null {
  try {
    return JSON.parse(value) as ParsedServiceAccount
  } catch {
    return null
  }
}

export function parseServiceAccountKey(raw: string | undefined): ParsedServiceAccount | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null

  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim()
  }

  let parsed = tryParseJson(s)
  if (!parsed || typeof parsed !== "object") {
    try {
      const decoded = Buffer.from(s, "base64").toString("utf8")
      parsed = tryParseJson(decoded)
    } catch {
      parsed = null
    }
  }

  if (!parsed || typeof parsed !== "object") return null
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n")
  }
  return parsed
}

export const VOLIMOX_REQUIRED_PROJECT_ID = "volimox-platform"

export function getExpectedProjectId(): string {
  const envProjectId = process.env.VOLIMOX_FIREBASE_PROJECT_ID?.trim()
  if (envProjectId && envProjectId !== VOLIMOX_REQUIRED_PROJECT_ID) {
    throw new Error(`VOLIMOX_FIREBASE_PROJECT_ID "${envProjectId}" is invalid. Volimox is hard-bound to "${VOLIMOX_REQUIRED_PROJECT_ID}".`)
  }
  return VOLIMOX_REQUIRED_PROJECT_ID
}

export function getDemoTenantId(): string {
  return process.env.VOLIMOX_DEMO_TENANT_ID?.trim() || "volimox-demo"
}

export function isProductionFirebaseRequired(): boolean {
  return process.env.NODE_ENV === "production"
}

function serviceAccount(): ParsedServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw?.trim()) return null
  const account = parseServiceAccountKey(raw)
  if (!account || !account.private_key || !account.client_email) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is invalid or missing required credentials.")
  }

  if (!account.project_id || typeof account.project_id !== "string" || !account.project_id.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing a valid project_id.")
  }

  const expected = getExpectedProjectId()
  const pid = account.project_id.trim()

  if (pid === "volimox-crm-dispatcher") {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY project_id "${pid}" (Proton) is explicitly rejected by Volimox.`)
  }

  if (pid !== expected) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY project_id "${pid}" does not match expected Volimox project ID "${expected}". Connection rejected.`)
  }

  return account
}

let _volimoxDb: Firestore | null = null

export function demoDb(): Firestore | null {
  if (_volimoxDb) return _volimoxDb

  const account = serviceAccount()
  const emulatorMode = Boolean(process.env.FIRESTORE_EMULATOR_HOST?.trim()) && process.env.NODE_ENV !== "production"
  if (!account && !emulatorMode) return null

  const expectedProjectId = getExpectedProjectId()
  const appName = `volimox-app-${expectedProjectId}`
  const existingApp = getApps().find((app) => app.name === appName)

  const app = existingApp || initializeApp(
    account
      ? {
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key,
          }),
          projectId: account.project_id || expectedProjectId,
        }
      : { projectId: expectedProjectId },
    appName,
  )

  const databaseId = process.env.VOLIMOX_FIRESTORE_DATABASE_ID?.trim()
  const lowerDbId = databaseId?.toLowerCase()
  const db = !databaseId || lowerDbId === "(default)" || lowerDbId === "default"
    ? getFirestore(app)
    : getFirestore(app, databaseId)

  try {
    db.settings({ ignoreUndefinedProperties: true })
  } catch {
    // Settings already applied
  }

  _volimoxDb = db
  return db
}

export function requireDemoDb(): Firestore {
  const db = demoDb()
  if (!db) {
    throw new Error("Volimox Firestore database is not configured or unavailable.")
  }
  return db
}

export function getTenantDocRef(db: Firestore, tenantId?: string) {
  const id = tenantId?.trim() || getDemoTenantId()
  return db.collection("tenants").doc(id)
}

export function getDemoLeadsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("demoLeads")
}

export function getDemoAgentLeadsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("demoAgentLeads")
}

export function getDemoReservationsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("demoReservations")
}

export function getFollowUpSessionsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("followUpDemoSessions")
}

export function getInboundSmsClaimsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("inboundSmsClaims")
}

export function getSideEffectsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("sideEffects")
}

export function getContactLeadsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("contactLeads")
}

export function getRateLimitsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("rateLimits")
}

/**
 * TTL Deployment Checklist
 *
 * Firebase TTL policies must be configured for the following collection groups
 * to enable automatic document cleanup. Adding expiresAtServer fields alone
 * does NOT activate deletion.
 *
 * Required TTL policies (field: expiresAtServer):
 *   - tenants/{tenantId}/rateLimits          — auto-delete expired rate limit windows
 *   - tenants/{tenantId}/inboundSmsClaims    — auto-delete processed SMS claims
 *   - tenants/{tenantId}/sideEffects         — auto-delete completed side-effect records
 *   - tenants/{tenantId}/followUpDemoSessions — auto-delete expired demo sessions
 *   - tenants/{tenantId}/demoLeads           — auto-delete aged demo leads (90 days)
 *   - tenants/{tenantId}/demoAgentLeads      — auto-delete aged agent leads (90 days)
 *   - tenants/{tenantId}/demoReservations    — auto-delete aged reservations (90 days)
 *   - tenants/{tenantId}/contactLeads        — auto-delete aged contact submissions (90 days)
 *
 * These policies are NOT currently enabled. They must be configured via the
 * Firebase Console or gcloud CLI before TTL deletion is active.
 *
 * Example gcloud command:
 *   gcloud firestore fields ttls update expiresAtServer \
 *     --collection-group=rateLimits \
 *     --project=volimox-platform
 */
