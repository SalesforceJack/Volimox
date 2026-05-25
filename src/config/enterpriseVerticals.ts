/**
 * Volimox — Enterprise Vertical Configuration
 *
 * Type-safe structural data mapping four core operational sectors.
 */

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface PipelineStage {
  label: string
  description: string
  technicalDetail: string
}

export interface IntegrationDetail {
  name: string
  category: string
  description: string
  isProductionProven: boolean
}

export interface CaseStudyReference {
  name: string
  status: "production" | "reference"
  description: string
}

export interface VerticalMetrics {
  automatedInteractions: number
  avgSettlementTimeSec: number
  hallucinationRate: string
}

export interface EnterpriseVertical {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  icon: string
  inboundTriggers: string[]
  coreAgentLogic: string[]
  pipelineStages: PipelineStage[]
  integrations: IntegrationDetail[]
  caseStudy: CaseStudyReference
  metrics: VerticalMetrics
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const enterpriseVerticals: EnterpriseVertical[] = [
  {
    id: "logistics-fleet",
    slug: "logistics-fleet",
    title: "Premium Logistics & Fleet Orchestration",
    subtitle:
      "Voice-first dispatch AI that books, quotes, and dispatches luxury fleets in under 45 seconds.",
    description:
      "End-to-end AI automation for premium ground transportation providers. Handles multi-stop ride quoting, passenger/luggage parameter arrays, real-time Maps routing, Stripe payment orchestration, and Salesforce CRM synchronization — all through a voice or chat interface. The same architecture that powers Proton Limo's 24/7 AI concierge.",
    icon: "Truck",
    inboundTriggers: [
      "Retell AI Voice Stream initialization",
      "Custom Web Chat Widget session start",
      "SMS concierge thread activation",
    ],
    coreAgentLogic: [
      "State-machine slot filling (pickup/dropoff geocoding, event datetime extraction, passenger/luggage parameter arrays)",
      "Dynamic multi-route complexity scoring via Google Maps Routes API",
    ],
    pipelineStages: [
      {
        label: "Ingestion Layer",
        description:
          "Voice or chat intake with geospatial slot extraction — addresses, datetimes, passenger counts, luggage items, and special requests captured through multi-turn conversational state machine.",
        technicalDetail:
          "Retell AI voice agent with custom LLM policy for slot filling; web chat widget backed by the same LLM policy. Geocoding via Google Maps Geocoding API on each address turn.",
      },
      {
        label: "AI Cognitive Orchestration",
        description:
          "Deterministic state-machine routing with dynamic quote computation. Multi-stop complexity scoring, vehicle-class matching, and fare calculation based on distance/duration matrices.",
        technicalDetail:
          "Custom TypeScript state machine. Google Maps Routes API for distance/duration matrices. Tiered pricing model with vehicle-class multipliers.",
      },
      {
        label: "External Tool Execution",
        description:
          "Stripe PaymentIntent creation with pre-authorization holds; secure payment link delivery via Twilio SMS or email; real-time Maps route validation.",
        technicalDetail:
          "Stripe Billing Engine for pre-authorization holds & captures. Twilio SMS/Email for secure payment link delivery. Google Maps Routes API for live route validation before dispatch.",
      },
      {
        label: "Enterprise Record Fulfillment",
        description:
          "Full CRM synchronization — Lead/Opportunity auto-generation, Field Service scheduling, and post-ride follow-up automation in Salesforce.",
        technicalDetail:
          "Salesforce Agentforce for Lead/Opportunity auto-generation. Field Service Lightning for dispatch tracking. Automated post-ride satisfaction surveys.",
      },
    ],
    integrations: [
      {
        name: "Google Maps Routes API",
        category: "Maps & Routing",
        description:
          "Distance/duration matrices, geocoding, and live route validation for multi-stop ride quoting and dispatch.",
        isProductionProven: true,
      },
      {
        name: "Stripe Billing Engine",
        category: "Payments",
        description:
          "Pre-authorization holds, captures, and secure payment link generation for luxury transportation bookings.",
        isProductionProven: true,
      },
      {
        name: "Twilio SMS / Email",
        category: "Communications",
        description:
          "Secure payment link delivery, booking confirmations, and concierge thread management via SMS and email.",
        isProductionProven: true,
      },
      {
        name: "Salesforce Agentforce",
        category: "CRM & Field Service",
        description:
          "Lead/Opportunity auto-generation, Field Service dispatch tracking, and post-ride follow-up automation.",
        isProductionProven: true,
      },
    ],
    caseStudy: {
      name: "Proton Limo",
      status: "production",
      description:
        "Active Production-Grade Benchmark. 24/7 AI concierge handling luxury ground transportation across voice, chat, and SMS channels. Processes thousands of automated interactions monthly with zero hallucination in quote computation. Full Stripe + Salesforce integration in live production since deployment.",
    },
    metrics: {
      automatedInteractions: 142904,
      avgSettlementTimeSec: 42,
      hallucinationRate: "0.00%",
    },
  },
  {
    id: "manufacturing-supply-chain",
    slug: "manufacturing-supply-chain",
    title: "Automated Manufacturing Supply Chain",
    subtitle:
      "AI that resolves EDI failures, validates SKUs, and generates wholesale quotes autonomously.",
    description:
      "Intelligent supply-chain automation for B2B manufacturers and distributors. Ingests EDI 850/855 transmission failures, parses wholesale invoice emails, and handles procurement support calls. Validates structural SKUs against SAP S/4HANA, computes freight weight/volume matrices, and resolves material-grade ambiguities before routing through Stripe Wholesale Invoicing and NetSuite CRM.",
    icon: "Factory",
    inboundTriggers: [
      "Automated EDI 850/855 transmission failure escalation",
      "Wholesale email invoice parsing trigger",
      "B2B procurement support line dialogue",
    ],
    coreAgentLogic: [
      "Advanced inventory lookup with structural SKU validation",
      "Freight weight/volume capacity calculation matrices",
      "Material grade ambiguity resolution",
    ],
    pipelineStages: [
      {
        label: "Ingestion Layer",
        description:
          "EDI 850/855 failure events, wholesale invoice emails, and B2B procurement voice calls captured and normalized into structured intake records.",
        technicalDetail:
          "EDI failure webhook listener with retry-aware parsing. Email parsing via NLP extraction of invoice line items. Voice intake via Retell AI with procurement-domain LLM policy.",
      },
      {
        label: "AI Cognitive Orchestration",
        description:
          "Structural SKU validation against ERP master data, freight weight/volume capacity computation, and material-grade ambiguity resolution through deterministic rule engines.",
        technicalDetail:
          "SKU validation against SAP S/4HANA material master. Freight capacity matrices with dimensional weight calculations. Rule-based material-grade disambiguation with confidence scoring.",
      },
      {
        label: "External Tool Execution",
        description:
          "SAP S/4HANA ERP API calls for inventory and pricing; FreightQuote Engine for carrier rate comparison; Stripe Wholesale Invoicing for B2B payment terms.",
        technicalDetail:
          "SAP S/4HANA ERP APIs for real-time inventory and pricing. FreightQuote Engine integration for multi-carrier rate comparison. Stripe Wholesale Invoicing with net-terms support.",
      },
      {
        label: "Enterprise Record Fulfillment",
        description:
          "Full order-to-cash synchronization — Oracle NetSuite ERP record creation and Salesforce Revenue Cloud opportunity tracking.",
        technicalDetail:
          "Oracle NetSuite ERP for order and invoice record creation. Salesforce Revenue Cloud for B2B opportunity pipeline management and revenue forecasting.",
      },
    ],
    integrations: [
      {
        name: "SAP S/4HANA ERP APIs",
        category: "ERP & Inventory",
        description: "Real-time inventory lookup, SKU validation, and pricing queries against the manufacturing material master.",
        isProductionProven: false,
      },
      {
        name: "FreightQuote Engine",
        category: "Logistics & Freight",
        description: "Multi-carrier freight rate comparison with dimensional weight and capacity matrix calculations.",
        isProductionProven: false,
      },
      {
        name: "Stripe Wholesale Invoicing",
        category: "Payments",
        description: "B2B invoicing with net-terms support, purchase-order tracking, and automated reconciliation.",
        isProductionProven: false,
      },
      {
        name: "Oracle NetSuite / Salesforce Revenue Cloud",
        category: "CRM & ERP",
        description: "Order-to-cash synchronization across NetSuite ERP and Salesforce Revenue Cloud opportunity pipelines.",
        isProductionProven: false,
      },
    ],
    caseStudy: {
      name: "Mock Reference Architecture",
      status: "reference",
      description:
        "Reference architecture demonstrating EDI failure recovery, SKU validation, and wholesale quote generation for a mid-sized industrial manufacturer. Blueprint for production deployment.",
    },
    metrics: {
      automatedInteractions: 67300,
      avgSettlementTimeSec: 89,
      hallucinationRate: "0.01%",
    },
  },
  {
    id: "real-estate-operations",
    slug: "real-estate-operations",
    title: "Autonomous Real Estate Operations",
    subtitle:
      "AI that pre-qualifies leads, locks in showings, and collects earnest-money deposits — all hands-free.",
    description:
      "Full-funnel real estate automation from lead capture to showing confirmation. Ingests voice inquiries from property signboard IVR, Zillow/Realtor.com webhooks, and web lead forms. Runs high-intent pre-qualification (credit, timeline, down-payment capacity), locks showing slots across Google/Outlook calendars, and collects Stripe deposit links — all while syncing to Salesforce Financial Services Cloud.",
    icon: "Building2",
    inboundTriggers: [
      "Inbound voice inquiry via property signboard IVR",
      "Zillow/Realtor.com webhook lead capture",
      "Web lead capture form submission",
    ],
    coreAgentLogic: [
      "High-intent pre-qualification engine (credit parameter verification, timeline assessment, down-payment capacity)",
      "Multi-agent calendar locking (Google/Outlook availability intersection)",
    ],
    pipelineStages: [
      {
        label: "Ingestion Layer",
        description:
          "Voice calls from property signboards, Zillow/Realtor.com webhook payloads, and web lead forms normalized into unified lead records with source attribution.",
        technicalDetail:
          "Twilio IVR for signboard call routing to Retell AI agent. Zillow/Realtor.com webhook listeners with schema normalization. Custom web form with reCAPTCHA and source tracking.",
      },
      {
        label: "AI Cognitive Orchestration",
        description:
          "High-intent pre-qualification engine assesses credit parameters, purchase timeline, and down-payment capacity. Multi-agent calendar intersection across Google and Outlook.",
        technicalDetail:
          "Rule-based pre-qualification scoring with configurable thresholds. Google Calendar API + Microsoft Graph API for multi-agent availability intersection with conflict resolution.",
      },
      {
        label: "External Tool Execution",
        description:
          "MLS data feed pull for property details and comps; calendar slot locking; Stripe deposit link generation for earnest-money collection.",
        technicalDetail:
          "MLS Data Feeds (RETS/Web API) for real-time property data. Google/Outlook Calendar APIs for slot creation. Stripe Deposit Links for earnest-money holds with compliance tracking.",
      },
      {
        label: "Enterprise Record Fulfillment",
        description:
          "Full lead-to-close pipeline sync in Salesforce Financial Services Cloud with automated nurture sequences and agent assignment.",
        technicalDetail:
          "Salesforce Financial Services Cloud for lead, contact, and opportunity management. Automated round-robin agent assignment. Drip nurture sequences via Salesforce Marketing Cloud.",
      },
    ],
    integrations: [
      {
        name: "MLS Data Feeds",
        category: "Real Estate Data",
        description: "Real-time property listing data, comps, and market analytics via RETS and Web API feeds.",
        isProductionProven: false,
      },
      {
        name: "Google / Outlook Calendar APIs",
        category: "Scheduling",
        description: "Multi-agent availability intersection, showing slot creation, and automated confirmation notifications.",
        isProductionProven: false,
      },
      {
        name: "Stripe Deposit Links",
        category: "Payments",
        description: "Earnest-money deposit collection with compliance tracking and automated receipt generation.",
        isProductionProven: false,
      },
      {
        name: "Salesforce Financial Services Cloud",
        category: "CRM",
        description: "Lead-to-close pipeline management, agent assignment, and automated nurture sequences for real estate transactions.",
        isProductionProven: false,
      },
    ],
    caseStudy: {
      name: "Mock Reference Architecture",
      status: "reference",
      description:
        "Reference architecture showcasing AI-driven lead pre-qualification, calendar orchestration, and deposit collection for a multi-agent real estate brokerage. Blueprint for production deployment.",
    },
    metrics: {
      automatedInteractions: 89100,
      avgSettlementTimeSec: 67,
      hallucinationRate: "0.00%",
    },
  },
  {
    id: "healthcare-triage",
    slug: "healthcare-triage",
    title: "Outpatient Healthcare Logistics & Triage",
    subtitle:
      "HIPAA-compliant AI that schedules appointments, pairs medical transport, and collects copays.",
    description:
      "Patient-facing AI automation for outpatient clinics and healthcare networks. Handles appointment scheduling from EHR portals and voice calls, post-discharge medical transit coordination, and multi-clinic referral routing. HIPAA-compliant slot matching across clinic networks, medical transport modality pairing (wheelchair-accessible vs. ambulatory), and secure copay collection — all synced to Health Cloud CRM.",
    icon: "Stethoscope",
    inboundTriggers: [
      "Patient appointment scheduling request (EHR portal or voice)",
      "Post-discharge medical transit inquiry",
      "Multi-clinic referral coordination call",
    ],
    coreAgentLogic: [
      "HIPAA-compliant appointment slot matching across clinic networks",
      "Medical transport modality pairing (wheelchair-accessible vs. ambulatory van allocation)",
    ],
    pipelineStages: [
      {
        label: "Ingestion Layer",
        description:
          "Appointment requests from Epic EHR patient portal and voice calls, post-discharge transit inquiries, and multi-clinic referral calls normalized into HIPAA-compliant intake records.",
        technicalDetail:
          "Epic Systems EHR/EMR patient portal webhook integration. Retell AI voice agent with HIPAA-compliant LLM policy. FHIR R4 resource normalization for interoperability.",
      },
      {
        label: "AI Cognitive Orchestration",
        description:
          "HIPAA-compliant slot matching across clinic networks with provider specialty, location, and availability filtering. Medical transport modality pairing based on patient mobility requirements.",
        technicalDetail:
          "Appointment slot matching engine with FHIR Schedule/Slot resources. Transport modality classifier using patient mobility flags (wheelchair, ambulatory, bariatric). Clinic network routing with proximity scoring.",
      },
      {
        label: "External Tool Execution",
        description:
          "Epic EHR appointment creation; medical transport dispatch; Secure Copay Collection via Stripe with HIPAA-compliant payment tokenization.",
        technicalDetail:
          "Epic Systems FHIR APIs for appointment creation and modification. Medical transport API for modality-specific dispatch. Stripe with Healthcare-specific tokenization for copay collection.",
      },
      {
        label: "Enterprise Record Fulfillment",
        description:
          "Full patient journey synchronization in Salesforce Health Cloud — appointment records, transport logs, copay reconciliation, and post-visit follow-up automation.",
        technicalDetail:
          "Salesforce Health Cloud for patient 360 records, care coordination, and population health analytics. Automated post-visit satisfaction surveys. Copay reconciliation with EHR billing.",
      },
    ],
    integrations: [
      {
        name: "Epic Systems EHR / EMR",
        category: "Healthcare IT",
        description: "FHIR R4 APIs for patient appointment scheduling, clinical data exchange, and provider directory integration.",
        isProductionProven: false,
      },
      {
        name: "Secure Copay Collection (Stripe)",
        category: "Payments",
        description: "HIPAA-compliant payment tokenization for patient copay and deductible collection with healthcare-specific Stripe configuration.",
        isProductionProven: false,
      },
      {
        name: "Health Cloud CRM (Salesforce)",
        category: "CRM",
        description: "Patient 360 records, care coordination workflows, and population health analytics synced in real time.",
        isProductionProven: false,
      },
      {
        name: "Medical Transport API",
        category: "Logistics",
        description: "Modality-specific dispatch for wheelchair-accessible vans, ambulatory transport, and bariatric-capable vehicles.",
        isProductionProven: false,
      },
    ],
    caseStudy: {
      name: "Mock Reference Architecture",
      status: "reference",
      description:
        "Reference architecture demonstrating HIPAA-compliant appointment scheduling, medical transport coordination, and copay collection for a multi-clinic outpatient network. Blueprint for production deployment.",
    },
    metrics: {
      automatedInteractions: 112500,
      avgSettlementTimeSec: 38,
      hallucinationRate: "0.00%",
    },
  },
]

export { enterpriseVerticals }
export default enterpriseVerticals
