import { getExampleLimoProviderMode, useProtonCredentials } from "./example-limo/config"

/** Shared by the local launcher boundary, middleware and the simulation route. */
export function isLocalDemoEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.VOLIMOX_LOCAL_DEMO?.trim().toLowerCase() === "true"
}

// These settings can attach the app to another service, including an emulator.
// Local signing secrets are intentionally permitted; they do not enable a provider.
const EXTERNAL_CONFIGURATION = new Set([
  "FIREBASE_SERVICE_ACCOUNT_KEY", "FIREBASE_CONFIG", "FIREBASE_DATABASE_URL",
  "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST",
  "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT",
  "VOLIMOX_FIREBASE_PROJECT_ID", "VOLIMOX_FIRESTORE_DATABASE_ID",
  "PROTON_API_BASE_URL", "TWILIO_ACCOUNT_SID", "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_PHONE_NUMBER", "TWILIO_DEMO_PHONE_NUMBER", "EXAMPLE_LIMO_TWILIO_ACCOUNT_SID",
  "EXAMPLE_LIMO_TWILIO_MESSAGING_SERVICE_SID", "EXAMPLE_LIMO_TWILIO_PHONE_NUMBER",
  "RETELL_DEMO_VOICE_AGENT_ID", "EMAIL_SMTP_HOST", "EMAIL_USER", "EMAIL_PASS",
  "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
])

export function isLocalDemoExternalConfigurationKey(name: string) {
  return EXTERNAL_CONFIGURATION.has(name) || /(?:^|_)(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET_KEY|WEBHOOK_SECRET|SERVICE_ACCOUNT_KEY)$/.test(name)
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

function loopbackAuthority(value: string, protocol: string) {
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(value)) return null
  try {
    return new URL(`${protocol}//${value}`)
  } catch {
    return null
  }
}

export type LocalDemoRequestGuard = { ok: true } | { ok: false; status: number; code: string; error: string }

/** Checks configuration before any storage, quote, credential or provider access. */
export function getLocalDemoRequestGuard(request: Request): LocalDemoRequestGuard {
  if (!isLocalDemoEnabled()) return { ok: false, status: 404, code: "local_demo_unavailable", error: "Local simulation is unavailable." }
  const hasExternalConfiguration = Object.entries(process.env).some(([name, value]) => value?.trim() && isLocalDemoExternalConfigurationKey(name))
  if (getExampleLimoProviderMode() !== "simulate" || useProtonCredentials() || hasExternalConfiguration) {
    return { ok: false, status: 503, code: "local_demo_unsafe_configuration", error: "Start the isolated local demo launcher to use simulation." }
  }
  let url: URL
  try { url = new URL(request.url) } catch {
    return { ok: false, status: 403, code: "local_demo_loopback_required", error: "Local simulation requires a loopback address." }
  }
  const host = request.headers.get("host")
  const forwardedHost = request.headers.get("x-forwarded-host")
  // Next may rewrite 127.0.0.1 to localhost internally. Host retains the
  // browser's authority; each authority must still be local and use this port.
  const authority = host === null ? url : loopbackAuthority(host, url.protocol)
  const forwardedAuthority = forwardedHost === null ? null : loopbackAuthority(forwardedHost, url.protocol)
  if (!isLoopbackHostname(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    !authority || authority.port !== url.port ||
    (forwardedHost !== null && (!forwardedAuthority || forwardedAuthority.host !== authority.host))) {
    return { ok: false, status: 403, code: "local_demo_loopback_required", error: "Local simulation requires a loopback address." }
  }
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  if (request.method !== "GET" && ((origin && origin !== authority.origin) || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none"))) {
    return { ok: false, status: 403, code: "local_demo_same_origin_required", error: "Open simulation from this local app before continuing." }
  }
  return { ok: true }
}
