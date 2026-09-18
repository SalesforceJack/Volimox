import { describe, expect, it } from "vitest"
import {
  answerAfterLatestQuestion,
  canonicalBookingFields,
  canonicalVehicleSelection,
  explicitCount,
  explicitPassengerAndLuggageCounts,
  explicitTripType,
  explicitVehicleChoice,
  type ClientQuoteState,
} from "@/lib/example-limo/client-state"
import { getMoxAgent } from "@/lib/mox-agents"
import { isExampleLimoFinalFarewell } from "@/lib/example-limo/voice-farewell"
import { buildExampleLimoWebVoiceInstruction } from "@/lib/example-limo/proton-web-voice-policy"

const QUOTE: ClientQuoteState = {
  quoteId: "elq_test",
  pickupAddress: "105 Osprey Court, Secaucus, NJ",
  destinationAddress: "767 5th Ave, New York, NY 10153",
  departureTimeIso: "2026-07-28T21:00:00-04:00",
  serviceType: "point_to_point",
  tripType: "one_way",
  passengerCount: 2,
  luggageCount: 0,
  phone: "+12016656767",
  quotes_by_vehicle: {
    "Luxury Sedan": {
      vehicleName: "Luxury Sedan",
      quoteFingerprint: "sedan-fingerprint-from-server",
      quotedTotalUsd: 96,
      quoteIssuedAt: "2026-07-27T09:39:21.841Z",
    },
    "Large SUV": {
      vehicleName: "Large SUV",
      quoteFingerprint: "suv-fingerprint-from-server",
      quotedTotalUsd: 131,
      quoteIssuedAt: "2026-07-27T09:39:21.841Z",
    },
  },
}

describe("Example Limo client-side voice evidence", () => {
  it("does not treat unrelated ASR as a trip type or luggage count", () => {
    expect(explicitTripType("Huawei")).toBeNull()
    expect(explicitTripType("one way")).toBe("one_way")
    expect(explicitTripType("Yes, this is a one-way ride for us.")).toBe("one_way")
    expect(explicitTripType("round trip")).toBe("round_trip")
    expect(explicitTripType("Yes, we will return after the event, so it is a round trip.")).toBe("round_trip")
    expect(explicitTripType("Sí, será un viaje de ida y vuelta.")).toBe("round_trip")
    expect(explicitTripType("We'd like to return right after the event.")).toBe("round_trip")
    expect(explicitTripType("Queremos regresar al punto de partida.")).toBe("round_trip")
    expect(explicitCount("No, la Grecia.", 0, 14)).toBeNull()
    expect(explicitCount("no luggage", 0, 14)).toBe(0)
    expect(explicitCount("I have two bags", 0, 14)).toBe(2)
    expect(explicitCount("dos maletas", 0, 14)).toBe(2)
    expect(explicitPassengerAndLuggageCounts("three passengers and two bags")).toEqual({ passengerCount: 3, luggageCount: 2 })
    expect(explicitPassengerAndLuggageCounts("tres pasajeros y dos maletas")).toEqual({ passengerCount: 3, luggageCount: 2 })
  })

  it("uses the Proton browser voice policy with Example Limo tool boundaries", () => {
    const agent = getMoxAgent("limo")
    const toolNames = (agent.tools as Array<{ functionDeclarations?: Array<{ name?: string }> }>)
      .flatMap((group) => group.functionDeclarations || [])
      .map((tool) => tool.name)
    expect(agent.greeting).toBe("Hi, this is Diane with Example Limo. If I get any information wrong, please correct me. How can I help you today?")
    expect(agent.systemInstruction).toContain("Diane speaks English")
    expect(agent.systemInstruction).not.toContain("continue in Spanish")
    expect(agent.systemInstruction).toContain("let the server resolve it")
    expect(agent.systemInstruction).toContain("Never ask \"is that correct?\"")
    expect(agent.systemInstruction).toContain("How many passengers, and how many bags?")
    expect(agent.systemInstruction).toContain("Do not claim that a text message, SMS, payment, dispatch, or booking confirmation was sent")
    expect(agent.systemInstruction).toContain("call verify_example_limo_address")
    expect(agent.systemInstruction).toContain("end_example_limo_conversation")
    expect(agent.systemInstruction).toContain("Behavior Profile")
    expect(agent.systemInstruction).toContain("Never guess policy, pricing, availability, or a consequential outcome")
    expect(agent.systemInstruction).not.toContain("Proton")
    expect(agent.systemInstruction).not.toContain("Retell")
    expect(JSON.stringify(agent.tools)).not.toContain("Proton")
    expect(toolNames).toContain("request_example_limo_dispatch")
    expect(toolNames).toContain("verify_example_limo_address")
    expect(toolNames).toContain("end_example_limo_conversation")
    expect(toolNames).not.toContain("capture_demo_contact")
  })

  it("adds the New York date-resolution table to both browser voice providers", () => {
    const instruction = buildExampleLimoWebVoiceInstruction(new Date("2026-08-27T15:00:00.000Z"))
    expect(instruction).toContain("CURRENT TIME")
    expect(instruction).toContain("DATE RESOLUTION — read these off the list. Do not count days yourself.")
    expect(instruction).toContain('"today" = Thursday, August 27, 2026')
    expect(instruction).toContain('"next week Thursday" = Thursday, September 3, 2026')
  })

  it("recognizes one final farewell and does not keep the voice session open", () => {
    expect(isExampleLimoFinalFarewell("Hasta luego.")).toBe(true)
    expect(isExampleLimoFinalFarewell("Goodbye.")).toBe(true)
    expect(isExampleLimoFinalFarewell("Thank you. Goodbye.")).toBe(true)
    expect(isExampleLimoFinalFarewell("Gracias por llamar. Hasta luego.")).toBe(true)
    expect(isExampleLimoFinalFarewell("Please say goodbye when we finish.")).toBe(false)
  })

  it("uses the answer after the latest matching field question", () => {
    const lines = [
      { role: "agent" as const, content: "Is this a one-way or round trip?" },
      { role: "user" as const, content: "Huawei" },
      { role: "agent" as const, content: "How much luggage will you have?" },
      { role: "user" as const, content: "No, la Grecia." },
      { role: "agent" as const, content: "How many bags will you have?" },
      { role: "user" as const, content: "Two bags" },
    ]
    expect(answerAfterLatestQuestion(lines, "trip_type")).toBe("Huawei")
    expect(answerAfterLatestQuestion(lines, "luggage_count")).toBe("Two bags")
  })

  it("matches accented Spanish count questions without losing the answer", () => {
    const lines = [
      { role: "agent" as const, content: "¿Cuántos pasajeros y cuántas maletas llevarán?" },
      { role: "user" as const, content: "Tres pasajeros y dos maletas." },
    ]
    expect(answerAfterLatestQuestion(lines, "passenger_count")).toBe("Tres pasajeros y dos maletas.")
    expect(answerAfterLatestQuestion(lines, "luggage_count")).toBe("Tres pasajeros y dos maletas.")
    expect(explicitPassengerAndLuggageCounts(answerAfterLatestQuestion(lines, "passenger_count"))).toEqual({ passengerCount: 3, luggageCount: 2 })
  })

  it("keeps a clear return answer when the customer does not repeat the words round trip", () => {
    const lines = [
      { role: "agent" as const, content: "Are you looking for a one-way or round trip?" },
      { role: "user" as const, content: "We'd like to return right after we finish at the Empire State Building." },
      { role: "agent" as const, content: "What time would you like to be picked up from the Empire State Building?" },
      { role: "user" as const, content: "Around 10 PM." },
    ]
    expect(explicitTripType(answerAfterLatestQuestion(lines, "trip_type"))).toBe("round_trip")
  })

  it("selects the exact server quote tuple instead of model-supplied opaque data", () => {
    expect(explicitVehicleChoice("large SUV")).toBe("Large SUV")
    expect(explicitVehicleChoice("I choose the Large SUV")).toBe("Large SUV")
    expect(explicitVehicleChoice("I think the luxury sedan will be fine for us. Let's go with that option at $125.")).toBe("Luxury Sedan")
    expect(explicitVehicleChoice("I definitely want to go with the SUV. Please proceed with the larger vehicle option.")).toBe("Large SUV")
    expect(explicitVehicleChoice("Quiero el vehículo más grande, la SUV.")).toBe("Large SUV")
    expect(explicitVehicleChoice("Quiero el sedán estándar.")).toBe("Luxury Sedan")
    const singleVehicleQuote = { ...QUOTE, quotes_by_vehicle: { "Large SUV": QUOTE.quotes_by_vehicle["Large SUV"] } }
    expect(canonicalVehicleSelection(singleVehicleQuote, "Yes, please").vehicleName).toBe("Large SUV")
    expect(explicitVehicleChoice("Did you say Sedan or SUV?")).toBeNull()
    const selected = canonicalVehicleSelection(QUOTE, "large SUV")
    expect(selected).toEqual({
      quoteId: "elq_test",
      vehicleName: "Large SUV",
      vehicleQuote: QUOTE.quotes_by_vehicle["Large SUV"],
    })
    expect(canonicalBookingFields(QUOTE)).toMatchObject({
      departure_time_iso: "2026-07-28T21:00:00-04:00",
      luggage_count: 0,
      phone: "+12016656767",
    })
  })
})
