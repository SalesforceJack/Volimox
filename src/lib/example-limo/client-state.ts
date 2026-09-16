export type ClientTranscriptLine = {
  role: "agent" | "user"
  content: string
}

export type ClientVehicleQuote = {
  vehicleName: "Luxury Sedan" | "Large SUV"
  quoteFingerprint: string
  quotedTotalUsd: number
  quoteIssuedAt: string
}

export type ClientQuoteState = {
  quoteId: string
  pickupAddress: string
  destinationAddress: string
  departureTimeIso: string
  serviceType: string
  tripType: string
  passengerCount: number
  luggageCount: number
  phone: string
  returnDepartureTimeIso?: string
  stops?: string[]
  hoursRequested?: number
  airline?: string
  quotes_by_vehicle: Partial<Record<ClientVehicleQuote["vehicleName"], ClientVehicleQuote>>
}

export type ClientCheckoutSelection = ClientVehicleQuote & {
  quoteId: string
  approvalIntentToken: string
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  uno: 1,
  una: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
}

function normalizedWords(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function explicitVehicleChoice(value: unknown): ClientVehicleQuote["vehicleName"] | null {
  const normalized = normalizedWords(value)
  const mentionsSuv = /\b(?:large )?suv\b|\bsport utility vehicle\b|\b(?:the )?(?:bigger|larger|more spacious|more room) option\b|\b(?:vehiculo|coche) (?:mas )?(?:grande|espacioso)\b/.test(normalized)
  const mentionsSedan = /\b(?:luxury )?sedan\b|\bstandard car\b|\b(?:the )?(?:cheaper|standard|smaller) option\b|\b(?:coche|vehiculo) (?:estandar|pequeno)\b/.test(normalized)

  // A selection can be a full sentence after the dual quote. It is safe only
  // when it identifies exactly one of the two quoted vehicle types.
  if (mentionsSuv === mentionsSedan) return null
  if (mentionsSuv) return "Large SUV"
  if (mentionsSedan) return "Luxury Sedan"
  return null
}

export function isClearAffirmative(value: unknown) {
  const normalized = normalizedWords(value)
  if (!normalized || /\b(?:but|instead|change|not|no)\b/.test(normalized)) return false
  return /^(?:yes|yeah|yep|okay|ok|sure|go ahead|that works|thats correct|correct|si|si por favor|adelante|de acuerdo|correcto)\b/.test(normalized)
}

export function explicitTripType(value: unknown): "one_way" | "round_trip" | null {
  const normalized = normalizedWords(value)
  if (!normalized) return null
  const saysOneWay = /\b(?:one way|oneway|solo ida|solo de ida)\b/.test(normalized)
  const saysRoundTrip = /\b(?:round trip|roundtrip|return trip|both ways|ida y vuelta|viaje de ida y vuelta)\b/.test(normalized)
  if (saysOneWay && saysRoundTrip) return null
  if (saysOneWay) return "one_way"
  if (saysRoundTrip) return "round_trip"
  // A rider can clearly state a return without repeating the exact phrase
  // "round trip". These phrases still bind the vehicle to two route legs.
  if (
    /\b(?:i|we)(?:d| would)?(?: like| want| plan| need)? to return\b|\b(?:i|we)(?: will|ll)? return\b|\breturn(?:ing)? to (?:the )?(?:original )?(?:pickup|starting point|address)\b|\b(?:bring|take) (?:me|us) back\b|\bgo back after\b/.test(
      normalized,
    )
  )
    return "round_trip"
  if (/\b(?:ida y vuelta|viaje de ida y vuelta|(?:queremos|quiero|vamos a) regresar|regresar(?:emos)?|volver(?:emos)?|de vuelta)\b/.test(normalized)) return "round_trip"
  return null
}

function parseCountToken(value: string) {
  if (/^\d{1,2}$/.test(value)) return Number(value)
  return NUMBER_WORDS[value]
}

export function explicitCount(value: unknown, minimum: number, maximum: number): number | null {
  const normalized = normalizedWords(value)
  if (!normalized) return null
  if (minimum === 0 && /^(?:no|none|zero|no bags|no luggage)$/.test(normalized)) return 0

  const digitMatch = normalized.match(/\b(\d{1,2})\b/)
  const wordMatch = Object.entries(NUMBER_WORDS).find(([word]) => new RegExp(`\\b${word}\\b`).test(normalized))
  const count = digitMatch ? Number(digitMatch[1]) : wordMatch?.[1]
  return typeof count === "number" && Number.isInteger(count) && count >= minimum && count <= maximum ? count : null
}

/** Parse a combined answer without assigning the passenger number to luggage. */
export function explicitPassengerAndLuggageCounts(value: unknown) {
  const normalized = normalizedWords(value)
  const token = "(?:\\d{1,2}|" + Object.keys(NUMBER_WORDS).join("|") + ")"
  const passengerMatch = normalized.match(new RegExp(`\\b(${token})\\b\\s*(?:passengers?|people|persons?|riders?|pasajeros?|personas?|of us)\\b`))
  const luggageMatch = normalized.match(new RegExp(`\\b(${token})\\b\\s*(?:bags?|pieces?(?: of)? luggage|suitcases?|luggage|maletas?|equipaje|valijas?)\\b`))
  const passengerCount = passengerMatch ? parseCountToken(passengerMatch[1]) : null
  const luggageCount = luggageMatch ? parseCountToken(luggageMatch[1]) : null
  return {
    passengerCount: typeof passengerCount === "number" && passengerCount >= 1 && passengerCount <= 6 ? passengerCount : null,
    luggageCount: typeof luggageCount === "number" && luggageCount >= 0 && luggageCount <= 14 ? luggageCount : null,
  }
}

const QUESTION_PATTERNS = {
  trip_type: (text: string) => /\b(?:one[- ]?way|round[- ]?trip|return trip|ida y vuelta|solo ida)\b/i.test(normalizedWords(text)),
  passenger_count: (text: string) => /\b(?:how many|number of)\b.*\b(?:passengers?|people|riders?)\b|\b(?:cuantos|cuantas)\b.*\b(?:pasajeros?|personas?)\b/i.test(normalizedWords(text)),
  luggage_count: (text: string) => /\b(?:luggage|bags?|maletas?|equipaje)\b/i.test(normalizedWords(text)) && /\b(?:how much|how many|will you have|are you bringing|cuantas|cuanto)\b/i.test(normalizedWords(text)),
}

export function answerAfterLatestQuestion(
  lines: ClientTranscriptLine[],
  field: keyof typeof QUESTION_PATTERNS,
): string | null {
  const matches = QUESTION_PATTERNS[field]
  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const question = lines[index]
    const answer = lines[index + 1]
    if (question.role === "agent" && question.content.includes("?") && matches(question.content) && answer?.role === "user") {
      return answer.content.trim()
    }
  }
  return null
}

export function canonicalVehicleSelection(quote: ClientQuoteState | null, utterance: unknown) {
  if (!quote?.quoteId) throw new Error("The current quote is unavailable. Please request the quote again.")
  let vehicleName = explicitVehicleChoice(utterance)
  if (!vehicleName && isClearAffirmative(utterance)) {
    const available = (["Luxury Sedan", "Large SUV"] as const).filter((candidate) => Boolean(quote.quotes_by_vehicle?.[candidate]))
    if (available.length === 1) vehicleName = available[0]
  }
  if (!vehicleName) throw new Error("Please ask the customer to clearly choose Sedan or SUV.")
  const vehicleQuote = quote.quotes_by_vehicle?.[vehicleName]
  if (!vehicleQuote?.quoteFingerprint || !vehicleQuote.quoteIssuedAt || !Number.isFinite(vehicleQuote.quotedTotalUsd)) {
    throw new Error("The selected vehicle quote is unavailable. Please request the quote again.")
  }
  return { quoteId: quote.quoteId, vehicleName, vehicleQuote }
}

export function canonicalBookingFields(quote: ClientQuoteState) {
  return {
    pickup_address: quote.pickupAddress,
    destination_address: quote.destinationAddress,
    departure_time_iso: quote.departureTimeIso,
    service_type: quote.serviceType,
    trip_type: quote.tripType,
    passenger_count: quote.passengerCount,
    luggage_count: quote.luggageCount,
    phone: quote.phone,
    ...(quote.returnDepartureTimeIso ? { return_departure_time_iso: quote.returnDepartureTimeIso } : {}),
    ...(quote.stops?.length ? { stops: quote.stops } : {}),
    ...(quote.hoursRequested ? { hours_requested: quote.hoursRequested } : {}),
    ...(quote.airline ? { airline: quote.airline } : {}),
  }
}
