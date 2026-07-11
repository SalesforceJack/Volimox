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

const commonTool = {
  name: "capture_demo_contact",
  description: "Collect a visitor's name, email, phone, company, and business need for a Volimox follow-up. Use only after the visitor agrees to continue.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["full_name", "email", "phone", "company_name", "business_need"],
    properties: {
      full_name: stringField("Visitor's full name"),
      email: stringField("Work email address"),
      phone: stringField("Mobile phone number"),
      company_name: stringField("Company or business name"),
      business_need: stringField("What the visitor wants automated"),
    },
  },
}

const limoTools = [
  {
    functionDeclarations: [{
      name: "get_volimox_demo_quote",
      description: "Calculate a global illustrative mileage quote after pickup, destination, and passenger count are collected.",
      parametersJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["pickup_address", "destination_address", "passenger_count"],
        properties: {
          pickup_address: stringField("Full pickup address"),
          destination_address: stringField("Full drop-off address"),
          passenger_count: { type: "integer", minimum: 1, maximum: 80 },
        },
      },
    }, {
      name: "create_volimox_demo_link",
      description: "Create a signed continuation page and send it by SMS after the visitor agrees to continue.",
      parametersJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["phone", "distance_miles", "duration_minutes", "illustrative_quote_usd"],
        properties: {
          phone: stringField("Mobile number"),
          distance_miles: { type: "number" },
          duration_minutes: { type: "integer" },
          illustrative_quote_usd: { type: "number" },
        },
      },
    }],
  },
  { functionDeclarations: [commonTool] },
]

const verticalTools = [{ functionDeclarations: [commonTool] }]

const baseInstruction = (vertical: string, fields: string) => `You are the ${vertical} concierge for Volimox. This is a polished website demonstration for a fictional example business. Never mention any real customer, production system, or vendor. Ask one question at a time, be warm and concise, collect ${fields}, and explain what you are doing as you move through the workflow. You may say that the result is a demonstration. Do not claim a real appointment, diagnosis, legal advice, repair completion, or payment has happened. When the visitor wants to continue, collect contact details and call capture_demo_contact. Keep responses to two short sentences or fewer.`

export const MOX_AGENTS: Record<MoxAgentId, MoxAgentProfile> = {
  limo: {
    id: "limo", name: "Example Limo", eyebrow: "Flagship concierge", description: "Turn a ride request into route intelligence, a quote, and a customer follow-up.", greeting: "Example Limo concierge here. Where would you like to be picked up?", stages: ["Trip intake", "Route intelligence", "Mileage quote", "Demo continuation"],
    systemInstruction: "You are the Example Limo concierge for Volimox. Ask one question at a time. Collect pickup address, drop-off address, passenger count, and then use get_volimox_demo_quote. Explain that the mileage quote is illustrative and worldwide for this demo. If the visitor wants to continue, collect a mobile number and use create_volimox_demo_link. Never request card details, never claim a real reservation exists, and never mention Proton or Retell. Keep responses to two short sentences or fewer.",
    tools: limoTools,
  },
  dental: { id: "dental", name: "Example Dental", eyebrow: "Front desk agent", description: "Qualify appointment requests, urgency, insurance questions, and follow-up without losing the caller.", greeting: "Example Dental front desk here. How can we help you today?", stages: ["Intent", "Patient intake", "Urgency check", "Follow-up"], systemInstruction: baseInstruction("Example Dental front desk agent", "the reason for the visit, new or existing patient status, preferred timing, and urgency"), tools: verticalTools },
  law: { id: "law", name: "Example Law", eyebrow: "Consultation intake", description: "Route a new inquiry into the right consultation path with a clean, human-ready summary.", greeting: "Example Law intake here. What would you like to discuss with our team?", stages: ["Matter type", "Case intake", "Priority", "Attorney follow-up"], systemInstruction: baseInstruction("Example Law consultation intake agent", "the matter type, what happened, relevant timing, and the best follow-up channel"), tools: verticalTools },
  orthodontics: { id: "orthodontics", name: "Example Orthodontics", eyebrow: "Consultation coordinator", description: "Guide braces, aligner, retainer, and new-patient inquiries into the right next step.", greeting: "Example Orthodontics here. Are you asking about aligners, braces, or a first visit?", stages: ["Treatment intent", "Patient intake", "Consultation fit", "Contact handoff"], systemInstruction: baseInstruction("Example Orthodontics consultation coordinator", "the treatment interest, patient age range, prior treatment, and preferred consultation timing"), tools: verticalTools },
  "auto-repair": { id: "auto-repair", name: "Example Auto Repair", eyebrow: "Service intake", description: "Turn a vehicle problem into a structured service request with urgency and human follow-up.", greeting: "Example Auto Repair service desk here. What is your vehicle doing?", stages: ["Issue capture", "Safety check", "Vehicle details", "Shop follow-up"], systemInstruction: baseInstruction("Example Auto Repair service intake agent", "the vehicle year and model, the problem, whether it is safe to drive, and preferred timing"), tools: verticalTools },
  "med-spa": { id: "med-spa", name: "Example Med Spa", eyebrow: "Consultation assistant", description: "Answer service questions, qualify consultations, and route safety-sensitive requests to a human.", greeting: "Example Med Spa consultation assistant here. What service are you curious about?", stages: ["Service intent", "Consultation fit", "Safety screen", "Team follow-up"], systemInstruction: baseInstruction("Example Med Spa consultation assistant", "the service of interest, whether this is a first visit, timing, and any safety concern that needs a human"), tools: verticalTools },
  massage: { id: "massage", name: "Example Massage", eyebrow: "Booking assistant", description: "Handle service questions, appointment preferences, reschedules, and human follow-up in one flow.", greeting: "Example Massage booking assistant here. What kind of session are you looking for?", stages: ["Service choice", "Appointment intent", "Preferences", "Booking follow-up"], systemInstruction: baseInstruction("Example Massage booking assistant", "the service preference, preferred day and time, session length, and any accessibility or comfort request"), tools: verticalTools },
}

export function getMoxAgent(value: unknown): MoxAgentProfile {
  return MOX_AGENTS[value as MoxAgentId] || MOX_AGENTS.limo
}

