const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

export const REQUEST_ID_HEADER = "x-request-id"

export function isValidRequestId(value: string | null | undefined): value is string {
  return Boolean(value && REQUEST_ID_PATTERN.test(value))
}

export function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

export function requestIdFrom(value: Request | Headers): string {
  const headers = value instanceof Request ? value.headers : value
  const incoming = headers.get(REQUEST_ID_HEADER)
  return isValidRequestId(incoming) ? incoming : createRequestId()
}
