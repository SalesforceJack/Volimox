import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { sendLeadNotification } from "@/lib/mail"
import { readDemoToken } from "@/lib/volimox-demo"
import { demoDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export const runtime = "nodejs"

const clean = (value: unknown, length: number) => typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, length) : ""

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`demo-lead:${getClientIp(request)}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, error: "Please try again tomorrow." }, { status: 429 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const token = clean(body.token, 5000)
    const continuation = readDemoToken(token)
    const fullName = clean(body.fullName, 120)
    const email = clean(body.email, 254).toLowerCase()
    const companyName = clean(body.companyName, 160)
    const industry = clean(body.industry, 120)
    const challenge = clean(body.challenge, 1400)
    const volume = clean(body.estimatedVolume, 12)

    if (!continuation || !fullName || !companyName || !industry || !challenge || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{1,9}$/.test(volume)) {
      return NextResponse.json({ success: false, error: "Complete the required fields with a valid work email." }, { status: 400 })
    }

    await sendLeadNotification({
      fullName,
      email,
      companyName,
      industry,
      estimatedVolume: volume,
      projectScope: `Live demo continuation. ${challenge}\n\nDemo route: ${continuation.distanceMiles.toFixed(1)} mi, ${continuation.durationMinutes} min, illustrative quote $${continuation.estimatedValueUsd.toFixed(2)}.`,
    })

    const db = demoDb()
    if (db) {
      await db.collection("volimox_demo_leads").add({
        fullName,
        email,
        companyName,
        industry,
        challenge,
        estimatedVolume: Number(volume),
        reservationId: continuation.reservationId || null,
        demoSessionId: continuation.id,
        source: "volimox_demo_continuation",
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ success: true, message: "Your workflow brief is with Volimox. We will follow up with a practical operating design." })
  } catch (error) {
    console.error("[volimox/demo/lead]", error)
    return NextResponse.json({ success: false, error: "Your brief could not be sent. Please try again." }, { status: 500 })
  }
}
