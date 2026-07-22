import crypto from "node:crypto"

/**
 * Volimox — Side-effect machine acceptance tests
 *
 * Tests import real production modules via InMemorySideEffectStore.
 * No mocking of the module under test. No Firestore. No provider calls.
 *
 * Run: npx tsx src/tests/side-effect-machine.test.ts
 */

// ---------------------------------------------------------------------------
// Imports — real production code
// ---------------------------------------------------------------------------

import {
  executeSideEffect,
  createSideEffectStore,
  InMemorySideEffectStore,
  ProviderRejectedError,
  SideEffectOwnershipError,
  SideEffectPreflightError,
  SideEffectPersistenceUnavailableError,
  deriveSideEffectId,
  isTransientProviderHttpStatus,
  type SideEffectOutcome,
} from "../lib/side-effect-machine.js"
import { canReleaseProviderSyncLease, providerSyncBlockReason } from "../lib/provider-sync-lease.js"
import { hashRateLimitKey } from "../lib/durable-rate-limit.js"
import { isDefinitiveSmtpRejection } from "../lib/mail.js"
import { validateTwilioSchedulingConfig } from "../lib/twilio-demo.js"
import { createFollowUpSession, projectSideEffectRecord } from "../lib/follow-up-demo.js"
import { deriveContactLeadEffectId } from "../lib/contact-idempotency.js"
import { withinDemoRateLimit } from "../lib/demo-rate-limit.js"

// ---------------------------------------------------------------------------
// Minimal test harness (no external framework)
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const failures: string[] = []

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗  ${name}\n     ${msg}`)
    failures.push(name)
    failed++
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  return new InMemorySideEffectStore()
}

let callCount: number

function dispatchOnce<T>(value: T, providerId = "sid-123") {
  return async () => {
    callCount++
    return { value, providerId }
  }
}

function dispatchRejects(reasonCode: string) {
  return async () => {
    callCount++
    throw new ProviderRejectedError(reasonCode)
  }
}

function dispatchErrors(msg: string) {
  return async () => {
    callCount++
    throw new Error(msg)
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

async function runTests() {
  console.log("\nSide-effect machine tests\n")

  // 1. First call executes and returns the value
  await test("first call executes provider and returns executed outcome", async () => {
    const store = makeStore()
    callCount = 0
    const id = deriveSideEffectId("test", "first-call")
    const outcome = await executeSideEffect(store, id, "test-op", dispatchOnce({ ok: true }))
    assert(outcome.kind === "executed", `expected executed, got ${outcome.kind}`)
    assert((outcome as any).value?.ok === true, "value should be { ok: true }")
    assert((outcome as any).providerId === "sid-123", "providerId should be sid-123")
    assert(callCount === 1, `dispatch called ${callCount} times, expected 1`)
  })

  // 2. Second call with same ID returns already_completed — provider NOT called again
  await test("second call with same ID returns already_completed without calling provider", async () => {
    const store = makeStore()
    callCount = 0
    const id = deriveSideEffectId("test", "idempotent")
    await executeSideEffect(store, id, "test-op", dispatchOnce({ ok: true }))
    const second = await executeSideEffect(store, id, "test-op", dispatchOnce({ ok: true }))
    assert(second.kind === "already_completed", `expected already_completed, got ${second.kind}`)
    assert(callCount === 1, `dispatch called ${callCount} times, expected 1`)
  })

  // 3. ProviderRejectedError → provider_rejected outcome, terminally blocks retries
  await test("ProviderRejectedError produces provider_rejected and blocks all retries", async () => {
    const store = makeStore()
    callCount = 0
    const id = deriveSideEffectId("test", "provider-rejected")
    const first = await executeSideEffect(store, id, "test-op", dispatchRejects("not_configured"))
    assert(first.kind === "provider_rejected", `expected provider_rejected, got ${first.kind}`)
    assert(callCount === 1, "dispatch should be called once")

    // Second attempt — must NOT call provider again (provider_rejected is terminal)
    const second = await executeSideEffect(store, id, "test-op", dispatchRejects("not_configured"))
    assert(second.kind === "provider_rejected", `expected provider_rejected on retry, got ${second.kind}`)
    assert(callCount === 1, `dispatch was called ${callCount} times — should still be 1`)
  })

  // 4. Generic error → uncertain outcome
  await test("generic dispatch error produces uncertain outcome", async () => {
    const store = makeStore()
    callCount = 0
    const id = deriveSideEffectId("test", "uncertain")
    const outcome = await executeSideEffect(store, id, "test-op", dispatchErrors("network timeout"))
    assert(outcome.kind === "uncertain", `expected uncertain, got ${outcome.kind}`)
    assert(callCount === 1, "dispatch should be called once")
  })

  // 5. markDispatching failure (simulated) → persistence_unavailable, provider NOT called
  await test("if markDispatching throws, outcome is persistence_unavailable and provider is not called", async () => {
    const store = makeStore()
    // Inject markDispatching failure
    store.markDispatching = async () => { throw new Error("Firestore write failed") }
    callCount = 0
    const id = deriveSideEffectId("test", "dispatching-fail")
    const outcome = await executeSideEffect(store, id, "test-op", dispatchOnce({ ok: true }))
    assert(outcome.kind === "persistence_unavailable", `expected persistence_unavailable, got ${outcome.kind}`)
    assert(callCount === 0, `dispatch was called ${callCount} times — should be 0`)
  })

  // 6. markCompleted failure → reconciliation_required (value was sent, state not saved)
  await test("if markCompleted throws, outcome is reconciliation_required", async () => {
    const store = makeStore()
    store.markCompleted = async () => { throw new Error("Firestore write failed") }
    callCount = 0
    const id = deriveSideEffectId("test", "completed-fail")
    const outcome = await executeSideEffect(store, id, "test-op", dispatchOnce({ ok: true }))
    assert(outcome.kind === "reconciliation_required", `expected reconciliation_required, got ${outcome.kind}`)
    assert(callCount === 1, "dispatch should have been called once despite persistence failure")
  })

  // 7. deriveSideEffectId is deterministic
  await test("deriveSideEffectId is deterministic for same parts", () => {
    const a = deriveSideEffectId("session-abc", "initial-call")
    const b = deriveSideEffectId("session-abc", "initial-call")
    assert(a === b, `expected same ID, got ${a} vs ${b}`)
    assert(a.length === 32, `expected 32-char hex ID, got length ${a.length}`)
  })

  // 8. deriveSideEffectId produces different IDs for different operation types
  await test("deriveSideEffectId produces different IDs for different operation types", () => {
    const call = deriveSideEffectId("session-abc", "initial-call")
    const email = deriveSideEffectId("session-abc", "initial-email")
    assert(call !== email, "IDs for different operations must differ")
  })

  // 9. Concurrent claim: two claims on the same fresh ID — only first wins
  await test("concurrent claim: first wins, second is rejected as active_lock", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "concurrent")
    const [r1, r2] = await Promise.all([
      store.claim(id, "test-op"),
      store.claim(id, "test-op"),
    ])
    const wins = [r1, r2].filter(r => r.claimed).length
    const rejects = [r1, r2].filter(r => !r.claimed).length
    assert(wins === 1, `expected 1 winner, got ${wins}`)
    assert(rejects === 1, `expected 1 rejection, got ${rejects}`)
  })

  // 10. providerId is stored and returned in executed outcome
  await test("providerId is carried through to executed outcome", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "provider-id")
    const outcome = await executeSideEffect(store, id, "test-op", async () => ({
      value: { msg: "hello" },
      providerId: "twilio-CA123",
    }))
    assert(outcome.kind === "executed", `expected executed, got ${outcome.kind}`)
    assert((outcome as Extract<SideEffectOutcome<unknown>, { kind: "executed" }>).providerId === "twilio-CA123", "providerId not carried through")
  })

  await test("preflight failure records a retryable failure without calling provider", async () => {
    const store = makeStore()
    callCount = 0
    const id = deriveSideEffectId("test", "preflight")
    const outcome = await executeSideEffect(
      store,
      id,
      "test-op",
      dispatchOnce({ ok: true }),
      { preflight: () => { throw new SideEffectPreflightError("not_configured") } },
    )
    const record = await store.get(id)
    assert(outcome.kind === "preflight_failed", `expected preflight_failed, got ${outcome.kind}`)
    assert(callCount === 0, `dispatch was called ${callCount} times, expected 0`)
    assert(record?.state === "failed_before_dispatch", `expected failed_before_dispatch, got ${record?.state}`)
  })

  await test("call operations persist the started completion state", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "started-state")
    const outcome = await executeSideEffect(
      store,
      id,
      "test-call",
      dispatchOnce({ ok: true }),
      { completedState: "started" },
    )
    const record = await store.get(id)
    assert(outcome.kind === "executed", `expected executed, got ${outcome.kind}`)
    assert(record?.state === "started", `expected started, got ${record?.state}`)
  })

  await test("fresh claiming records cannot be reclaimed", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "fresh-claim")
    const first = await store.claim(id, "test-op", { claimTimeoutMs: 60_000 })
    const second = await store.claim(id, "test-op", { claimTimeoutMs: 60_000 })
    assert(first.claimed, "first claim should succeed")
    assert(!second.claimed && second.reason === "active_lock", "fresh claim should remain locked")
  })

  await test("stale claim can be reclaimed and the old owner cannot dispatch", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "stale-owner")
    const originalNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      const first = await store.claim(id, "test-op", { claimTimeoutMs: 60_000 })
      now += 60_001
      const second = await store.claim(id, "test-op", { claimTimeoutMs: 60_000 })
      assert(first.claimed && Boolean(first.ownerId), "first owner should be assigned")
      assert(second.claimed && Boolean(second.ownerId), "stale claim should be reclaimed")

      let ownershipRejected = false
      try {
        await store.markDispatching(id, first.ownerId!)
      } catch (error) {
        ownershipRejected = error instanceof SideEffectOwnershipError
      }
      assert(ownershipRejected, "old owner must not transition the reclaimed record")
      await store.markDispatching(id, second.ownerId!)
    } finally {
      Date.now = originalNow
    }
  })

  await test("two concurrent executions invoke the provider exactly once", async () => {
    const store = makeStore()
    const id = deriveSideEffectId("test", "concurrent-execute")
    callCount = 0
    let releaseDispatch: (() => void) | undefined
    const dispatchGate = new Promise<void>((resolve) => { releaseDispatch = resolve })
    const dispatch = async () => {
      callCount++
      await dispatchGate
      return { value: { ok: true }, providerId: "provider-1" }
    }

    const first = executeSideEffect(store, id, "test-op", dispatch)
    for (let index = 0; index < 20 && callCount === 0; index += 1) await Promise.resolve()
    const second = await executeSideEffect(store, id, "test-op", dispatch)
    releaseDispatch?.()
    const firstOutcome = await first

    assert(firstOutcome.kind === "executed", `expected first execution, got ${firstOutcome.kind}`)
    assert(second.kind === "already_dispatching", `expected active dispatch lock, got ${second.kind}`)
    assert(callCount === 1, `provider invoked ${callCount} times, expected 1`)
  })

  await test("provider rejection persistence failure requires reconciliation", async () => {
    const store = makeStore()
    store.markProviderRejected = async () => { throw new Error("Firestore write failed") }
    const id = deriveSideEffectId("test", "rejection-write-failure")
    const outcome = await executeSideEffect(store, id, "test-op", dispatchRejects("invalid_request"))
    assert(outcome.kind === "reconciliation_required", `expected reconciliation_required, got ${outcome.kind}`)
  })

  await test("claim persistence failure prevents provider invocation", async () => {
    const store = makeStore()
    store.claim = async () => { throw new Error("Firestore unavailable") }
    callCount = 0
    const outcome = await executeSideEffect(store, "claim-failure", "test-op", dispatchOnce({ ok: true }))
    assert(outcome.kind === "persistence_unavailable", `expected persistence_unavailable, got ${outcome.kind}`)
    assert(callCount === 0, `provider invoked ${callCount} times, expected 0`)
  })

  await test("provider sync lease blocks active and recently completed syncs", () => {
    const now = 100_000
    assert(providerSyncBlockReason({ sessionId: "s1", providerSyncState: "syncing", providerSyncClaimedAt: now - 1_000 }, now) === "busy", "active lease should be busy")
    assert(providerSyncBlockReason({ sessionId: "s1", providerSyncState: "idle", lastProviderSyncAt: now - 500 }, now) === "recent", "recent sync should be throttled")
    assert(providerSyncBlockReason({ sessionId: "s1", providerSyncState: "syncing", providerSyncClaimedAt: now - 70_000 }, now) === null, "expired lease should be acquirable")
  })

  await test("provider sync lease release requires the current owner", () => {
    const record = { sessionId: "s1", providerSyncState: "syncing" as const, providerSyncOwnerId: "owner-a" }
    assert(canReleaseProviderSyncLease(record, "owner-a"), "current owner should release")
    assert(!canReleaseProviderSyncLease(record, "owner-b"), "different owner must not release")
  })

  await test("production refuses an in-memory side-effect fallback", () => {
    const previousNodeEnv = process.env.NODE_ENV
    const env = process.env as Record<string, string | undefined>
    env.NODE_ENV = "production"
    try {
      let rejected = false
      try {
        createSideEffectStore(null, null)
      } catch (error) {
        rejected = error instanceof SideEffectPersistenceUnavailableError
      }
      assert(rejected, "production must reject missing durable persistence")
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV
      else env.NODE_ENV = previousNodeEnv
    }
  })

  await test("production rate-limit hashing requires a configured secret", () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousRateSecret = process.env.VOLIMOX_RATE_LIMIT_SECRET
    const previousLinkSecret = process.env.VOLIMOX_DEMO_LINK_SECRET
    const env = process.env as Record<string, string | undefined>
    env.NODE_ENV = "production"
    delete process.env.VOLIMOX_RATE_LIMIT_SECRET
    delete process.env.VOLIMOX_DEMO_LINK_SECRET
    try {
      let rejected = false
      try {
        hashRateLimitKey("127.0.0.1")
      } catch {
        rejected = true
      }
      assert(rejected, "production must not use a public default HMAC key")
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV
      else env.NODE_ENV = previousNodeEnv
      if (previousRateSecret === undefined) delete process.env.VOLIMOX_RATE_LIMIT_SECRET
      else process.env.VOLIMOX_RATE_LIMIT_SECRET = previousRateSecret
      if (previousLinkSecret === undefined) delete process.env.VOLIMOX_DEMO_LINK_SECRET
      else process.env.VOLIMOX_DEMO_LINK_SECRET = previousLinkSecret
    }
  })

  await test("stale dispatching records become uncertain without invoking the provider", async () => {
    const store = new InMemorySideEffectStore()
    const originalNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      const id = deriveSideEffectId("test", "stale-dispatch")
      const first = await store.claim(id, "test-op", { dispatchTimeoutMs: 60_000 })
      assert(first.claimed && Boolean(first.ownerId), "initial claim should succeed")
      await store.markDispatching(id, first.ownerId!)
      now += 60_001

      const staleClaim = await store.claim(id, "test-op", { dispatchTimeoutMs: 60_000 })
      assert(!staleClaim.claimed && staleClaim.reason === "terminal", "stale dispatch should stop claiming")
      assert(staleClaim.record?.state === "uncertain_after_dispatch", "stale dispatch should become uncertain")

      let providerCalls = 0
      const retry = await executeSideEffect(store, id, "test-op", async () => {
        providerCalls++
        return { value: true }
      })
      assert(retry.kind === "uncertain", `expected uncertain retry, got ${retry.kind}`)
      assert(providerCalls === 0, `provider invoked ${providerCalls} times after stale dispatch`)
    } finally {
      Date.now = originalNow
    }
  })

  await test("expired completed records can be reclaimed while uncertain records stay terminal", async () => {
    const store = new InMemorySideEffectStore()
    const originalNow = Date.now
    let now = 2_000_000
    Date.now = () => now
    try {
      const completedId = deriveSideEffectId("test", "expired-completed")
      const completed = await executeSideEffect(store, completedId, "test-op", dispatchOnce(true), { ttlHours: 1 / 3600 })
      assert(completed.kind === "executed", "initial completed operation should execute")
      now += 1_001
      const reclaimed = await store.claim(completedId, "test-op", { ttlHours: 1 / 3600 })
      assert(reclaimed.claimed, "expired completed record should be reclaimable")

      const uncertainId = deriveSideEffectId("test", "expired-uncertain")
      const uncertain = await executeSideEffect(store, uncertainId, "test-op", dispatchErrors("network timeout"), { ttlHours: 1 / 3600 })
      assert(uncertain.kind === "uncertain", "uncertain operation should be recorded")
      now += 1_001
      const blocked = await store.claim(uncertainId, "test-op", { ttlHours: 1 / 3600 })
      assert(!blocked.claimed && blocked.reason === "terminal", "uncertain operation must not be retried blindly")
    } finally {
      Date.now = originalNow
    }
  })

  await test("provider status and SMTP classification preserve transient failures", () => {
    assert(isTransientProviderHttpStatus(408), "408 should be transient")
    assert(isTransientProviderHttpStatus(429), "429 should be transient")
    assert(isTransientProviderHttpStatus(503), "5xx should be uncertain/transient")
    assert(!isTransientProviderHttpStatus(400), "400 should remain terminal")
    assert(!isDefinitiveSmtpRejection({ responseCode: 450 }), "SMTP 4xx should remain uncertain")
    assert(isDefinitiveSmtpRejection({ responseCode: 550 }), "SMTP 5xx should be terminal")
  })

  await test("scheduled SMS configuration requires a Messaging Service", () => {
    const keys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID", "VOLIMOX_DEMO_PHONE_NUMBER"] as const
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    try {
      process.env.TWILIO_ACCOUNT_SID = "ACtest"
      process.env.TWILIO_AUTH_TOKEN = "test-token"
      process.env.VOLIMOX_DEMO_PHONE_NUMBER = "+12025550123"
      delete process.env.TWILIO_MESSAGING_SERVICE_SID
      assert(validateTwilioSchedulingConfig().reasonCode === "scheduled_messaging_service_missing", "scheduled SMS should reject a dedicated sender without Messaging Service")
      process.env.TWILIO_MESSAGING_SERVICE_SID = "MGtest"
      assert(validateTwilioSchedulingConfig().configured, "scheduled SMS should accept a configured Messaging Service")
    } finally {
      for (const key of keys) {
        const value = previous[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  await test("voice limiter allows the configured number of requests", () => {
    const key = `test:voice-limit:${crypto.randomUUID()}`
    assert(withinDemoRateLimit(key, 3, 60_000), "first request should pass")
    assert(withinDemoRateLimit(key, 3, 60_000), "second request should pass")
    assert(withinDemoRateLimit(key, 3, 60_000), "third request should pass")
    assert(!withinDemoRateLimit(key, 3, 60_000), "fourth request should be rejected")
  })

  await test("completed side-effects reconstruct follow-up session state and provider IDs", () => {
    const session = createFollowUpSession({
      fullName: "Test User",
      email: "test@example.com",
      phone: "+12025550123",
      companyName: "Test Company",
      businessType: "Plumbing",
      consentSms: true,
      consentEmail: true,
      consentCall: true,
    })
    projectSideEffectRecord(session, "initial-call", { id: "call", operationType: "initial-call", state: "started", providerId: "CA123" })
    projectSideEffectRecord(session, "initial-email", { id: "email", operationType: "initial-email", state: "sent", providerId: "MSG123" })
    projectSideEffectRecord(session, "lead-notification", { id: "lead", operationType: "lead-notification", state: "sent", providerId: "MSG456" })
    assert(session.initialCallState === "started", "call state should be restored")
    assert(session.twilioCallSid === "CA123", "call provider ID should be restored")
    assert(session.initialEmailState === "sent", "email state should be restored")
    assert(session.leadNotificationState === "sent", "lead state should be restored")
  })

  await test("contact idempotency changes when the brief payload changes", () => {
    const base = {
      fullName: "Test User",
      email: "test@example.com",
      companyName: "Test Company",
      industry: "Plumbing",
      projectScope: "Missed-call recovery",
      estimatedVolume: "50",
    }
    assert(deriveContactLeadEffectId(base) === deriveContactLeadEffectId({ ...base }), "identical briefs should dedupe")
    assert(deriveContactLeadEffectId(base) !== deriveContactLeadEffectId({ ...base, estimatedVolume: "100" }), "changed briefs should receive a new effect ID")
  })

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)

  if (failed > 0) {
    console.error("FAILED:\n" + failures.map(f => `  - ${f}`).join("\n"))
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error(err)
  process.exit(1)
})
