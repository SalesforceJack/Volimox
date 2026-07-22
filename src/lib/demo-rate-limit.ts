type RateLimitEntry = {
  count: number
  resetAt: number
}

const requests = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 60_000
const MAX_ENTRIES = 10_000

/**
 * Returns the client IP from request headers.
 *
 * NOTE: x-forwarded-for is trusted only when the deployment proxy is known
 * to set it reliably (e.g. Vercel, Cloudflare). In other environments,
 * this header can be spoofed by the client to bypass rate limiting.
 */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous"
}

function pruneExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && requests.size < MAX_ENTRIES) return
  lastCleanup = now
  for (const [key, entry] of requests) {
    if (entry.resetAt <= now) requests.delete(key)
  }
}

export function withinDemoRateLimit(key: string, limit: number, windowMs: number) {
  pruneExpiredEntries()
  const now = Date.now()
  const current = requests.get(key)

  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (current.count >= limit) return false

  current.count += 1
  return true
}
