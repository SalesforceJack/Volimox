import { FieldValue, Timestamp, type CollectionReference, type Firestore } from "firebase-admin/firestore"
import { upsertMessageBySid, type FollowUpDemoSession } from "@/lib/follow-up-demo"
import { deriveSideEffectId, type SideEffectProviderMetadata, type SideEffectRecord } from "@/lib/side-effect-machine"

const REPLY_OPERATION = "inbound-reply-sms"

export function inboundReplyBody(session: Pick<FollowUpDemoSession, "fullName">, inboundCount: number) {
  const firstName = session.fullName.split(" ")[0]
  if (inboundCount <= 1) return `Thanks, ${firstName}. What is the service address, and is this urgent?`
  if (inboundCount === 2) return "Got it. What is the best time for the technician to call or arrive?"
  return "Thank you. We captured the job details and notified the team. They can now follow up with the full context."
}

export function deriveInboundReplyEffectId(sessionId: string, sourceSid: string) {
  return deriveSideEffectId(sessionId, REPLY_OPERATION, sourceSid)
}

export function createInboundReplyStatusCallback(input: {
  baseUrl: string
  sessionId: string
  sourceSid: string
  inboundCount: number
}) {
  const effectId = deriveInboundReplyEffectId(input.sessionId, input.sourceSid)
  const params = new URLSearchParams({
    sessionId: input.sessionId,
    channel: "sms",
    mode: REPLY_OPERATION,
    effectId,
    sourceSid: input.sourceSid,
    replyStep: String(input.inboundCount),
  })
  return { effectId, url: `${input.baseUrl}/api/follow-up-demo/twilio/status?${params.toString()}` }
}

export function validateInboundReplyCallback(input: {
  sessionId: string
  effectId: string
  sourceSid: string
  replyStep: number
}) {
  return Boolean(
    input.sessionId &&
    input.effectId &&
    input.sourceSid &&
    Number.isInteger(input.replyStep) &&
    input.replyStep >= 1 &&
    input.effectId === deriveInboundReplyEffectId(input.sessionId, input.sourceSid)
  )
}

function reconciledState(existing: SideEffectRecord | null, incoming: "sent" | "uncertain_after_dispatch") {
  if (existing?.state === "completed") return "completed" as const
  if ((existing?.state === "sent" || existing?.state === "started") && incoming === "uncertain_after_dispatch") return existing.state
  return incoming
}

export async function reconcileInboundReplySideEffect(
  db: Firestore,
  collectionRef: CollectionReference,
  input: {
    effectId: string
    sessionId: string
    providerId: string
    state: "sent" | "uncertain_after_dispatch"
    providerMetadata?: SideEffectProviderMetadata
    ttlHours?: number
  },
): Promise<SideEffectRecord> {
  if (!input.providerId) throw new Error("inbound_reply_provider_id_required")
  const docRef = collectionRef.doc(input.effectId)
  const now = Date.now()
  const ttlHours = input.ttlHours ?? 24

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef)
    const existing = snapshot.exists ? snapshot.data() as SideEffectRecord : null
    if (existing?.operationType && existing.operationType !== REPLY_OPERATION) throw new Error("inbound_reply_operation_conflict")
    if (existing?.sessionId && existing.sessionId !== input.sessionId) throw new Error("inbound_reply_session_conflict")
    if (existing?.providerId && existing.providerId !== input.providerId) throw new Error("inbound_reply_provider_conflict")

    const providerMetadata = {
      ...(existing?.providerMetadata || {}),
      ...(input.providerMetadata || {}),
    }
    const record: SideEffectRecord = {
      ...(existing || {}),
      id: input.effectId,
      operationType: REPLY_OPERATION,
      sessionId: input.sessionId,
      state: reconciledState(existing, input.state),
      providerId: input.providerId,
      providerMetadata,
      completedAt: now,
      expiresAtServer: existing?.expiresAtServer || Timestamp.fromDate(new Date(now + ttlHours * 60 * 60 * 1000)),
    }

    transaction.set(docRef, {
      ...record,
      updatedAtServer: FieldValue.serverTimestamp(),
    }, { merge: true })
    return record
  })
}

export function projectInboundReplySideEffect(
  session: FollowUpDemoSession,
  record: SideEffectRecord,
  statusOverride?: string,
) {
  if (record.providerMetadata?.from) session.twilioNumber = record.providerMetadata.from
  const replyStep = Number(record.providerMetadata?.replyStep || "1")
  const body = record.providerMetadata?.body || inboundReplyBody(session, Number.isFinite(replyStep) ? replyStep : 1)
  if (record.providerId) {
    upsertMessageBySid(session, body, statusOverride || record.providerMetadata?.status || "queued", record.providerId)
  }
  return session
}
