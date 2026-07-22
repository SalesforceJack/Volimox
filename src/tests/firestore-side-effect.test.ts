import crypto from "node:crypto"
import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { createFirestoreSideEffectStore } from "../lib/side-effect-machine.js"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim()
if (!emulatorHost) {
  console.error("FIRESTORE_EMULATOR_HOST is required. Run this suite through the Firestore emulator.")
  process.exit(1)
}

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
