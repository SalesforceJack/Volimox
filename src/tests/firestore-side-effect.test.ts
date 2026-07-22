import crypto from "node:crypto"
import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { createFirestoreSideEffectStore } from "../lib/side-effect-machine.js"
import { createFollowUpSession, getFollowUpSession, saveFollowUpSession } from "../lib/follow-up-demo.js"
import { demoDb, getContactLeadsCollection, getDemoTenantId, getFollowUpSessionsCollection } from "../lib/firebase-admin.js"
import { persistContactLead, updateContactLeadNotification } from "../lib/contact-lead.js"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim()
if (!emulatorHost) {
  console.error("FIRESTORE_EMULATOR_HOST is required. Run this suite through the Firestore emulator.")
  process.exit(1)
}

process.env.VOLIMOX_FIREBASE_PROJECT_ID = "volimox-platform"
process.env.VOLIMOX_DEMO_TENANT_ID = `emulator-${crypto.randomUUID()}`

let passed = 0
let failed = 0

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (error) {
    console.error(`  ✗  ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

async function run() {
  const app = initializeApp({ projectId: "volimox-platform" }, `volimox-firestore-test-${crypto.randomUUID()}`)
  const db = getFirestore(app)
  const collection = db.collection("tenants").doc("emulator-test").collection("sideEffects")
  const store = createFirestoreSideEffectStore(db, collection)
  const createdIds: string[] = []

  try {
    await test("Firestore transaction allows only one concurrent claim", async () => {
      const id = `concurrent-${crypto.randomUUID()}`
      createdIds.push(id)
      const [first, second] = await Promise.all([
        store.claim(id, "test-op"),
        store.claim(id, "test-op"),
      ])
      assert([first, second].filter((result) => result.claimed).length === 1, "exactly one transaction should claim the record")
      assert([first, second].filter((result) => !result.claimed && result.reason === "active_lock").length === 1, "the losing transaction should see active_lock")
    })

    await test("Firestore stale dispatch transitions to uncertain", async () => {
      const id = `stale-${crypto.randomUUID()}`
      createdIds.push(id)
      const first = await store.claim(id, "test-op", { dispatchTimeoutMs: 10 })
      assert(first.claimed && Boolean(first.ownerId), "initial claim should succeed")
      await store.markDispatching(id, first.ownerId)
      await new Promise((resolve) => setTimeout(resolve, 30))
      const stale = await store.claim(id, "test-op", { dispatchTimeoutMs: 10 })
      assert(!stale.claimed && stale.reason === "terminal", "stale dispatch should not be reclaimed")
      assert(stale.record?.state === "uncertain_after_dispatch", "stale dispatch should be persisted as uncertain")
    })

    await test("concurrent session saves preserve completed state and provider IDs", async () => {
      const session = createFollowUpSession({
        fullName: "Test User",
        email: "test@example.com",
        phone: "+12025550123",
        companyName: "Test Company",
        businessType: "Plumbing",
        consentSms: true,
        consentEmail: true,
        consentCall: true,
        sessionId: `session-${crypto.randomUUID()}`,
      })
      await saveFollowUpSession(session)
      const first = structuredClone(session)
      const second = structuredClone(session)
      first.initialCallState = "dispatching"
      first.twilioCallSid = "CA-stale"
      first.scheduledMessageSid = "SM-stale"
      first.scheduledMessageStatus = "scheduled"
      second.status = "completed"
      second.initialCallState = "completed"
      second.twilioCallSid = "CA-authoritative"
      await Promise.all([saveFollowUpSession(first), saveFollowUpSession(second)])
      const stored = await getFollowUpSession(session.id)
      assert(stored?.status === "completed", "completed status should win concurrent stale save")
      assert(stored?.initialCallState === "completed", "completed operation state should win")
      assert(stored?.twilioCallSid === "CA-authoritative" || stored?.twilioCallSid === "CA-stale", "provider SID should not be deleted")
      assert(Boolean(stored?.scheduledMessageSid), "scheduled SID should survive a concurrent save")
    })

    await test("contact lead remains stored when notification fails", async () => {
      const db = demoDb()
      assert(Boolean(db), "emulator Firestore should initialize")
      const lead = {
        fullName: "Lead User",
        email: "lead@example.com",
        companyName: "Lead Company",
        industry: "Plumbing",
        projectScope: "Missed-call recovery",
        estimatedVolume: "50",
      }
      const { leadId } = await persistContactLead(db!, lead)
      await updateContactLeadNotification(db!, leadId, "failed")
      const stored = await getContactLeadsCollection(db!, getDemoTenantId()).doc(leadId).get()
      assert(stored.exists, "lead document must remain after notification failure")
      assert(stored.data()?.notificationStatus === "failed", "notification failure must be recorded")
    })

    await test("duplicate inbound claims for one MessageSid allow one processor", async () => {
      const id = `inbound-${crypto.randomUUID()}`
      const [first, second] = await Promise.all([
        store.claim(id, "inbound_sms", { sessionId: "session-1" }),
        store.claim(id, "inbound_sms", { sessionId: "session-1" }),
      ])
      assert([first, second].filter((item) => item.claimed).length === 1, "one MessageSid claim should win")
      assert([first, second].filter((item) => !item.claimed && item.reason === "active_lock").length === 1, "duplicate MessageSid should be blocked")
    })
  } finally {
    await Promise.all(createdIds.map((id) => collection.doc(id).delete()))
    await deleteApp(app)
  }

  console.log(`\n${passed + failed} Firestore tests: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
