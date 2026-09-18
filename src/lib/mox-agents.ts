import { PROTON_WEB_VOICE_LIMO_SYSTEM_INSTRUCTION } from "@/lib/example-limo/proton-web-voice-policy"

export type MoxAgentId = "limo" | "dental" | "law" | "orthodontics" | "auto-repair" | "med-spa" | "massage"

export type MoxAgentProfile = {
  id: MoxAgentId
  name: string
  eyebrow: string
  description: string
  greeting: string
  stages: string[]
  systemInstruction: string
  tools: unknown[]
}

const stringField = (description: string) => ({ type: "string", description })

const reservationTool = {
  name: "create_demo_reservation",
  description: "Create a clearly simulated reservation request for this example business only after the customer explicitly agrees to receive the simulated confirmation by SMS and email. This does not create a real calendar appointment.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["full_name", "email", "phone", "requested_start_iso", "service_summary", "details", "consent_sms", "consent_email"],
    properties: {
      full_name: stringField("Visitor's full name"),
      email: stringField("Customer email address"),
      phone: stringField("Customer mobile phone number"),
      requested_start_iso: stringField("Requested appointment date and time as an ISO-8601 timestamp"),
      time_zone: stringField("IANA time zone for the requested appointment, default America/New_York"),
      service_summary: stringField("Short name of the requested service or consultation"),
      details: stringField("Concise summary of the sector-specific intake details"),
      consent_sms: { type: "boolean", description: "True only after the customer explicitly agrees to the simulated confirmation by text message." },
      consent_email: { type: "boolean", description: "True only after the customer explicitly agrees to the simulated confirmation by email." },
    },
  },
}

const exampleLimoDispatchTool = {
  name: "request_example_limo_dispatch",
  description: "Capture a callback number for Example Limo senior dispatch when the request cannot receive an automatic Sedan/SUV quote. This is not a Volimox sales lead.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["phone", "service_summary"],
    properties: {
      phone: stringField("A valid 10-digit US callback number directly provided by the rider"),
      full_name: stringField("Optional rider name, only if directly provided"),
      service_summary: stringField("Short summary of the ride that requires dispatch"),
    },
  },
}

const exampleLimoAddressVerificationTool = {
  name: "verify_example_limo_address",
  description: "Verify and normalize exactly one pickup or destination address as soon as the rider gives it, before asking the next question. Never guess whether an address is real or wait until the quote to discover a bad address.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["address", "kind"],
    properties: {
      address: stringField("The single pickup or destination value exactly as the rider gave it"),
      kind: { type: "string", enum: ["pickup", "destination"], description: "Which booking field this address belongs to" },
    },
  },
}

const exampleLimoEndConversationTool = {
  name: "end_example_limo_conversation",
  description: "End the Example Limo browser voice session only after the final goodbye has been spoken and the rider needs nothing further. Never call this while a booking question is unanswered.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["reason"],
    properties: {
      reason: { type: "string", enum: ["booking_complete", "rider_said_goodbye", "no_further_help_needed"] },
    },
  },
}

const limoTools = [
  {
    functionDeclarations: [{
      name: "get_example_limo_quote",
      description: "Run the authoritative Example Limo quote engine only after every required booking field is directly confirmed. Recognized airports, venues, hotels, and landmarks may be passed as spoken; the server resolves them before routing. The first call returns all vehicle options that fit.",
      parametersJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["pickup_address", "destination_address", "departure_time_iso", "passenger_count", "luggage_count", "phone", "service_type", "airline"],
        properties: {
          pickup_address: stringField("Spoken pickup street address or recognizable place; the server resolves it with Google"),
          destination_address: stringField("Spoken drop-off street address or recognizable place; the server resolves it with Google"),
          departure_time_iso: stringField("Pickup time as an ISO-8601 timestamp"),
          return_departure_time_iso: stringField("Return pickup time as an ISO-8601 timestamp for round trips"),
          passenger_count: { type: "integer", minimum: 1, maximum: 6 },
          luggage_count: { type: "integer", minimum: 0, maximum: 14 },
          phone: stringField("Valid 10-digit US phone number directly provided by the visitor"),
          service_type: stringField("point_to_point, airport_departure, airport_arrival, special_event, or hourly"),
          trip_type: stringField("one_way or round_trip for non-airport rides"),
          stops: { type: "array", items: stringField("Intermediate stop location") },
          hours_requested: { type: "number", minimum: 2 },
          airline: stringField("For airport trips, the rider's direct answer to 'What airlines?'; use an empty string only after the rider says they do not know; use an empty string for non-airport trips"),
          vehicle_name: stringField("Only send after a customer explicitly selects Luxury Sedan or Large SUV; omit for the first dual quote"),
        },
      },
    }, exampleLimoAddressVerificationTool, exampleLimoEndConversationTool, {
      name: "send_example_limo_checkout_link",
      description: "Report the customer's intent only. Call action=select_vehicle for a clear Sedan/SUV choice. Call action=create_checkout only after a separate explicit yes to the exact selected price. The website attaches the authoritative quote and approval state.",
      parametersJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["action", "vehicle_name"],
        properties: {
          action: { type: "string", enum: ["select_vehicle", "create_checkout"], description: "Use select_vehicle for the customer's clear vehicle choice. Use create_checkout only for the later explicit price approval." },
          vehicle_name: stringField("The explicitly selected Luxury Sedan or Large SUV"),
          approval: stringField("Use yes only with create_checkout after the customer clearly approves the repeated selected price."),
        },
      },
    }],
  },
  { functionDeclarations: [exampleLimoDispatchTool] },
]

const verticalTools = [{ functionDeclarations: [reservationTool] }]

const baseInstruction = (vertical: string, fields: string) => `You are the ${vertical} concierge for Volimox. This is a polished website demonstration for a fictional example business. Never mention any real customer, production system, or vendor. Ask one question at a time, be warm and concise, and collect ${fields} plus the customer's full name, email, and mobile phone. Do not ask for a company name or a Volimox sales lead. Do not provide medical, legal, or mechanical advice beyond a brief safety handoff. Do not claim a real appointment, diagnosis, legal advice, repair completion, or payment has happened. Once the requested service, contact details, and a specific future date and time are captured, ask exactly one final question: "May I send this simulated confirmation by text message and email?" Only after a clear affirmative answer call create_demo_reservation with the complete intake, requested_start_iso, and consent_sms=true and consent_email=true. The tool creates a simulated reservation record only; read its result and state that no real appointment was booked. Never call the tool without explicit confirmation. Keep responses to two short sentences or fewer.`

export const MOX_AGENTS: Record<MoxAgentId, MoxAgentProfile> = {
  limo: {
    id: "limo", name: "Example Limo", eyebrow: "Flagship concierge", description: "Turn a ride request into route intelligence, dual vehicle pricing, and secure checkout.", greeting: "Hi, this is Diane with Example Limo. If I get any information wrong, please correct me. How can I help you today?", stages: ["Trip intake", "Route intelligence", "Vehicle selection", "Secure checkout"],
    systemInstruction: PROTON_WEB_VOICE_LIMO_SYSTEM_INSTRUCTION,
    tools: limoTools,
  },
  dental: { id: "dental", name: "Example Dental", eyebrow: "Front desk agent", description: "Qualify appointment requests, urgency, insurance questions, and follow-up without losing the caller.", greeting: "Example Dental front desk here. How can we help you today?", stages: ["Intent", "Patient intake", "Urgency check", "Demo reservation"], systemInstruction: baseInstruction("Example Dental front desk agent", "the reason for the visit, new or existing patient status, preferred date and time, and urgency"), tools: verticalTools },
  law: { id: "law", name: "Example Law", eyebrow: "Consultation intake", description: "Route a new inquiry into the right consultation path with a clean, human-ready summary.", greeting: "Example Law intake here. What would you like to discuss with our team?", stages: ["Matter type", "Case intake", "Priority", "Demo reservation"], systemInstruction: baseInstruction("Example Law consultation intake agent", "the matter type, what happened, relevant timing, urgency, and preferred consultation time"), tools: verticalTools },
  orthodontics: { id: "orthodontics", name: "Example Orthodontics", eyebrow: "Consultation coordinator", description: "Guide braces, aligner, retainer, and new-patient inquiries into the right next step.", greeting: "Example Orthodontics here. Are you asking about aligners, braces, or a first visit?", stages: ["Treatment intent", "Patient intake", "Consultation fit", "Demo reservation"], systemInstruction: baseInstruction("Example Orthodontics consultation coordinator", "the treatment interest, patient age range, prior treatment, and preferred consultation time"), tools: verticalTools },
  "auto-repair": { id: "auto-repair", name: "Example Auto Repair", eyebrow: "Service intake", description: "Turn a vehicle problem into a structured service request with urgency and human follow-up.", greeting: "Example Auto Repair service desk here. What is your vehicle doing?", stages: ["Issue capture", "Safety check", "Vehicle details", "Demo reservation"], systemInstruction: baseInstruction("Example Auto Repair service intake agent", "the vehicle year and model, the problem, whether it is safe to drive, and preferred service time"), tools: verticalTools },
  "med-spa": { id: "med-spa", name: "Example Med Spa", eyebrow: "Consultation assistant", description: "Answer service questions, qualify consultations, and route safety-sensitive requests to a human.", greeting: "Example Med Spa consultation assistant here. What service are you curious about?", stages: ["Service intent", "Consultation fit", "Safety screen", "Demo reservation"], systemInstruction: baseInstruction("Example Med Spa consultation assistant", "the service of interest, whether this is a first visit, preferred consultation time, and any safety concern that needs a human"), tools: verticalTools },
  massage: { id: "massage", name: "Example Massage", eyebrow: "Booking assistant", description: "Handle service questions, appointment preferences, reschedules, and human follow-up in one flow.", greeting: "Example Massage booking assistant here. What kind of session are you looking for?", stages: ["Service choice", "Appointment intent", "Preferences", "Demo reservation"], systemInstruction: baseInstruction("Example Massage booking assistant", "the service preference, preferred date and time, session length, and any accessibility or comfort request"), tools: verticalTools },
}

export function getMoxAgent(value: unknown): MoxAgentProfile {
  return MOX_AGENTS[value as MoxAgentId] || MOX_AGENTS.limo
}
