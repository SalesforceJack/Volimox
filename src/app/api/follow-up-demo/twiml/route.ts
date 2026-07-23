import { getFollowUpSession, readSessionToken } from "@/lib/follow-up-demo"

export const runtime = "nodejs"

const xml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] || character)

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const verified = readSessionToken(token)
  const session = verified ? await getFollowUpSession(verified.id) : null
  const business = xml(session?.businessType || "Home Services")
  const name = xml(session?.fullName.split(" ")[0] || "there")
  const response = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">Hi ${name}. This is the live Example ${business} callback powered by Volimox. We received your request and the business now has a clean lead summary. This demonstration call will now end. Thank you.</Say></Response>`
  return new Response(response, { headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } })
}
