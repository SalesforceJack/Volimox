import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const DEFAULT_POSTMAN_DIR = join(root, "..", "postman")
const SECRET_KEY_PATTERN = /(?:secret|token|apikey|password|credential|authorization|bearer|privatekey|webhooksecret)/i
const VENDOR_SECRET_PATTERN = /sk_(?:live|test)_|whsec_|Bearer\s+[A-Za-z0-9_-]{20,}/i
const PLACEHOLDER_PATTERN = /^(?:<[^<>]+>|(?:your|replace|placeholder|example|dummy|test)[A-Za-z0-9._-]*)$/i
const LOCAL_URL_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/i

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[\s_-]/g, "")
}

function isSafeEnvironmentValue(value) {
  return value === ""
    || /^\{\{[^{}]+\}\}$/.test(value)
    || PLACEHOLDER_PATTERN.test(value)
    || LOCAL_URL_PATTERN.test(value)
}

function looksLikeCredential(value) {
  return !isSafeEnvironmentValue(value) && VENDOR_SECRET_PATTERN.test(value)
}

function visitCollectionItems(items = []) {
  return items.flatMap((item) => item.item ? visitCollectionItems(item.item) : [item])
}

export function validateCollectionObject(file, collection) {
  if (!collection.info?.schema?.includes("/collection/v2.1.")) {
    throw new Error(`${file}: expected Postman collection v2.1`)
  }

  const requests = visitCollectionItems(collection.item)
  if (requests.length === 0) throw new Error(`${file}: collection has no requests`)

  for (const item of requests) {
    const rawUrl = typeof item.request?.url === "string" ? item.request.url : item.request?.url?.raw
    if (!rawUrl?.includes("{{baseUrl}}")) throw new Error(`${file}: ${item.name} must use {{baseUrl}}`)
    if (looksLikeCredential(JSON.stringify(item))) {
      throw new Error(`${file}: ${item.name} appears to contain a committed credential`)
    }
  }

  return requests.length
}

export function validateEnvironmentObject(file, environment) {
  if (!Array.isArray(environment.values)) throw new Error(`${file}: expected a Postman environment values array`)

  for (const variable of environment.values) {
    if (!variable || typeof variable.key !== "string" || variable.key.trim() === "") {
      throw new Error(`${file}: every environment variable must have a key`)
    }
    if (typeof variable.value !== "string") throw new Error(`${file}: ${variable.key} must have a string value`)

    const key = normalizeKey(variable.key)
    const value = variable.value.trim()
    if (isSafeEnvironmentValue(value)) continue
    if (SECRET_KEY_PATTERN.test(key) || looksLikeCredential(value)) {
      throw new Error(`${file}: ${variable.key} appears to contain a committed credential`)
    }
  }

  return environment.values.length
}

export async function validatePostmanDirectory(postmanDir = DEFAULT_POSTMAN_DIR) {
  const files = (await readdir(postmanDir)).sort()
  const collectionFiles = files.filter((name) => name.endsWith(".postman_collection.json"))
  const environmentFiles = files.filter((name) => name.endsWith(".postman_environment.json"))
  if (collectionFiles.length === 0) throw new Error("No Postman collections found.")
  if (environmentFiles.length === 0) throw new Error("No Postman environments found.")

  const results = []
  for (const file of collectionFiles) {
    const collection = JSON.parse(await readFile(join(postmanDir, file), "utf8"))
    results.push({ type: "collection", file, count: validateCollectionObject(file, collection) })
  }
  for (const file of environmentFiles) {
    const environment = JSON.parse(await readFile(join(postmanDir, file), "utf8"))
    results.push({ type: "environment", file, count: validateEnvironmentObject(file, environment) })
  }
  return results
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (invokedPath === import.meta.url) {
  const results = await validatePostmanDirectory()
  for (const result of results) {
    const label = result.type === "collection"
      ? `${result.count} Postman request definitions statically validated`
      : `${result.count} Postman environment variables and credential hygiene statically validated`
    console.log(`${result.file}: ${label}`)
  }
  console.log("Postman collection structure and credential hygiene statically validated.")
}
