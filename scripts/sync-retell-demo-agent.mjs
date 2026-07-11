import fs from "node:fs"
import path from "node:path"

const envPath = path.resolve(".env.local")
const envText = fs.readFileSync(envPath, "utf8")
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
  const index = line.indexOf("=")
  return [line.slice(0, index), line.slice(index + 1).replace(/^['\"]|['\"]$/g, "")]
}))
const apiKey = env.RETELL_API_KEY
const sourceAgentId = env.RETELL_VOICE_AGENT_ID
const base = (env.VOLIMOX_DEMO_PUBLIC_URL || "https://volimox.com").replace(/\/$/, "")
if (!apiKey || !sourceAgentId || !env.RETELL_WEBHOOK_SECRET) throw new Error("Missing Retell configuration in .env.local")
const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
const api = async (url, options = {}) => {
  const response = await fetch(`https://api.retellai.com${url}`, { ...options, headers: { ...headers, ...options.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(`${url}: ${JSON.stringify(body)}`)
  return body
}
const sourceAgent = await api(`/get-agent/${sourceAgentId}`)
const sourceFlowId = sourceAgent.response_engine?.conversation_flow_id
const sourceFlow = await api(`/get-conversation-flow/${sourceFlowId}`)
const map = {
  get_quote: "/api/retell-demo/quote",
  payment: "/api/retell-demo/payment",
  save_lead: "/api/retell-demo/lead",
  save_special_lead: "/api/retell-demo/lead",
  notify_payment_failure: "/api/retell-demo/lead",
  check_booking_status: "/api/retell-demo/lead",
  cancel_booking: "/api/retell-demo/lead",
}
const nodes = sourceFlow.nodes.map((node) => ({ ...node, tools: node.tools?.map((tool) => map[tool.name] ? { ...tool, url: `${base}${map[tool.name]}`, headers: { ...(tool.headers || {}), Authorization: `Bearer ${env.RETELL_WEBHOOK_SECRET}` } } : tool) }))
const tools = (sourceFlow.tools || []).map((tool) => map[tool.name] ? { ...tool, url: `${base}${map[tool.name]}`, headers: { ...(tool.headers || {}), Authorization: `Bearer ${env.RETELL_WEBHOOK_SECRET}` } } : tool)
const flowBody = { ...sourceFlow, nodes, tools }
for (const key of ["conversation_flow_id", "version", "is_published", "last_modification_timestamp"]) delete flowBody[key]
let flow
if (env.RETELL_DEMO_FLOW_ID) {
  flow = await api(`/update-conversation-flow/${env.RETELL_DEMO_FLOW_ID}`, { method: "PATCH", body: JSON.stringify(flowBody) })
} else {
  flow = await api("/create-conversation-flow", { method: "POST", body: JSON.stringify(flowBody) })
}
const allowed = ["voice_id", "voice_model", "fallback_voice_ids", "voice_temperature", "voice_speed", "volume", "language", "data_storage_setting", "enable_backchannel", "backchannel_frequency", "max_call_duration_ms", "boosted_keywords", "enable_dynamic_responsiveness", "stt_mode", "allow_user_dtmf", "user_dtmf_options"]
const agentBody = Object.fromEntries(allowed.filter((key) => sourceAgent[key] !== undefined).map((key) => [key, sourceAgent[key]]))
agentBody.agent_name = "Volimox Website - Proton Limo Demo"
agentBody.response_engine = { type: "conversation-flow", conversation_flow_id: flow.conversation_flow_id }
let agent
if (env.RETELL_DEMO_VOICE_AGENT_ID) agent = await api(`/update-agent/${env.RETELL_DEMO_VOICE_AGENT_ID}`, { method: "PATCH", body: JSON.stringify(agentBody) })
else agent = await api("/create-agent", { method: "POST", body: JSON.stringify(agentBody) })
let next = envText
for (const [key, value] of [["RETELL_DEMO_FLOW_ID", flow.conversation_flow_id], ["RETELL_DEMO_VOICE_AGENT_ID", agent.agent_id]]) {
  next = new RegExp(`^${key}=.*$`, "m").test(next) ? next.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${next.trimEnd()}\n${key}=${value}\n`
}
fs.writeFileSync(envPath, next)
console.log(`Synced demo flow ${flow.conversation_flow_id} and agent ${agent.agent_id}`)
