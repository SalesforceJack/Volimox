type RateLimitEntry = {
  count: number
  resetAt: number
}

const requests = new Map<string, RateLimitEntry>()

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous"
}

export function withinDemoRateLimit(key: string, limit: number, windowMs: number) {
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
