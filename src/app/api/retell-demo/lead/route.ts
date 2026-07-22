import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { NextResponse } from "next/server"
import { demoDb, getDemoAgentLeadsCollection, getDemoTenantId, isProductionFirebaseRequired } from "@/lib/firebase-admin"
import { verifyRetell } from "@/lib/retell-demo"
import crypto from "node:crypto"

export const runtime = "nodejs"
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyRetell(request, raw)) return NextResponse.json({ ok: false }, { status: 401 })
  const body = JSON.parse(raw) as Record<string, unknown>
  const db = demoDb()
  if (!db && isProductionFirebaseRequired()) {
    return NextResponse.json({ ok: false, error: "Persistence system unavailable." }, { status: 503 })
  }
  const callId = String(body.call_id || body.callId || (body.call && typeof body.call === "object" && (body.call as Record<string, unknown>).call_id) || "")
  if (!callId) {
    return NextResponse.json({ ok: false, error: "Missing call_id" }, { status: 400 })
  }

  const hashedCallId = crypto.createHash("sha256").update(callId).digest("hex")
  const leadDocId = `retell-lead-${hashedCallId}`

  if (db) {
    const tenantId = getDemoTenantId()
    const record = {
      callId: hashedCallId,
      tenantId,
      source: "retell_limo_demo",
      status: "captured",
      schemaVersion: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAtServer: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    }
    await getDemoAgentLeadsCollection(db, tenantId).doc(leadDocId).set(record, { merge: true })
  }
  return NextResponse.json({ ok: true, agent_say: "I have that noted." })
}
