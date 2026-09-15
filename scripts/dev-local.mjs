import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const projectRoot = fileURLToPath(new URL("../", import.meta.url))
export const localOrigin = "http://127.0.0.1:3002"
const require = createRequire(import.meta.url)

// Empty values must remain in the child environment: deleting these keys would
// allow Next.js to load their configured values again from .env.local.
export const providerEnvironmentKeys = [
  "FIREBASE_SERVICE_ACCOUNT_KEY", "FIREBASE_CONFIG", "FIREBASE_DATABASE_URL",
  "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST",
  "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT",
  "VOLIMOX_FIREBASE_PROJECT_ID", "VOLIMOX_FIRESTORE_DATABASE_ID", "GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_MAPS_API_KEY",
  "GEMINI_API_KEY", "GEMINI_VOICE_API_KEY", "XAI_API_KEY",
  "PROTON_API_BASE_URL", "PROTON_API_KEY",
  "RETELL_API_KEY", "RETELL_WEBHOOK_SECRET", "RETELL_DEMO_VOICE_AGENT_ID",
  "RETELL_DEMO_FLOW_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID", "TWILIO_PHONE_NUMBER", "TWILIO_DEMO_PHONE_NUMBER",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_USER", "EMAIL_PASS",
  "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT", "NOTIFICATION_EMAIL",
  "EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", "EXAMPLE_LIMO_QUOTE_HMAC_SECRET",
  "EXAMPLE_LIMO_STRIPE_SECRET_KEY", "EXAMPLE_LIMO_STRIPE_WEBHOOK_SECRET",
  "EXAMPLE_LIMO_TWILIO_ACCOUNT_SID", "EXAMPLE_LIMO_TWILIO_AUTH_TOKEN",
  "EXAMPLE_LIMO_TWILIO_MESSAGING_SERVICE_SID", "EXAMPLE_LIMO_TWILIO_PHONE_NUMBER",
  "EXAMPLE_LIMO_OPS_EMAIL", "VOLIMOX_DEMO_PHONE_NUMBER",
  "VOICE_DEMO_SESSION_SECRET", "MOX_DEMO_VOICE_HMAC_SECRET",
  "VOLIMOX_DEMO_LINK_SECRET", "VOLIMOX_RATE_LIMIT_SECRET",
]

const localOverrides = Object.freeze({
  NODE_ENV: "development",
  NODE_OPTIONS: "",
  VOLIMOX_LOCAL_DEMO: "true",
  NEXT_PUBLIC_VOLIMOX_LOCAL_DEMO: "true",
  NEXT_DIST_DIR: ".next-local",
  NEXT_TELEMETRY_DISABLED: "1",
  EXAMPLE_LIMO_PROVIDER_MODE: "simulate",
  EXAMPLE_LIMO_USE_PROTON_CREDENTIALS: "false",
  VOLIMOX_FIREBASE_PROJECT_ID: "",
  VOLIMOX_FIRESTORE_DATABASE_ID: "",
  VOLIMOX_DEMO_TENANT_ID: "volimox-local-demo",
  VOLIMOX_DEMO_BASE_RATE: "36",
  VOLIMOX_DEMO_PER_MILE_RATE: "3.25",
  NEXT_PUBLIC_SITE_URL: localOrigin,
  SITE_URL: localOrigin,
  APP_URL: localOrigin,
  VOLIMOX_DEMO_PUBLIC_URL: localOrigin,
})

export function createLocalEnvironment(source = process.env) {
  const environment = { ...source }
  const overrideNames = new Set(Object.keys(localOverrides))
  for (const name of Object.keys(environment)) {
    // Windows environment names are case-insensitive; avoid duplicate variants.
    if (overrideNames.has(name.toUpperCase())) delete environment[name]
    else if (
      /^(?:(?:NEXT_PUBLIC|VITE)_)?(?:GOOGLE|GCLOUD|GCP|FIREBASE|FIRESTORE|GEMINI|XAI|TWILIO|STRIPE|RETELL|SMTP|EMAIL|PROTON|EXAMPLE_LIMO)_/i.test(name)
      || /(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_PASS|_CREDENTIALS)$/i.test(name)
    ) environment[name] = ""
  }
  for (const name of providerEnvironmentKeys) environment[name] = ""
  return Object.assign(environment, localOverrides)
}

export function loadDevelopmentEnvironment() {
  let loadEnvConfig
  try {
    ;({ loadEnvConfig } = require("@next/env"))
  } catch {
    throw new Error("Installed @next/env is missing. Install the locked project dependencies before starting.")
  }
  let parseFailed = false
  const logger = { info() {}, warn() {}, error() { parseFailed = true } }
  process.env.NODE_ENV = "development"
  // Next's parser handles quoted and multiline values. Its raw errors are never
  // printed because malformed environment input may contain credentials.
  const result = loadEnvConfig(projectRoot, true, logger, true)
  if (parseFailed) throw new Error("An environment file could not be loaded. Check its syntax and permissions locally; no values were printed.")
  return { ...result.combinedEnv }
}

export function resolveNextCli() {
  try {
    return require.resolve("next/dist/bin/next")
  } catch {
    throw new Error("Installed Next.js is missing. Install the locked project dependencies before starting.")
  }
}

export function startLocalDevelopment() {
  let environment
  let nextCli
  try {
    nextCli = resolveNextCli()
    environment = createLocalEnvironment(loadDevelopmentEnvironment())
  } catch {
    console.error("Local setup could not be loaded. Run node scripts/check-setup.mjs --local to check dependencies and environment files.")
    process.exitCode = 1
    return
  }

  console.log(`Volimox local demo: ${localOrigin}`)
  console.log("Example Limo uses simulation and memory storage. Provider credentials are disabled for this process.")
  const child = spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", "3002"], {
    cwd: projectRoot,
    env: environment,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  })

  let stopping = false
  let forceStop
  const stop = (signal) => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return
    stopping = true
    if (process.platform === "win32" && child.pid) {
      // Next dev owns a worker process. Stop this launcher's process tree only.
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        shell: false, stdio: "ignore", windowsHide: true,
      })
      killer.once("error", () => child.kill(signal))
      killer.once("exit", (code) => { if (code !== 0) child.kill(signal) })
    } else {
      child.kill(signal)
      forceStop = setTimeout(() => child.kill("SIGKILL"), 5000)
      forceStop.unref()
    }
  }
  const onInterrupt = () => stop("SIGINT")
  const onTerminate = () => stop("SIGTERM")
  const cleanup = () => {
    clearTimeout(forceStop)
    process.off("SIGINT", onInterrupt)
    process.off("SIGTERM", onTerminate)
  }
  process.on("SIGINT", onInterrupt)
  process.on("SIGTERM", onTerminate)
  child.once("error", () => {
    cleanup()
    console.error("Next.js could not start. Check the installed Node/Next.js runtime and local process permissions.")
    process.exitCode = 1
  })
  child.once("exit", (code, signal) => {
    cleanup()
    process.exitCode = stopping ? 0 : (code ?? (signal === "SIGINT" ? 130 : 1))
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.error("Usage: node scripts/dev-local.mjs (fixed local host and port)")
    process.exitCode = 1
  } else startLocalDevelopment()
}
