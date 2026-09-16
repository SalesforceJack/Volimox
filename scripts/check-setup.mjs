import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createLocalEnvironment, loadDevelopmentEnvironment } from "./dev-local.mjs"

const require = createRequire(import.meta.url)
const groups = {
  firebase: [
    "FIREBASE_SERVICE_ACCOUNT_KEY", "FIREBASE_CONFIG", "FIREBASE_DATABASE_URL",
    "VOLIMOX_FIREBASE_PROJECT_ID", "VOLIMOX_FIRESTORE_DATABASE_ID",
    "FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST",
    "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT",
  ],
  browserVoice: ["VOICE_PROVIDER", "XAI_API_KEY", "GEMINI_API_KEY", "GEMINI_VOICE_API_KEY", "VOICE_DEMO_SESSION_SECRET"],
  exampleLimo: [
    "EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", "EXAMPLE_LIMO_QUOTE_HMAC_SECRET",
    "EXAMPLE_LIMO_STRIPE_SECRET_KEY", "EXAMPLE_LIMO_STRIPE_WEBHOOK_SECRET",
    "EXAMPLE_LIMO_TWILIO_ACCOUNT_SID", "EXAMPLE_LIMO_TWILIO_AUTH_TOKEN",
    "EXAMPLE_LIMO_TWILIO_MESSAGING_SERVICE_SID", "EXAMPLE_LIMO_TWILIO_PHONE_NUMBER",
  ],
  protonBridge: ["PROTON_API_BASE_URL", "PROTON_API_KEY"],
  retellAndSms: [
    "RETELL_API_KEY", "RETELL_DEMO_VOICE_AGENT_ID", "RETELL_WEBHOOK_SECRET",
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_PHONE_NUMBER", "TWILIO_DEMO_PHONE_NUMBER", "VOLIMOX_DEMO_PHONE_NUMBER",
  ],
  sharedProviders: ["GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_MAPS_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  email: ["SMTP_USER", "SMTP_PASS", "EMAIL_USER", "EMAIL_PASS", "NOTIFICATION_EMAIL"],
  demoIntegrity: ["VOLIMOX_DEMO_LINK_SECRET", "MOX_DEMO_VOICE_HMAC_SECRET", "VOLIMOX_RATE_LIMIT_SECRET"],
}

export function presence(value) {
  if (typeof value !== "string" || !value.trim()) return "missing"
  return /^(?:your[-_ ]|replace[-_ ]with|placeholder|changeme)/i.test(value.trim())
    ? "placeholder"
    : "present"
}

export function inspectConfiguration(environment, local = false) {
  const rawMode = environment.EXAMPLE_LIMO_PROVIDER_MODE?.trim().toLowerCase()
  const protonCredentials = environment.EXAMPLE_LIMO_USE_PROTON_CREDENTIALS?.trim().toLowerCase() === "true"
  const providerMode = ["simulate", "live", "disabled"].includes(rawMode)
    ? rawMode
    : (protonCredentials ? "live" : "simulate")
  return {
    environment: "development",
    profile: local ? "local-demo" : "configured",
    localDemo: environment.VOLIMOX_LOCAL_DEMO?.trim().toLowerCase() === "true",
    exampleLimoProviderMode: providerMode,
    protonCredentialReuse: protonCredentials,
    configuration: Object.fromEntries(Object.entries(groups).map(([name, keys]) => [
      name, Object.fromEntries(keys.map((key) => [key, presence(environment[key])])),
    ])),
    providerConnectivity: "not_checked",
    productionReadiness: "not_assessed",
  }
}

export function inspectDependencies() {
  const manifest = require("../package.json")
  const dependencies = Object.fromEntries(
    ["@next/env", ...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.devDependencies || {})]
      .map((name) => {
        try { require.resolve(name); return [name, "present"] }
        catch {
          try { require.resolve(`${name}/package.json`); return [name, "present"] }
          catch { return [name, "missing"] }
        }
      }),
  )
  let supportedNode = false
  try {
    const next = require("next/package.json")
    const semver = require("next/dist/compiled/semver")
    supportedNode = semver.satisfies(process.versions.node, next.engines.node)
  } catch { /* Missing dependencies are reported by name, without raw errors. */ }
  return { node: process.version, supportedNode, dependencies }
}

export function checkSetup(args = process.argv.slice(2)) {
  if (args.some((arg) => !["--local", "--json"].includes(arg))) {
    console.error("Usage: node scripts/check-setup.mjs [--local] [--json]")
    process.exitCode = 1
    return
  }
  const local = args.includes("--local")
  const runtime = inspectDependencies()
  let report
  try {
    const configured = loadDevelopmentEnvironment()
    report = { runtime, ...inspectConfiguration(local ? createLocalEnvironment(configured) : configured, local) }
  } catch {
    report = { runtime, environment: "development", profile: local ? "local-demo" : "configured", environmentFiles: "could_not_load", providerConnectivity: "not_checked", productionReadiness: "not_assessed" }
  }

  const runtimeReady = runtime.supportedNode && Object.values(runtime.dependencies).every((value) => value === "present")
  report.setupCheck = runtimeReady && report.environmentFiles !== "could_not_load" ? "passed" : "failed"
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Volimox setup: ${report.profile} / development`)
    console.log(`Node runtime: ${runtime.supportedNode ? "supported" : "unsupported or Next.js missing"}`)
    const missing = Object.entries(runtime.dependencies).filter(([, state]) => state === "missing").map(([name]) => name)
    console.log(`Installed dependencies: ${missing.length ? `missing (${missing.join(", ")})` : "present"}`)
    if (report.configuration) {
      console.log(`Example Limo mode: ${report.exampleLimoProviderMode}; Proton credential reuse: ${report.protonCredentialReuse ? "enabled" : "disabled"}`)
      for (const [group, entries] of Object.entries(report.configuration)) {
        console.log(`\n${group}`)
        for (const [name, state] of Object.entries(entries)) console.log(`  ${name}: ${state}`)
      }
    } else console.log("Environment files could not be loaded. Check syntax and file permissions locally.")
    console.log("\nPresence only: provider connectivity was not checked; production readiness was not assessed.")
    console.log(local ? "Local simulation needs no provider credentials. Use node scripts/dev-local.mjs to start." : "Missing provider settings may be intentional. See docs/operations/local-development.md for feature requirements.")
  }
  process.exitCode = report.setupCheck === "passed" ? 0 : 1
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkSetup()
