import { NextResponse } from "next/server"
import { deterministicEvent, getFollowUpSession, publicSession, readSessionToken, upsertEvent } from "@/lib/follow-up-demo"
import { listInboundSms, getDemoCallStatus } from "@/lib/twilio-demo"
import { processInboundDemoSms, triggerMissedCallRecovery } from "@/lib/follow-up-demo-processor"
import { acquireProviderSyncLease, releaseProviderSyncLease } from "@/lib/provider-sync-lease"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const verified = readSessionToken(token)
  if (!verified) return NextResponse.json({ ok: false, error: "Invalid or expired demo session." }, { status: 401 })

  let session = await getFollowUpSession(verified.id)
  if (!session) return NextResponse.json({ ok: false, error: "Demo session was not found." }, { status: 404 })

  // Acquire a short-lived exclusive lease so that two overlapping poll requests
  // do not both call listInboundSms / getDemoCallStatus for the same session.
  const { acquired, ownerId, reason } = await acquireProviderSyncLease(session.id)
  if (!acquired) {
    if (reason === "unavailable") {
      return NextResponse.json({ ok: false, error: "Live provider sync is temporarily unavailable." }, { status: 503 })
    }
    // Another request is already syncing this session — return the current
    // state from Firestore without calling external providers again.
    return NextResponse.json({ ok: true, session: publicSession(session) }, { headers: { "Cache-Control": "no-store" } })
  }

  try {
    if (session.status !== "completed" && session.twilioNumber) {
      try {
        const inbound = await listInboundSms({ from: session.phone, to: session.twilioNumber, createdAfter: session.createdAt })
        for (const item of inbound) session = await processInboundDemoSms(session, item.body, item.sid, request)
      } catch (error) {
        console.error("[follow-up-demo/events/sync]", error)
      }
    }

    if (
      session.status !== "completed" &&
      session.twilioCallSid
    ) {
      try {
        const callResult = await getDemoCallStatus(session.twilioCallSid)
        if (
          ["busy", "no-answer", "canceled"].includes(callResult.status) ||
          callResult.answeredBy.startsWith("machine") ||
          callResult.answeredBy === "fax"
        ) {
          const detected = callResult.answeredBy || callResult.status
          upsertEvent(session, deterministicEvent(`call-poll-${session.twilioCallSid}-${detected}`, `call.${detected}`, `Call ${detected}`, "Detected from Twilio call status.", "call", "failed"))
          session = await triggerMissedCallRecovery(session, request)
        }
      } catch (error) {
        console.error("[follow-up-demo/events/call-sync]", error)
      }
    }
  } finally {
    await releaseProviderSyncLease(session.id, ownerId)
  }

  return NextResponse.json({ ok: true, session: publicSession(session) }, { headers: { "Cache-Control": "no-store" } })
}
