import { getFollowUpSession, readSessionToken } from "@/lib/follow-up-demo"
import { triggerMissedCallRecovery } from "@/lib/follow-up-demo-processor"

export const runtime = "nodejs"

const xml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] || character)

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const verified = readSessionToken(token)
  const session = verified ? await getFollowUpSession(verified.id) : null
  const params = new URLSearchParams(await request.text())
  const answeredBy = (params.get("AnsweredBy") || "unknown").toLowerCase()
  if (session && (answeredBy.startsWith("machine") || answeredBy === "fax")) {
    await triggerMissedCallRecovery(session, request)
    const response = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>"
    return new Response(response, { headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } })
  }
  const name = xml(session?.fullName.split(" ")[0] || "there")
  const response = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Hi ${name}. This is the Volimox missed call demonstration. Hang up or reject this call to see the automatic text-back workflow.</Say></Response>`
  return new Response(response, { headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } })
}
