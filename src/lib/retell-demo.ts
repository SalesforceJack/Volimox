import crypto from "node:crypto"

export function verifyRetell(request: Request, rawBody: string) {
  const secret = process.env.RETELL_WEBHOOK_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== "production"
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true
  const signature = request.headers.get("x-retell-signature") || ""
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export function publicDemoUrl() {
  return (process.env.VOLIMOX_DEMO_PUBLIC_URL || "https://volimox.com").replace(/\/$/, "")
}
