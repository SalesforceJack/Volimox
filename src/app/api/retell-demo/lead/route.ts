import { FieldValue } from "firebase-admin/firestore"
import { NextResponse } from "next/server"
import { demoDb } from "@/lib/firebase-admin"
import { verifyRetell } from "@/lib/retell-demo"

export const runtime = "nodejs"
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyRetell(request, raw)) return NextResponse.json({ ok: false }, { status: 401 })
  const body = JSON.parse(raw) as Record<string, unknown>
  const db = demoDb()
  if (db) await db.collection("volimox_demo_agent_leads").add({ ...body, source: "retell_limo_demo", createdAt: FieldValue.serverTimestamp() })
  return NextResponse.json({ ok: true, agent_say: "I have that noted." })
}
