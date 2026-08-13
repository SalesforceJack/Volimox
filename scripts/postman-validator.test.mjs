import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { validateCollectionObject, validateEnvironmentObject } from "./validate-postman.mjs"

const postmanDir = join(process.cwd(), "postman")

async function readJson(name) {
  return JSON.parse(await readFile(join(postmanDir, name), "utf8"))
}

const collectionCount = validateCollectionObject("Volimox.postman_collection.json", await readJson("Volimox.postman_collection.json"))
assert.equal(collectionCount, 5)
const environmentCount = validateEnvironmentObject("Volimox.local.postman_environment.json", await readJson("Volimox.local.postman_environment.json"))
assert.equal(environmentCount, 3)

const fakeVendorPrefix = ["sk", "test"].join("_")
assert.throws(() => validateEnvironmentObject("synthetic.json", {
  values: [{ key: "protonApiKey", value: `${fakeVendorPrefix}_runtime_fixture` }],
}), /committed credential/)

assert.equal(validateEnvironmentObject("safe.json", {
  values: [
    { key: "protonApiKey", value: "" },
    { key: "retellWebhookSecret", value: "{{RETELL_WEBHOOK_SECRET}}" },
    { key: "baseUrl", value: "http://localhost:3002" },
    { key: "exampleValue", value: "PLACEHOLDER_VALUE" },
  ],
}), 4)

console.log("Postman validator tests: committed fixtures, synthetic secret rejection, placeholders, and collection structure passed")
