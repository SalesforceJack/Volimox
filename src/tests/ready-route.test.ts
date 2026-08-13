import assert from "node:assert/strict"
import { createReadinessHandler, FIRESTORE_READINESS_TIMEOUT_MS, type ReadinessDb } from "../lib/readiness.js"

function request(): Request {
  return new Request("http://localhost/api/ready", { headers: { "x-request-id": "req-readiness-test" } })
}

function database(get: () => Promise<unknown>): ReadinessDb {
  return {
    collection: () => ({
      doc: () => ({ get }),
    }),
  }
}

async function run() {
  const success = createReadinessHandler({
    service: "volimox",
    getDb: () => database(async () => ({ exists: true })),
    timeoutMs: 25,
  })
  const successResponse = await success(request())
  assert.equal(successResponse.status, 200)
  assert.equal((await successResponse.json()).checks.firestore, "ready")

  const rejection = createReadinessHandler({
    service: "volimox",
    getDb: () => database(async () => { throw new Error("firestore unavailable") }),
    timeoutMs: 25,
  })
  const rejectionResponse = await rejection(request())
  assert.equal(rejectionResponse.status, 503)
  assert.equal((await rejectionResponse.json()).checks.firestore, "unavailable")

  const timeout = createReadinessHandler({
    service: "volimox",
    getDb: () => database(() => new Promise(() => undefined)),
    timeoutMs: 10,
  })
  const startedAt = performance.now()
  const timeoutResponse = await timeout(request())
  const elapsedMs = performance.now() - startedAt
  assert.equal(timeoutResponse.status, 503)
  assert.equal((await timeoutResponse.json()).status, "degraded")
  assert.ok(elapsedMs < 1000, `readiness timeout took ${elapsedMs}ms`)
  assert.equal(FIRESTORE_READINESS_TIMEOUT_MS, 2500)

  console.log("Readiness tests: Firestore success, rejection, and bounded timeout passed")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
