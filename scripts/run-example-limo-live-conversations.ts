import { GoogleGenAI } from "@google/genai"
import {
  canonicalBookingFields,
  canonicalVehicleSelection,
  type ClientCheckoutSelection,
  type ClientQuoteState,
} from "../src/lib/example-limo/client-state"

const BASE_URL = process.env.EXAMPLE_LIMO_TEST_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3004"
const TURN_TIMEOUT_MS = 45_000
const MAX_CUSTOMER_TURNS = 14
let activeTestIp = ""

type Json = Record<string, unknown>
type TranscriptLine = { role: "Customer" | "Diane"; text: string }
type ToolTrace = { name: string; status: "completed" | "failed"; args: Json; result?: Json; error?: string }
type Scenario = {
  id: string
  title: string
  language: "en" | "es"
  opening: string
  pickup: string
  destination: string
  trip: "one_way" | "round_trip"
  departure: string
  returnTime?: string
  passengers: string
  luggage: string
  phone: string
  vehicle: "Luxury Sedan" | "Large SUV"
  vehicleReply: string
  expected?: { addressRepairFirst?: boolean; spanishOnly?: boolean }
}

type RunResult = {
  scenario: string
  title: string
  runId?: string
  providerMode?: string
  status: "passed" | "failed"
  failure?: string
  reservationId?: string
  checkoutUrl?: string
  transcript: TranscriptLine[]
  tools: ToolTrace[]
  assertions: string[]
}

function futureDateText(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000)
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

const departure = futureDateText(14 * 24 + 5)
const returnTime = futureDateText(14 * 24 + 7)

const SCENARIOS: Scenario[] = [
  {
    id: "one-way-standard", title: "One-way standard reservation", language: "en",
    opening: "Hi, I need a limousine quote.", pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "767 5th Avenue, New York, New York 10153",
    trip: "one_way", departure, passengers: "Two passengers.", luggage: "One small bag.", phone: "201-555-0101", vehicle: "Luxury Sedan", vehicleReply: "The luxury sedan will be perfect. Please choose the Sedan.",
  },
  {
    id: "round-trip-return-language", title: "Round trip expressed as a return", language: "en",
    opening: "I need a ride quote, please.", pickup: "123 5th Avenue, New York, New York 10003", destination: "Empire State Building, New York, New York",
    trip: "round_trip", departure, returnTime, passengers: "Three passengers.", luggage: "Two carry-on bags.", phone: "201-555-0102", vehicle: "Luxury Sedan", vehicleReply: "We would like the Luxury Sedan for this trip.",
  },
  {
    id: "sedan-full-sentence", title: "Sedan full-sentence selection", language: "en",
    opening: "Could you help me book a limo?", pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "Grand Central Terminal, New York, New York",
    trip: "one_way", departure, passengers: "Two people.", luggage: "No luggage.", phone: "201-555-0103", vehicle: "Luxury Sedan", vehicleReply: "I think the luxury sedan will be fine for us. Let's go with that option.",
  },
  {
    id: "suv-full-sentence", title: "SUV full-sentence selection", language: "en",
    opening: "I would like an Example Limo quote.", pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "Times Square, New York, New York",
    trip: "one_way", departure, passengers: "Four passengers.", luggage: "Four bags.", phone: "201-555-0104", vehicle: "Large SUV", vehicleReply: "I definitely want to go with the SUV. Please proceed with the larger vehicle.",
  },
  {
    id: "airport-departure", title: "Airport departure with airline", language: "en",
    opening: "I need a ride to JFK Airport.", pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "JFK Airport, Queens, New York",
    trip: "one_way", departure, passengers: "Two passengers.", luggage: "Two checked bags.", phone: "201-555-0105", vehicle: "Large SUV", vehicleReply: "The Large SUV, please.",
  },
  {
    id: "landmark-pickup", title: "Landmark pickup resolution", language: "en",
    opening: "Please quote a limo ride from Madison Square Garden.", pickup: "Madison Square Garden, New York, New York", destination: "JFK Airport, Queens, New York",
    trip: "one_way", departure, passengers: "Two passengers.", luggage: "One bag.", phone: "201-555-0106", vehicle: "Luxury Sedan", vehicleReply: "Let's do the Sedan.",
  },
  {
    id: "spanish-round-trip", title: "Spanish round-trip reservation", language: "es",
    opening: "Hola, necesito una cotización para una limusina.", pickup: "123 5th Avenue, New York, New York 10003", destination: "Empire State Building, New York, New York",
    trip: "round_trip", departure, returnTime, passengers: "Tres pasajeros.", luggage: "Dos maletas pequeñas.", phone: "201-555-0107", vehicle: "Large SUV", vehicleReply: "Quiero la SUV grande, por favor.", expected: { spanishOnly: true },
  },
  {
    id: "address-repair-immediate", title: "Incomplete pickup is repaired immediately", language: "en",
    opening: "I need a quote from 123 5th Avenue in Manhattan to the Empire State Building.", pickup: "123 5th Avenue, New York, New York 10003", destination: "Empire State Building, New York, New York",
    trip: "one_way", departure, passengers: "Two passengers.", luggage: "No bags.", phone: "201-555-0108", vehicle: "Luxury Sedan", vehicleReply: "I will take the Sedan.", expected: { addressRepairFirst: true },
  },
  {
    id: "all-fields-in-one-turn", title: "All details supplied in one turn", language: "en",
    opening: `I need a one-way limo from 105 Osprey Court, Secaucus, New Jersey 07094 to 767 5th Avenue, New York, New York 10153 on ${departure} for two passengers with one bag. My phone is 201-555-0109.`, pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "767 5th Avenue, New York, New York 10153",
    trip: "one_way", departure, passengers: "Two passengers.", luggage: "One bag.", phone: "201-555-0109", vehicle: "Luxury Sedan", vehicleReply: "The cheaper Sedan option works for me.",
  },
  {
    id: "passenger-correction", title: "Passenger correction is preserved", language: "en",
    opening: "I need a limo quote for three passengers, but I may need to correct that.", pickup: "105 Osprey Court, Secaucus, New Jersey 07094", destination: "Rockefeller Center, New York, New York",
    trip: "one_way", departure, passengers: "Actually, make that four passengers.", luggage: "Three bags.", phone: "201-555-0110", vehicle: "Large SUV", vehicleReply: "Please select the SUV.",
  },
]

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function summarize(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : { value }
}

function toolReportResult(name: string, value: Json): Json {
  if (name === "get_example_limo_quote") {
    const quotes = summarize(value.quotes_by_vehicle)
    return {
      quoteId: value.quoteId,
      agent_say_price: value.agent_say_price,
      vehicles: Object.fromEntries(Object.entries(quotes).map(([vehicle, quote]) => [vehicle, {
        quotedTotalUsd: summarize(quote).quotedTotalUsd,
        miles: summarize(quote).miles,
        tollAmount: summarize(quote).tollAmount,
      }])),
    }
  }
  if (name === "send_example_limo_checkout_link") {
    return {
      action: value.action,
      selectedVehicle: value.selectedVehicle,
      quotedTotalUsd: value.quotedTotalUsd,
      reservationId: value.reservationId,
      status: value.status,
      checkoutUrl: value.checkoutUrl,
      message: value.message,
    }
  }
  return { dispatchContactCaptured: value.dispatchContactCaptured, message: value.message }
}

async function postJson(path: string, body: Json, voiceSessionToken: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-example-limo-voice-session": voiceSessionToken,
      ...(activeTestIp ? { "x-forwarded-for": activeTestIp } : {}),
    },
    body: JSON.stringify({ ...body, voiceSessionToken }),
  })
  const payload = await response.json().catch(() => ({})) as Json
  if (!response.ok || payload.ok === false) throw new Error(String(payload.error || `HTTP ${response.status}`))
  return payload
}

function mergeText(previous: string, incoming: string) {
  const next = incoming.trim()
  if (!next) return previous
  if (!previous || next.startsWith(previous)) return next
  if (previous.endsWith(next)) return previous
  return `${previous} ${next}`.replace(/\s+/g, " ").trim()
}

function isSpanishPrompt(value: string) {
  return /\b(?:d[oó]nde|cu[aá]ntos|maletas|tel[eé]fono|ida y vuelta|recoger|direcci[oó]n|cotizaci[oó]n|veh[ií]culo)\b/i.test(value)
}

function nextCustomerTurn(scenario: Scenario, agentText: string, sent: Set<string>) {
  const text = agentText.toLowerCase()
  const spanish = scenario.language === "es" || isSpanishPrompt(agentText)
  const say = (key: string, value: string) => sent.has(key) ? null : (sent.add(key), value)
  const approval = spanish ? "Sí, apruebo ese precio exacto." : "Yes, I approve that exact price."
  const airline = spanish ? "United Airlines." : "United Airlines."
  const trip = scenario.trip === "round_trip"
    ? (spanish ? "Queremos regresar al punto de recogida después del evento; es ida y vuelta." : "We would like to return to the original pickup after the event; it is a round trip.")
    : (spanish ? "Solo ida." : "One way.")

  if (/\b(?:secure payment link|payment link|send the secure|enlace de pago|enviar.*enlace)\b/i.test(agentText)) return say("approval", approval)
  if (/\b(?:which (?:one|vehicle)|sedan or (?:the )?suv|suv or (?:the )?sedan|qu[eé] veh[ií]culo|sed[aá]n.*suv|suv.*sed[aá]n)\b/i.test(agentText)) return say("vehicle", scenario.vehicleReply)
  if (/\b(?:airline|aerol[ií]nea)\b/i.test(agentText)) return say("airline", airline)
  if (/\b(?:return.*(?:date|time|pick)|(?:date|time).*return|regreso.*(?:hora|fecha)|hora.*regreso)\b/i.test(agentText)) return say("return", scenario.returnTime || scenario.departure)
  if (scenario.trip === "round_trip" && sent.has("departure") && !sent.has("return") && /\b(?:date|time|when|fecha|hora|pick(?:ed|ing)? (?:you |me |us )?up)\b/i.test(agentText)) return say("return", scenario.returnTime || scenario.departure)
  if (/\b(?:date|time|when|fecha|hora)\b/i.test(agentText)) return say("departure", scenario.departure)
  if (/\b(?:one[- ]?way|round trip|ida y vuelta|solo ida)\b/i.test(agentText)) return say("trip", trip)
  if (/\b(?:how many (?:passengers|people|riders)|passengers? (?:are|will)|cu[aá]ntos pasajeros)\b/i.test(agentText)) return say("passengers", scenario.passengers)
  if (/\b(?:phone|number to reach|tel[eé]fono)\b/i.test(agentText)) return say("phone", scenario.phone)
  if (/\b(?:luggage|bags?|maletas)\b/i.test(agentText)) return say("luggage", scenario.luggage)
  if (/\b(?:destination|where.*(?:go|headed)|a d[oó]nde|destino)\b/i.test(agentText)) return say("destination", scenario.destination)
  if (/\b(?:pickup|pick(?:ed|ing)? (?:you |me |us )?up|starting from|street address|city and state|address|recoger|direcci[oó]n)\b/i.test(agentText)) return say("pickup", scenario.pickup)
  return null
}

async function requestToken() {
  const response = await fetch(`${BASE_URL}/api/voice/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "limo" }),
  })
  const payload = await response.json().catch(() => ({})) as Json
  if (!response.ok || typeof payload.token !== "string" || typeof payload.model !== "string" || typeof payload.voiceSessionToken !== "string" || typeof payload.runId !== "string") {
    throw new Error(String(payload.error || "Voice token response was incomplete."))
  }
  if (payload.providerMode !== "simulate") throw new Error(`Refusing live conversation tests because providerMode is ${String(payload.providerMode || "unknown")}; restart local Volimox with EXAMPLE_LIMO_PROVIDER_MODE=simulate.`)
  return {
    token: payload.token,
    model: payload.model,
    runId: payload.runId,
    voiceSessionToken: payload.voiceSessionToken,
    providerMode: String(payload.providerMode),
  }
}

async function runScenario(scenario: Scenario, index: number): Promise<RunResult> {
  const transcript: TranscriptLine[] = []
  const tools: ToolTrace[] = []
  const assertions: string[] = []
  const sent = new Set<string>()
  let latestQuote: ClientQuoteState | null = null
  let checkoutSelection: ClientCheckoutSelection | null = null
  let latestCustomerText = ""
  let reservationId: string | undefined
  let checkoutUrl: string | undefined
  let sequence = 0
  let auditQueue = Promise.resolve()
  let turnText = ""
  let waitingResolve: ((text: string) => void) | null = null
  let waitingReject: ((error: Error) => void) | null = null
  let toolWork = 0
  activeTestIp = `127.0.0.${101 + index}`
  const token = await requestToken()

  const audit = (eventType: string, payload?: Json) => {
    sequence += 1
    const eventSequence = sequence
    auditQueue = auditQueue.then(async () => {
      try {
        await postJson("/api/example-limo/run-event", {
          runId: token.runId,
          eventId: `evt_${token.runId.slice(4)}_${eventSequence}`,
          sequence: eventSequence,
          eventType,
          occurredAt: new Date().toISOString(),
          payload,
        }, token.voiceSessionToken)
      } catch (error) {
        assertions.push(`Audit warning: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    })
    return auditQueue
  }

  const finalizeAgentTurn = () => {
    const text = turnText.trim()
    turnText = ""
    if (!text || !waitingResolve || toolWork > 0) return
    transcript.push({ role: "Diane", text })
    void audit("transcript_final", { transcript: { role: "agent", text, final: true } })
    const resolve = waitingResolve
    waitingResolve = null
    waitingReject = null
    resolve(text)
  }

  let live: Awaited<ReturnType<GoogleGenAI["live"]["connect"]>>
  const invokeTool = async (name: string, args: Json) => {
    await audit("tool_requested", { tool: { toolName: name, status: "running", args } })
    try {
      let result: Json
      if (name === "get_example_limo_quote") {
        result = await postJson("/api/example-limo/quote", args, token.voiceSessionToken)
        latestQuote = result as unknown as ClientQuoteState
      } else if (name === "send_example_limo_checkout_link") {
        if (!latestQuote) throw new Error("The current quote is unavailable.")
        if (args.action === "select_vehicle") {
          const selected = canonicalVehicleSelection(latestQuote, latestCustomerText)
          result = await postJson("/api/example-limo/checkout-link", {
            action: "select_vehicle",
            ...canonicalBookingFields(latestQuote),
            vehicle_name: selected.vehicleName,
            quote_id: selected.quoteId,
            quote_fingerprint: selected.vehicleQuote.quoteFingerprint,
            quoted_total_usd: selected.vehicleQuote.quotedTotalUsd,
            quote_issued_at: selected.vehicleQuote.quoteIssuedAt,
            selection_utterance: latestCustomerText,
          }, token.voiceSessionToken)
          checkoutSelection = {
            quoteId: selected.quoteId,
            vehicleName: selected.vehicleName,
            quoteFingerprint: selected.vehicleQuote.quoteFingerprint,
            quotedTotalUsd: selected.vehicleQuote.quotedTotalUsd,
            quoteIssuedAt: selected.vehicleQuote.quoteIssuedAt,
            approvalIntentToken: String(result.approval_intent_token || ""),
          }
        } else {
          if (!checkoutSelection) throw new Error("The vehicle selection has not been verified.")
          result = await postJson("/api/example-limo/checkout-link", {
            action: "create_checkout",
            approval: "yes",
            ...canonicalBookingFields(latestQuote),
            vehicle_name: checkoutSelection.vehicleName,
            quote_id: checkoutSelection.quoteId,
            quote_fingerprint: checkoutSelection.quoteFingerprint,
            quoted_total_usd: checkoutSelection.quotedTotalUsd,
            quote_issued_at: checkoutSelection.quoteIssuedAt,
            approval_intent_token: checkoutSelection.approvalIntentToken,
            last_customer_utterance: latestCustomerText,
            conversation_transcript: transcript.map((line) => `${line.role}: ${line.text}`).join("\n"),
          }, token.voiceSessionToken)
          reservationId = typeof result.reservationId === "string" ? result.reservationId : undefined
          checkoutUrl = typeof result.checkoutUrl === "string" ? result.checkoutUrl : undefined
        }
      } else if (name === "request_example_limo_dispatch") {
        result = await postJson("/api/example-limo/dispatch", args, token.voiceSessionToken)
      } else {
        throw new Error(`Unexpected Gemini tool: ${name}`)
      }
      tools.push({ name, status: "completed", args, result: toolReportResult(name, result) })
      await audit("tool_completed", { tool: { toolName: name, status: "completed", data: result } })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed."
      tools.push({ name, status: "failed", args, error: message })
      await audit("tool_failed", { tool: { toolName: name, status: "failed", detail: message } })
      throw error
    }
  }

  const waitForAgentTurn = () => new Promise<string>((resolve, reject) => {
    waitingResolve = resolve
    waitingReject = reject
    setTimeout(() => {
      if (waitingReject === reject) {
        waitingResolve = null
        waitingReject = null
        reject(new Error("Timed out waiting for Gemini's completed response."))
      }
    }, TURN_TIMEOUT_MS)
  })

  try {
    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1alpha" } })
    const connection = ai.live.connect({
      model: token.model,
      config: { inputAudioTranscription: {}, outputAudioTranscription: {} },
      callbacks: {
        onmessage: async (message: any) => {
          const content = message.serverContent
          const output = content?.outputTranscription || message.outputTranscription
          if (output?.text) turnText = mergeText(turnText, String(output.text))
          if (message.toolCall?.functionCalls?.length) {
            toolWork += 1
            const responses = []
            for (const call of message.toolCall.functionCalls) {
              try {
                const result = await invokeTool(String(call.name), summarize(call.args))
                responses.push({ name: call.name, id: call.id, response: { result } })
              } catch (error) {
                responses.push({ name: call.name, id: call.id, response: { error: error instanceof Error ? error.message : "Tool failed." } })
              }
            }
            live.sendToolResponse({ functionResponses: responses })
            toolWork -= 1
          }
          if (content?.turnComplete) finalizeAgentTurn()
        },
        onerror: (event: unknown) => {
          if (waitingReject) waitingReject(new Error(`Gemini Live error: ${JSON.stringify(event)}`))
        },
        onclose: (event: { reason?: string; code?: number }) => {
          if (waitingReject) waitingReject(new Error(`Gemini Live closed: ${event.reason || event.code || "unknown"}`))
        },
      },
    })
    live = await Promise.race([
      connection,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out connecting to Gemini Live.")), 15_000)),
    ])
    await audit("lifecycle_connected", { scenario: scenario.id, runner: "text-turn" })

    const sendCustomer = async (text: string) => {
      latestCustomerText = text
      transcript.push({ role: "Customer", text })
      await audit("transcript_final", { transcript: { role: "customer", text, final: true } })
      const wait = waitForAgentTurn()
      live.sendRealtimeInput({ text })
      return wait
    }

    let agentText = await sendCustomer("Start the conversation by greeting me as the concierge.")
    if (!/Example Limo|Diane/i.test(agentText)) assertions.push("Greeting did not identify Example Limo or Diane.")
    agentText = await sendCustomer(scenario.opening)

    if (scenario.expected?.addressRepairFirst) {
      if (/\b(?:bag|luggage|phone)\b/i.test(agentText) || !/\b(?:state|new york)\b/i.test(agentText)) {
        throw new Error(`Incomplete address was not clarified immediately: ${agentText}`)
      }
      assertions.push("Incomplete pickup was clarified before later booking fields.")
    }

    for (let turn = 0; turn < MAX_CUSTOMER_TURNS && !checkoutUrl; turn += 1) {
      const customer = nextCustomerTurn(scenario, agentText, sent)
      if (!customer) throw new Error(`Could not determine the next customer response after: ${agentText}`)
      agentText = await sendCustomer(customer)
    }

    if (!latestQuote) throw new Error("Gemini never requested an authoritative quote.")
    if (!checkoutSelection) throw new Error("Gemini never completed server-verified vehicle selection.")
    if (!reservationId || !checkoutUrl) throw new Error("Gemini never completed simulated checkout.")
    if (tools.some((tool) => tool.status === "failed")) throw new Error("At least one Gemini tool call failed.")
    const finalAgentLine = [...transcript].reverse().find((line) => line.role === "Diane")?.text || ""
    if (/\b(?:sent|texted).{0,40}\b(?:phone|sms|text message)\b|\b(?:phone|sms|text message).{0,40}\b(?:sent|texted)\b/i.test(finalAgentLine)) {
      throw new Error(`Simulation checkout was incorrectly described as an SMS delivery: ${finalAgentLine}`)
    }
    if (scenario.expected?.spanishOnly) {
      const agentLines = transcript.filter((line) => line.role === "Diane").map((line) => line.text).join(" ")
      if (!isSpanishPrompt(agentLines)) throw new Error("Spanish scenario did not remain in Spanish.")
      assertions.push("Spanish response language detected.")
    }
    await audit("lifecycle_closed", { reason: "runner_complete" })
    live.close()
    return { scenario: scenario.id, title: scenario.title, runId: token.runId, providerMode: token.providerMode, status: "passed", reservationId, checkoutUrl, transcript, tools, assertions }
  } catch (error) {
    await audit("error", { detail: error instanceof Error ? error.message : "Unknown runner error" })
    await audit("lifecycle_closed", { reason: "runner_failed" })
    try { live?.close() } catch { /* Connection cleanup is best effort. */ }
    return { scenario: scenario.id, title: scenario.title, runId: token.runId, providerMode: token.providerMode, status: "failed", failure: error instanceof Error ? error.message : "Unknown runner error", transcript, tools, assertions }
  }
}

async function main() {
  const results: RunResult[] = []
  const selectedIds = new Set((process.env.EXAMPLE_LIMO_TEST_SCENARIOS || "").split(",").map((value) => value.trim()).filter(Boolean))
  const scenarios = selectedIds.size ? SCENARIOS.filter((scenario) => selectedIds.has(scenario.id)) : SCENARIOS
  if (!scenarios.length) throw new Error("No matching Example Limo live test scenarios were selected.")
  for (const [index, scenario] of scenarios.entries()) {
    results.push(await runScenario(scenario, index))
    await sleep(300)
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  }
  if (process.env.EXAMPLE_LIMO_TEST_REPORT_MODE === "summary") {
    console.log(JSON.stringify({
      ...summary,
      results: results.map((result) => ({
        scenario: result.scenario,
        title: result.title,
        runId: result.runId,
        status: result.status,
        failure: result.failure,
        reservationId: result.reservationId,
        checkoutUrl: result.checkoutUrl,
        lastAgentTurn: [...result.transcript].reverse().find((line) => line.role === "Diane")?.text,
        tools: result.tools.map((tool) => ({ name: tool.name, status: tool.status, error: tool.error })),
      })),
    }, null, 2))
  } else {
    console.log(JSON.stringify(summary, null, 2))
  }
  if (summary.failed) process.exitCode = 1
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
