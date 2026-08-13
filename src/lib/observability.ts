import { requestIdFrom, REQUEST_ID_HEADER } from "@/lib/request-id"

export type LogLevel = "info" | "warn" | "error"
export type LogContext = Record<string, unknown>

const REDACTED = "[REDACTED]"
const TRUNCATED = "[TRUNCATED]"
const SENSITIVE_KEY = /authorization|cookie|password|secret|token|apikey|privatekey|credential|card|cvv|cvc|rawbody/i
const PERSONAL_KEY = /^(?:email|phone|address|emailaddress|phonenumber|pickupaddress|dropoffaddress|destinationaddress|originaddress|passenger(?:name|email|phone)|customer(?:name|email|phone))$/i
const SENSITIVE_VALUE = /Bearer\s+\S+|\b(?:sk|pk|rk|whsec|re)_[A-Za-z0-9_-]+\b|(password|secret|token|api[_-]?key)\s*[:=]\s*["']?[^,\s"']+/gi

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, "")
}

function safeKey(key: string): boolean {
  const normalizedKey = normalizeKey(key)
  return SENSITIVE_KEY.test(normalizedKey) || PERSONAL_KEY.test(normalizedKey)
}

function redactText(value: string): string {
  return value.replace(SENSITIVE_VALUE, (match, label: string | undefined) => label ? `${label}=${REDACTED}` : REDACTED)
}

export function redactForLog(value: unknown, key = "", depth = 0): unknown {
  if (safeKey(key)) return REDACTED
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(typeof (value as Error & { code?: unknown }).code === "string"
        ? { code: (value as Error & { code: string }).code }
        : {}),
    }
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") return redactText(value)
  if (typeof value === "bigint") return value.toString()
  if (depth >= 4) return TRUNCATED
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForLog(item, "", depth + 1))
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([entryKey, entryValue]) => [entryKey, redactForLog(entryValue, entryKey, depth + 1)]),
    )
  }
  return String(value)
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}): void {
  const record = redactForLog({
    timestamp: new Date().toISOString(),
    service: process.env.OBSERVABILITY_SERVICE_NAME || "volimox",
    event,
    ...context,
  }) as Record<string, unknown>
  const line = JSON.stringify(record)

  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}

export function withRequestId<T extends Response>(response: T, requestId: string): T {
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export function requestIdFor(request: Request): string {
  return requestIdFrom(request)
}
