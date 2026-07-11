import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { sendLeadNotification } from "@/lib/mail"
import { buildGlobalDemoQuote, createDemoToken, normalizeDemoPhone, sendDemoSms } from "@/lib/volimox-demo"
import { getMoxAgent } from "@/lib/mox-agents"

export const runtime = "nodejs"

const text = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`mox-action:${getClientIp(request)}`, 18, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Demo action limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json() as { agentId?: string; tool?: string; args?: Record<string, unknown> }
    const agent = getMoxAgent(body.agentId)
    const args = body.args || {}

    if (agent.id === "limo" && body.tool === "get_volimox_demo_quote") {
      const quote = await buildGlobalDemoQuote({
        pickup: text(args.pickup_address, 240),
        destination: text(args.destination_address, 240),
        passengers: Math.max(1, Math.min(80, Math.trunc(Number(args.passenger_count) || 1))),
      })
      return NextResponse.json({ ok: true, tool: body.tool, result: { ...quote, message: `Route resolved at ${quote.distanceMiles.toFixed(1)} miles and ${quote.durationMinutes} minutes. Illustrative quote: $${quote.estimatedValueUsd.toFixed(2)}.` } })
    }

    if (agent.id === "limo" && body.tool === "create_volimox_demo_link") {
      const phone = normalizeDemoPhone(args.phone)
      const distanceMiles = Number(args.distance_miles)
      const durationMinutes = Number(args.duration_minutes)
      const estimatedValueUsd = Number(args.illustrative_quote_usd)
      if (!phone || !Number.isFinite(distanceMiles) || !Number.isFinite(durationMinutes) || !Number.isFinite(estimatedValueUsd)) {
        return NextResponse.json({ ok: false, error: "A valid phone and route result are required." }, { status: 400 })
      }
      const reservationId = `MOX-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      const token = createDemoToken({ distanceMiles, durationMinutes, estimatedValueUsd, reservationId })
      const url = new URL(`/demo/${token}`, request.url).toString()
      const sms = await sendDemoSms(phone, url)
      return NextResponse.json({ ok: true, tool: body.tool, result: { reservationId, url, smsSent: sms.sent, message: sms.sent ? "The continuation page was sent by SMS." : "The continuation page is ready; SMS is not configured in this environment." } })
    }

    if (body.tool === "capture_demo_contact") {
      const fullName = text(args.full_name, 120)
      const email = text(args.email, 254).toLowerCase()
      const phone = normalizeDemoPhone(args.phone)
      const companyName = text(args.company_name, 160)
      const businessNeed = text(args.business_need, 1400)
      if (!fullName || !companyName || !businessNeed || !/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "A name, work email, company, and business need are required." }, { status: 400 })
      }
      await sendLeadNotification({ fullName, email, companyName, industry: agent.name, projectScope: `Live ${agent.name} demo follow-up. ${businessNeed}`, estimatedVolume: "Not provided" })
      const sms = phone ? await sendDemoSms(phone, process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || new URL("/", request.url).origin) : { sent: false, reason: "No phone provided." }
      return NextResponse.json({ ok: true, tool: body.tool, result: { emailNotified: true, smsSent: sms.sent, message: "The follow-up was captured and routed to the Volimox team." } })
    }

    return NextResponse.json({ ok: true, tool: body.tool, result: { message: `${agent.name} completed this demonstration step and queued a human follow-up.` } })
  } catch (error) {
    console.error("[volimox/mox-demo/action]", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Demo action failed." }, { status: 502 })
  }
}
