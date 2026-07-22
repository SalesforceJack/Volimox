import { mergeContactLeadNotificationStatus } from "../lib/contact-lead.ts"
import { withRecoveryWorkflowStatus } from "../lib/public-workflow-status.ts"
import { createFollowUpSession, publicSession } from "../lib/follow-up-demo.ts"
import { deriveSideEffectId, executeSideEffect, InMemorySideEffectStore, SideEffectPreflightError } from "../lib/side-effect-machine.ts"

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (error) {
    console.error(`  ✗  ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

async function run() {
  await test("completed inbound reply side effect reconstructs SID without redispatch", async () => {
    const store = new InMemorySideEffectStore()
    const id = deriveSideEffectId("session-test", "inbound-reply-sms", "SM-inbound")
    let providerCalls = 0
    const first = await executeSideEffect(store, id, "inbound-reply-sms", async () => {
      providerCalls++
      return {
        value: { sid: "SM-reply" },
        providerId: "SM-reply",
        providerMetadata: { from: "+12025550199", status: "queued" },
      }
    })
    assert(first.kind === "executed", "first reply should execute")

    const retry = await executeSideEffect(store, id, "inbound-reply-sms", async () => {
      providerCalls++
      return { value: { sid: "duplicate" }, providerId: "duplicate" }
    })
    assert(retry.kind === "already_completed", `expected already_completed, got ${retry.kind}`)
    assert(retry.record.providerId === "SM-reply", "retry should reconstruct the original provider SID")
    assert(retry.record.providerMetadata?.from === "+12025550199", "retry should reconstruct provider metadata")
    assert(providerCalls === 1, `provider was called ${providerCalls} times`)
  })

  await test("preflight failure remains safely retryable", async () => {
    const store = new InMemorySideEffectStore()
    const id = deriveSideEffectId("session-test", "inbound-reply-preflight", "retry")
    let providerCalls = 0
    const blocked = await executeSideEffect(
      store,
      id,
      "inbound-reply-sms",
      async () => {
        providerCalls++
        return { value: true }
      },
      { preflight: () => { throw new SideEffectPreflightError("not_configured") } },
    )
    assert(blocked.kind === "preflight_failed", `expected preflight_failed, got ${blocked.kind}`)
    assert(providerCalls === 0, "provider must not run before configuration is valid")

    const retry = await executeSideEffect(store, id, "inbound-reply-sms", async () => {
      providerCalls++
      return { value: true, providerId: "SM-retry" }
    })
    assert(retry.kind === "executed", `expected retry execution, got ${retry.kind}`)
    assert(providerCalls === 1, "provider should run exactly once after configuration is fixed")
  })

  await test("contact notification status never regresses after sent", () => {
    assert(mergeContactLeadNotificationStatus("sent", "pending") === "sent", "sent must beat pending")
    assert(mergeContactLeadNotificationStatus("sent", "failed") === "sent", "sent must beat failed")
    assert(mergeContactLeadNotificationStatus("uncertain_after_dispatch", "pending") === "uncertain_after_dispatch", "uncertain must not regress")
    assert(mergeContactLeadNotificationStatus("pending", "reconciliation_required") === "reconciliation_required", "reconciliation should advance pending")
  })

  await test("recovery failure prevents a fully-started public status", () => {
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
    session.initialCallState = "started"
    session.initialEmailState = "sent"
    session.leadNotificationState = "sent"
    session.recoverySmsState = "failed"
    const publicState = withRecoveryWorkflowStatus(publicSession(session))
    assert(publicState.workflowStatus === "partially_started", `expected partially_started, got ${publicState.workflowStatus}`)
  })

  console.log(`\n${passed + failed} final hardening tests: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
