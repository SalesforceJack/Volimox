import type { IntegrationSlug } from "./integrationCatalog"

export type IntegrationWorkflowScenario = {
  title: string
  summary: string
  trigger: string
  steps: string[]
  checkpoint: string
  outcome: string
}
const scenario = (
  title: string,
  summary: string,
  trigger: string,
  steps: string[],
  checkpoint: string,
  outcome: string,
): IntegrationWorkflowScenario => ({ title, summary, trigger, steps, checkpoint, outcome })

export const integrationWorkflowScenarios: Record<IntegrationSlug, IntegrationWorkflowScenario[]> = {
  gmail: [
    scenario(
      "New inquiry to dispatch brief",
      "Turn an unstructured customer email into a reviewable Volimox lead.",
      "A new Gmail message contains a service request, booking question, or missed-call reply.",
      [
        "Volimox reads the thread and extracts the customer, service, timing, and location fields.",
        "Volimox creates a normalized lead brief and routes it to the configured owner.",
        "The owner reviews missing details before a quote or callback is sent.",
      ],
      "A human confirms the extracted details before any customer-facing reply.",
      "One searchable lead with the original email thread attached.",
    ),
    scenario(
      "Workflow status to customer update",
      "Keep the customer informed when a quote, booking, or callback changes state.",
      "A Volimox workflow reaches a customer-notification state.",
      [
        "Volimox selects the matching Gmail thread from the lead record.",
        "Volimox prepares a short update using the approved message template.",
        "The assigned operator approves the draft or sends it through the configured policy.",
      ],
      "The operator can edit or stop the draft before it is sent.",
      "Clear customer communication without losing the operational context.",
    ),
  ],
  "microsoft-outlook": [
    scenario(
      "Email to Microsoft 365 intake task",
      "Convert a customer email into an accountable operations task.",
      "A new Outlook email arrives in the monitored service or dispatch inbox.",
      [
        "Volimox extracts the request, urgency, preferred time, and contact details.",
        "Volimox creates a structured lead and assigns the task to the right Microsoft 365 owner.",
        "The owner reviews the brief and chooses the next customer or dispatch action.",
      ],
      "Required fields and ownership are checked before the task is considered ready.",
      "An inbox request becomes a visible task with a clear owner and next step.",
    ),
    scenario(
      "Status change to controlled email",
      "Send a consistent customer update when a job or booking moves forward.",
      "A quote, appointment, or dispatch status changes in Volimox.",
      [
        "Volimox loads the approved Outlook template for that status.",
        "Volimox inserts only the verified customer and booking fields.",
        "The team member approves the message and the activity is recorded against the lead.",
      ],
      "An authorized team member remains responsible for the final send.",
      "Every customer update is traceable to the workflow event that caused it.",
    ),
  ],
  slack: [
    scenario(
      "High-intent lead alert",
      "Give the sales or dispatch channel a useful lead summary instead of a raw notification.",
      "A conversation reaches the configured high-intent score or contains all required booking fields.",
      [
        "Volimox summarizes the request, service type, timing, location, and missing fields.",
        "Volimox posts the lead card to a private Slack channel.",
        "The assigned operator claims the lead and the claim is written back to the workflow.",
      ],
      "Only the configured channel receives the lead, and a person claims ownership.",
      "The right team sees the next actionable lead without searching multiple inboxes.",
    ),
    scenario(
      "Exception escalation",
      "Move a workflow exception to a human before it becomes a customer problem.",
      "A provider fails, a required field is missing, or a customer asks for something outside policy.",
      [
        "Volimox pauses the automated path and records the reason in the lead timeline.",
        "Volimox sends a concise exception message to the configured Slack channel.",
        "The operator resolves the issue, adds a note, and resumes or closes the workflow.",
      ],
      "Automation stops until a human chooses resume, reroute, or close.",
      "Exceptions become owned work instead of silent failures.",
    ),
  ],
  "microsoft-teams": [
    scenario(
      "New lead to team channel",
      "Put a structured customer request in front of the correct Microsoft Teams group.",
      "Volimox creates a lead that matches the team, region, or service rule.",
      [
        "Volimox normalizes the customer request and adds the source and urgency.",
        "Volimox posts the lead card to the selected team and channel.",
        "A team member accepts the handoff and becomes the accountable owner.",
      ],
      "The destination team and channel are configured before the first notification is sent.",
      "The request reaches the right operations group with enough context to act.",
    ),
    scenario(
      "Missed call escalation",
      "Alert the on-call team when a text-back flow needs human help.",
      "A missed-call conversation cannot be completed by the configured automation rules.",
      [
        "Volimox records the missed call and the attempted customer follow-up.",
        "Volimox posts the reason, customer contact, and recommended next step to Teams.",
        "The on-call operator takes ownership and updates the workflow state.",
      ],
      "The operator decides whether to call, message, or request more information.",
      "A difficult callback is visible to the person who can resolve it.",
    ),
  ],
  twilio: [
    scenario(
      "Missed call to text-back lead",
      "Recover a missed call with a useful SMS and capture the customer request.",
      "Twilio reports a missed call to the Volimox number.",
      [
        "Volimox creates a durable conversation record with the call event and phone number.",
        "Volimox sends the approved text-back message asking what help the customer needs.",
        "The inbound reply is attached to the same lead and made visible to the operator.",
      ],
      "The message template, opt-out language, and retry policy are configured before activation.",
      "A missed call becomes a captured service request instead of a lost opportunity.",
    ),
    scenario(
      "Inbound SMS to booked follow-up",
      "Turn a customer reply into a prepared callback or booking handoff.",
      "Twilio receives an inbound SMS that matches an active Volimox conversation.",
      [
        "Volimox reconciles the provider message to the existing conversation without duplicating it.",
        "Volimox extracts the requested service, timing, and response intent.",
        "Volimox prepares a callback, quote, or calendar handoff for the assigned operator.",
      ],
      "Ambiguous replies stay in review instead of triggering an unsupported action.",
      "The customer reply is connected to one durable lead and one next action.",
    ),
  ],
  ringcentral: [
    scenario(
      "Call outcome to customer record",
      "Keep a completed business call connected to the customer and service request.",
      "A RingCentral call ends and includes a usable caller identity or note.",
      [
        "Volimox matches the caller to an existing lead or opens a new intake record.",
        "Volimox stores the call outcome and requested follow-up.",
        "The assigned operator receives the next action instead of a disconnected call log.",
      ],
      "The operator resolves ambiguous caller matches before a record is updated.",
      "Call activity and follow-up ownership stay together.",
    ),
    scenario(
      "Voicemail to review queue",
      "Route a voicemail into a small, prioritized callback queue.",
      "RingCentral receives a new voicemail or SMS that needs a response.",
      [
        "Volimox transcribes or summarizes the available message metadata.",
        "Volimox creates a callback task with urgency and the original contact reference.",
        "The operator reviews the task and sends an approved SMS or starts a call.",
      ],
      "No outbound contact is made until the operator confirms the callback intent.",
      "Voicemails stop sitting in a shared inbox without ownership.",
    ),
  ],
  "google-calendar": [
    scenario(
      "Qualified request to calendar hold",
      "Create a reviewable time hold once a customer has supplied the required booking details.",
      "A Volimox conversation is qualified with service, location, duration, and preferred time.",
      [
        "Volimox checks the configured calendar for availability.",
        "Volimox creates a tentative event with the lead summary and internal notes.",
        "The operator confirms the hold or sends the customer an approved alternative.",
      ],
      "Calendar creation is gated by the required booking fields and operator policy.",
      "The team can see a real scheduling hold without pretending the booking is final.",
    ),
    scenario(
      "Calendar event to customer reminder",
      "Keep customers and operators aligned as a confirmed appointment approaches.",
      "A Google Calendar event is created, updated, or reaches its reminder window.",
      [
        "Volimox verifies that the event is linked to the correct lead or booking.",
        "Volimox prepares the confirmation, reminder, or reschedule message.",
        "The approved update is recorded with the event and conversation references.",
      ],
      "Canceled or ambiguous events are held for review instead of notifying the wrong customer.",
      "The calendar becomes a reliable timing signal for the customer handoff.",
    ),
  ],
  "microsoft-outlook-calendar": [
    scenario(
      "Request to Microsoft 365 calendar hold",
      "Create a tentative dispatch window after the intake has enough information.",
      "A Volimox request passes the configured service, location, and time rules.",
      [
        "Volimox checks the selected Outlook calendar for available windows.",
        "Volimox creates a tentative event with the customer and job context.",
        "The operator confirms the hold or selects another window for the customer.",
      ],
      "The event remains tentative until the responsible operator confirms it.",
      "Microsoft 365 scheduling reflects the actual state of the customer request.",
    ),
    scenario(
      "Schedule change to notification",
      "Keep a customer informed when the assigned time moves.",
      "An Outlook event is updated or canceled for a linked Volimox booking.",
      [
        "Volimox compares the new time and status with the last known workflow state.",
        "Volimox prepares a concise change notice with the next available action.",
        "The operator approves the message and the timeline records the change.",
      ],
      "Stale or unrelated calendar changes do not send a customer message.",
      "A schedule change creates one visible customer follow-up instead of confusion.",
    ),
  ],
  calendly: [
    scenario(
      "Qualified lead to booking link",
      "Send the right Calendly link only after the customer has supplied enough context.",
      "A Volimox conversation is qualified for a consultation, estimate, or callback.",
      [
        "Volimox checks the service type and team routing rule.",
        "Volimox sends the matching scheduling link with a short context summary.",
        "The resulting invitee event is linked back to the same lead.",
      ],
      "Volimox does not send a link when required location or service details are missing.",
      "The customer receives one relevant booking path instead of a generic calendar link.",
    ),
    scenario(
      "Scheduled event to customer record",
      "Turn a Calendly booking into an accountable next step for the team.",
      "Calendly reports a new, canceled, or rescheduled invitee event.",
      [
        "Volimox matches the invitee to the lead using the approved contact fields.",
        "Volimox updates the booking state and stores the event details.",
        "The operator receives a confirmation or recovery task based on the event state.",
      ],
      "Duplicate or unmatched invitees stay in review until ownership is resolved.",
      "Scheduling activity stays connected to the conversation and its next action.",
    ),
  ],
  "acuity-scheduling": [
    scenario(
      "Appointment to prepared lead",
      "Bring appointment details and intake answers into the Volimox handoff.",
      "A new Acuity appointment is booked with the required service details.",
      [
        "Volimox reads the appointment, intake answers, and contact details.",
        "Volimox creates or updates the matching lead with the scheduled time.",
        "The operator reviews payment, location, and special-request fields before service.",
      ],
      "Sensitive or incomplete intake fields are flagged for review instead of guessed.",
      "The appointment arrives with the context needed for a prepared service handoff.",
    ),
    scenario(
      "Canceled appointment to recovery",
      "Give the team a clear recovery path when an appointment is canceled or moved.",
      "A linked Acuity appointment is canceled or rescheduled.",
      [
        "Volimox updates the lead and records the original appointment state.",
        "Volimox creates a recovery task with the customer preference and reason when available.",
        "The operator chooses a new slot or closes the follow-up with a reason.",
      ],
      "The operator controls whether the customer receives a new link, a call, or no message.",
      "Canceled appointments become recoverable work instead of silent churn.",
    ),
  ],
  salesforce: [
    scenario(
      "Qualified inquiry to Salesforce lead",
      "Move a complete conversation into Salesforce without creating thin or duplicate leads.",
      "A Volimox conversation contains the required customer and service fields.",
      [
        "Volimox checks for an existing matching contact or lead.",
        "Volimox creates or updates the record with the source and conversation summary.",
        "The owner reviews routing and creates an opportunity when the request is sales-ready.",
      ],
      "Duplicate matching and required-field validation happen before a Salesforce write.",
      "Salesforce receives a lead with context, source, and accountable ownership.",
    ),
    scenario(
      "Opportunity stage to customer update",
      "Coordinate customer communication with a verified Salesforce stage change.",
      "A linked opportunity is updated to a configured stage.",
      [
        "Volimox confirms the stage change and loads the linked conversation.",
        "Volimox prepares the approved customer or internal follow-up action.",
        "The team approves the message and the outcome is written to the activity timeline.",
      ],
      "Only approved stages can start an outbound customer action.",
      "Sales and operations stay aligned without sending messages from unreviewed changes.",
    ),
  ],
  hubspot: [
    scenario(
      "Form or call to HubSpot contact",
      "Create or update a HubSpot contact while preserving the original customer request.",
      "Volimox receives a form submission, call outcome, or inbound conversation.",
      [
        "Volimox normalizes the contact details and source attribution.",
        "Volimox finds or updates the contact and creates a deal when the request is qualified.",
        "Volimox adds a task for the assigned owner when a human follow-up is needed.",
      ],
      "A matching contact is checked before a new record is created.",
      "HubSpot becomes the system of record for a complete, traceable request.",
    ),
    scenario(
      "Lead priority to team task",
      "Make high-priority demand visible to the person responsible for the next step.",
      "A HubSpot contact or deal property reaches the configured priority.",
      [
        "Volimox reads the priority change and linked conversation state.",
        "Volimox creates a focused task with the required customer context.",
        "The owner completes or reassigns the task and the workflow records the handoff.",
      ],
      "Priority rules are explicit and can be paused without deleting the CRM record.",
      "High-intent leads get a visible next action instead of another unread alert.",
    ),
  ],
  highlevel: [
    scenario(
      "Inbound lead to opportunity",
      "Turn a conversation into a HighLevel pipeline opportunity with the right tag and owner.",
      "A new contact, inbound message, or appointment meets the configured lead rule.",
      [
        "Volimox extracts the request and checks for an existing HighLevel contact.",
        "Volimox creates or updates the opportunity and applies the selected tag.",
        "The owner reviews the opportunity and chooses the next message or call.",
      ],
      "Pipeline creation is limited to qualified requests and configured workspaces.",
      "HighLevel shows the customer request, stage, and next action in one place.",
    ),
    scenario(
      "Missed call to nurture path",
      "Start a controlled follow-up path when a prospect cannot be reached live.",
      "A missed call or unanswered conversation enters the configured recovery state.",
      [
        "Volimox records the event and checks the customer communication preference.",
        "Volimox sends the approved message or adds the contact to the correct nurture path.",
        "A human can take over when the customer replies or the workflow reaches an exception.",
      ],
      "Opt-out and communication limits are checked before any follow-up is sent.",
      "A missed call gets a measured next step without uncontrolled automation.",
    ),
  ],
  "zoho-crm": [
    scenario(
      "New request to Zoho lead",
      "Create a Zoho lead with a normalized request and clear source attribution.",
      "Volimox receives a new customer request with enough contact information.",
      [
        "Volimox checks Zoho for a matching lead or contact.",
        "Volimox creates or updates the record with the service request and source.",
        "The assigned owner receives a next-action task for any missing detail.",
      ],
      "Existing records are matched before a new lead is created.",
      "Zoho contains a useful lead record instead of an unstructured message.",
    ),
    scenario(
      "Deal stage to customer message",
      "Keep a customer update tied to the stage that caused it.",
      "A linked Zoho deal or record reaches a configured stage.",
      [
        "Volimox verifies the stage and loads the related conversation.",
        "Volimox prepares the approved status message with verified fields.",
        "The owner approves the send and Volimox records the activity.",
      ],
      "Only approved stages can start a customer-facing action.",
      "The team can explain why a customer received an update.",
    ),
  ],
  pipedrive: [
    scenario(
      "Qualified request to deal",
      "Create a visible Pipedrive deal when a request is ready for sales follow-up.",
      "A Volimox conversation contains the required contact, service, and timing fields.",
      [
        "Volimox finds or creates the Pipedrive person and organization.",
        "Volimox creates a deal in the configured pipeline and stage.",
        "The owner receives a next activity with the original conversation context.",
      ],
      "Deal creation waits for qualification and duplicate checks.",
      "Every qualified request has a pipeline stage and accountable next activity.",
    ),
    scenario(
      "Deal stage to next activity",
      "Keep the next sales or dispatch action moving when a deal advances.",
      "A Pipedrive deal stage changes on a linked Volimox opportunity.",
      [
        "Volimox reads the new stage and the last conversation state.",
        "Volimox creates the next activity or updates the existing one.",
        "The owner completes, reassigns, or closes the activity with a reason.",
      ],
      "Stage changes do not create duplicate activities for the same transition.",
      "Pipeline movement produces a concrete next step instead of a stale record.",
    ),
  ],
  stripe: [
    scenario(
      "Approved quote to payment link",
      "Ask for payment only after the quote and customer details are ready.",
      "A Volimox quote reaches an approved payment state.",
      [
        "Volimox verifies the customer, amount, service, and quote reference.",
        "Volimox creates a Stripe customer or payment link with an idempotent operation key.",
        "The operator reviews the link before it is sent through the chosen channel.",
      ],
      "No payment request is created from an unapproved quote or ambiguous customer.",
      "The customer receives one traceable payment request tied to the job.",
    ),
    scenario(
      "Payment succeeded to booking update",
      "Connect a verified Stripe payment to the operational record and customer follow-up.",
      "Stripe reports a successful payment or paid invoice for a linked customer.",
      [
        "Volimox reconciles the provider event to the matching quote or booking.",
        "Volimox updates the workflow state and records the provider payment reference.",
        "The operator approves the confirmation or lets the next scheduling step begin.",
      ],
      "Provider identity and amount are checked before a booking is marked paid.",
      "Payment status becomes a reliable input to the customer handoff.",
    ),
  ],
  square: [
    scenario(
      "Service request to Square payment link",
      "Create a reviewable Square payment request from an approved service record.",
      "A Volimox quote or job is approved for payment collection.",
      [
        "Volimox checks the customer and total against the approved job.",
        "Volimox creates the customer or payment link in Square.",
        "The operator reviews the request and sends it through the configured channel.",
      ],
      "The amount and customer identity must match the approved job before creation.",
      "Square payment collection stays connected to the service request.",
    ),
    scenario(
      "Payment completed to operations update",
      "Move a verified Square payment into the next booking or dispatch state.",
      "Square reports a completed payment for a linked customer.",
      [
        "Volimox matches the payment to the job using the provider reference.",
        "Volimox records the paid state and preserves the payment identity.",
        "The operator confirms the next service step or sends a receipt update.",
      ],
      "Unmatched or duplicate payment events are held for reconciliation.",
      "Operations can see which jobs are paid without checking another dashboard.",
    ),
  ],
  "quickbooks-online": [
    scenario(
      "Completed job to invoice",
      "Carry an approved completed service into a reviewable QuickBooks invoice.",
      "A Volimox job reaches a completed state with customer and pricing fields.",
      [
        "Volimox validates the customer, service lines, tax policy, and total.",
        "Volimox finds or creates the QuickBooks customer and prepares an invoice.",
        "The finance owner reviews the invoice before sending or recording it.",
      ],
      "Invoice creation is blocked when pricing or customer mapping is incomplete.",
      "Finance receives a traceable invoice draft built from the actual job.",
    ),
    scenario(
      "Payment received to lead state",
      "Reflect a verified payment back on the customer or booking record.",
      "QuickBooks reports a payment received for a linked invoice.",
      [
        "Volimox matches the payment to the invoice and the customer workflow.",
        "Volimox records the payment reference and updates the operational state.",
        "The team receives the next scheduling, dispatch, or customer-confirmation action.",
      ],
      "Payment identity and invoice linkage are checked before the job is marked paid.",
      "The customer handoff and finance record agree on the payment state.",
    ),
  ],
  paypal: [
    scenario(
      "Approved request to PayPal invoice",
      "Create a payment request from a confirmed Volimox service or quote.",
      "A customer request reaches the approved payment stage.",
      [
        "Volimox verifies the customer, amount, currency, and service reference.",
        "Volimox prepares the PayPal invoice or payment action.",
        "The operator reviews and sends the payment request through the approved channel.",
      ],
      "No invoice is sent when the customer or amount cannot be confidently matched.",
      "The payment request is tied to a specific customer and service record.",
    ),
    scenario(
      "Payment or refund to finance review",
      "Make PayPal payment and refund events visible to the team that owns the outcome.",
      "PayPal reports a completed payment, refund, or dispute for a linked customer.",
      [
        "Volimox reconciles the provider event to the related invoice or booking.",
        "Volimox updates the state and stores the provider reference in the timeline.",
        "A finance or operations owner reviews the customer message or recovery action.",
      ],
      "Refunds and disputes pause the normal path until a human chooses the next action.",
      "Payment exceptions become owned work with the right customer context.",
    ),
  ],
  "google-sheets": [
    scenario(
      "New lead to review row",
      "Keep a lightweight operations queue for every structured customer request.",
      "Volimox creates a lead that matches the selected sheet and service type.",
      [
        "Volimox maps the lead fields to a stable sheet column contract.",
        "Volimox appends the source, summary, owner, urgency, and current state.",
        "The operator uses the row as a review queue and updates the workflow through Volimox.",
      ],
      "Column mapping and the target worksheet are reviewed before the first write.",
      "A team gets a simple, searchable lead queue without losing the source conversation.",
    ),
    scenario(
      "Status change to row update",
      "Keep a shared operational sheet aligned with the authoritative workflow state.",
      "A linked Volimox lead changes state or owner.",
      [
        "Volimox finds the matching row using the stable lead reference.",
        "Volimox updates only the approved status, owner, and timestamp columns.",
        "The next team member can see what changed and why in the lead timeline.",
      ],
      "Writes are idempotent so retries do not create duplicate rows.",
      "The sheet remains a useful view without becoming a second uncontrolled system of record.",
    ),
  ],
  airtable: [
    scenario(
      "Lead to Airtable base record",
      "Create an operational record with normalized customer and job fields.",
      "Volimox creates a lead for a service, booking, or dispatch request.",
      [
        "Volimox chooses the configured base and table for the business unit.",
        "Volimox creates a record with source, summary, owner, and required fields.",
        "The operator reviews the record and moves it into the next view or status.",
      ],
      "Base, table, and field mapping are explicit before records are written.",
      "A flexible Airtable workspace shows the request and its operational state.",
    ),
    scenario(
      "Record status to team notification",
      "Notify the right team when an Airtable record needs attention.",
      "A linked record is created, updated, or enters a configured view.",
      [
        "Volimox reads the record state and linked conversation reference.",
        "Volimox creates a concise notification with the required next step.",
        "The operator resolves the record and the timeline records the handoff.",
      ],
      "Notifications are limited to configured states and destinations.",
      "Airtable changes become actionable work instead of passive database activity.",
    ),
  ],
  "google-forms": [
    scenario(
      "Form response to lead",
      "Put web form submissions into the same intake path as calls and messages.",
      "A new Google Forms response arrives for a service or booking form.",
      [
        "Volimox reads the response and normalizes the answer fields.",
        "Volimox creates a lead with the form source and any missing-field flags.",
        "The assigned operator reviews the request and starts the next customer action.",
      ],
      "Answer mapping and required-field rules are configured before the form is connected.",
      "Form, phone, and email intake share one visible lead workflow.",
    ),
    scenario(
      "Urgent answer to team alert",
      "Escalate a form answer that needs immediate human attention.",
      "A response contains an urgency, safety, timing, or service condition that matches the rule.",
      [
        "Volimox marks the lead as requiring human review.",
        "Volimox sends a structured alert to the configured operations destination.",
        "The operator acknowledges the alert and records the resolution path.",
      ],
      "The urgency rule is explicit and automation stops until a person acknowledges it.",
      "Important form answers reach the person who can act on them quickly.",
    ),
  ],
  typeform: [
    scenario(
      "Completed intake to qualified lead",
      "Use a richer Typeform response to create a complete Volimox intake.",
      "A customer submits a Typeform with service, timing, location, and contact answers.",
      [
        "Volimox maps the response into the shared lead schema and keeps the form source.",
        "Volimox evaluates qualification rules and creates the correct owner task.",
        "The operator reviews the response before a quote, call, or booking action.",
      ],
      "Qualification rules determine whether the request can continue automatically.",
      "A detailed form becomes a customer conversation with a clear next action.",
    ),
    scenario(
      "Urgent answer to escalation",
      "Bring a high-risk or time-sensitive Typeform answer to a human immediately.",
      "A submitted response matches the configured escalation condition.",
      [
        "Volimox freezes the normal workflow and records the matching answer.",
        "Volimox creates an escalation task with the source response attached.",
        "The operator resolves, reroutes, or closes the request with a reason.",
      ],
      "No automated customer promise is made while the escalation is unresolved.",
      "The team gets the full answer and a controlled decision point.",
    ),
  ],
  jotform: [
    scenario(
      "Submission to prepared service lead",
      "Bring form submissions and uploaded documents into a reviewable service handoff.",
      "A new Jotform submission contains a customer request or service intake.",
      [
        "Volimox reads the submission and records the source and uploaded-document references.",
        "Volimox creates the lead and flags any missing or unreadable fields.",
        "The operator reviews the submission before contacting the customer or scheduling work.",
      ],
      "Attachments and sensitive fields remain permissioned and are not exposed in public messages.",
      "The team sees the request, documents, and next action together.",
    ),
    scenario(
      "Signed form to operations handoff",
      "Move a completed form into the next operational step without losing approval context.",
      "A Jotform submission is updated or marked complete.",
      [
        "Volimox verifies the submission state and links it to the customer record.",
        "Volimox creates the configured job, task, or review event.",
        "The operator confirms the handoff and records any exceptions.",
      ],
      "Only completed and validated submissions can advance the workflow.",
      "Signed or completed intake turns into accountable operations work.",
    ),
  ],
  mailchimp: [
    scenario(
      "Consented lead to audience",
      "Keep permissioned customer follow-up aligned with lead status.",
      "A Volimox lead is qualified and has the required marketing consent.",
      [
        "Volimox checks consent, source, and the selected audience rule.",
        "Volimox adds or updates the subscriber with the correct tag.",
        "The marketing owner can review the source lead before a campaign uses it.",
      ],
      "No contact is added without an explicit permission signal.",
      "Marketing audiences stay useful without bypassing customer communication preferences.",
    ),
    scenario(
      "Unsubscribe to team visibility",
      "Make a Mailchimp preference change visible to the team handling the customer.",
      "Mailchimp reports an unsubscribe or tag change for a linked contact.",
      [
        "Volimox matches the subscriber to the customer record.",
        "Volimox updates the communication preference and preserves the source event.",
        "The owner receives an internal note when the preference affects an active workflow.",
      ],
      "An unsubscribe never starts a new marketing or promotional message.",
      "Customer preference changes remain visible across operations and marketing.",
    ),
  ],
  "meta-lead-ads": [
    scenario(
      "Meta lead form to service intake",
      "Turn a Meta lead form submission into a structured Volimox request.",
      "Meta Lead Ads reports a new lead form submission.",
      [
        "Volimox reads the form answers and preserves the campaign and ad source.",
        "Volimox creates or updates the lead and applies the configured service route.",
        "The assigned operator reviews the request and starts the approved follow-up.",
      ],
      "Lead matching, consent, and required-field checks run before outreach.",
      "Paid social demand enters the same accountable intake path as every other source.",
    ),
    scenario(
      "Lead status to campaign feedback",
      "Feed a meaningful operational outcome back into the lead process.",
      "A Volimox lead reaches a configured qualified, booked, or closed state.",
      [
        "Volimox verifies the lead identity and the state transition.",
        "Volimox records the lead status and source context for campaign review.",
        "The marketing or operations owner reviews the result before enabling feedback actions.",
      ],
      "Only approved state transitions are eligible for campaign feedback.",
      "The team can connect campaign spend to real service outcomes.",
    ),
  ],
  "google-ads": [
    scenario(
      "Lead form to qualified conversion",
      "Connect a qualified customer request to the campaign that generated it.",
      "A Google Ads lead form submission enters Volimox and passes the qualification rule.",
      [
        "Volimox stores the campaign and source metadata with the lead.",
        "Volimox creates the next sales or dispatch task and records the qualification state.",
        "The marketing owner reviews the conversion event before it is sent back.",
      ],
      "Conversion recording is gated by a verified lead state, not by a raw form submission.",
      "Advertising reports can reflect leads that became real operational opportunities.",
    ),
    scenario(
      "Booking outcome to campaign update",
      "Use a real booking or service outcome to improve campaign visibility.",
      "A sourced Volimox lead reaches the configured booked or completed state.",
      [
        "Volimox resolves the original campaign and lead references.",
        "Volimox prepares the conversion record with the approved value and source.",
        "The owner reviews the event and authorizes the campaign update.",
      ],
      "No campaign event is emitted for unverified or duplicate outcomes.",
      "Marketing optimization is based on a customer outcome instead of a click alone.",
    ),
  ],
  "google-drive": [
    scenario(
      "New lead to customer folder",
      "Create a predictable place for approved documents and conversation exports.",
      "A Volimox lead becomes qualified or reaches a document-required state.",
      [
        "Volimox creates or finds the configured customer or job folder.",
        "Volimox adds approved intake documents or exports with stable names.",
        "The operator confirms sharing and the folder link is stored on the lead.",
      ],
      "Folder sharing is explicit and defaults to the least access needed.",
      "Every active job has an organized document location tied to the customer record.",
    ),
    scenario(
      "Document update to review task",
      "Make a newly added or changed customer file visible to the responsible team.",
      "A linked file is created, updated, or moved into the configured review folder.",
      [
        "Volimox checks the file path and linked customer or job reference.",
        "Volimox creates a review task with the file link and required decision.",
        "The operator accepts, requests a replacement, or closes the task.",
      ],
      "Files are not shared with customers until the operator confirms the access policy.",
      "Document changes produce a controlled review step instead of a silent update.",
    ),
  ],
  dropbox: [
    scenario(
      "Qualified request to Dropbox folder",
      "Create a consistent customer or job folder for approved operational files.",
      "A Volimox request reaches a state that requires shared documents.",
      [
        "Volimox finds or creates the correct Dropbox folder using the stable lead reference.",
        "Volimox uploads the approved intake or generated file.",
        "The operator reviews the shared link and records it on the workflow.",
      ],
      "Sharing permissions are reviewed before a link is exposed outside the team.",
      "Files are organized around the job rather than scattered across personal folders.",
    ),
    scenario(
      "Updated file to operations review",
      "Turn a changed document into an owned review task.",
      "Dropbox reports a file update or a new file in a monitored folder.",
      [
        "Volimox validates the folder and matches the file to the customer or job.",
        "Volimox creates a task with the file link and the expected review outcome.",
        "The operator approves, rejects, or requests a corrected file.",
      ],
      "Unknown files and unrelated folders are ignored or routed to review.",
      "The team knows when an operational document needs attention.",
    ),
  ],
  notion: [
    scenario(
      "Lead to Notion operations page",
      "Create a readable customer or job page for teams that work in Notion.",
      "Volimox creates a qualified lead or an operations handoff.",
      [
        "Volimox selects the configured Notion database and maps the lead fields.",
        "Volimox creates the page with the request summary, owner, and current state.",
        "The operator reviews the page and adds internal notes or decisions.",
      ],
      "Database and property mapping are configured before records are created.",
      "Notion gives the team a readable operating brief linked to the original conversation.",
    ),
    scenario(
      "Database state to handoff task",
      "Make a Notion status change produce the next accountable action.",
      "A linked Notion database item changes state or receives a new comment.",
      [
        "Volimox reads the state change and the linked customer reference.",
        "Volimox creates or updates the next task in the operational workflow.",
        "The operator resolves the task and the resulting state is recorded.",
      ],
      "Only configured states can advance a customer-facing workflow.",
      "A Notion board becomes an actionable handoff surface instead of a passive notes page.",
    ),
  ],
  jobber: [
    scenario(
      "Inbound request to Jobber client",
      "Turn a service inquiry into a Jobber client and request without retyping the intake.",
      "Volimox qualifies a customer request for a service business.",
      [
        "Volimox finds or creates the Jobber client with the verified contact details.",
        "Volimox creates a request or quote with the service, location, and timing context.",
        "The operator reviews the quote path and schedules the next customer contact.",
      ],
      "Customer matching and required service fields are checked before Jobber writes.",
      "A service request becomes a visible Jobber work item with its source context.",
    ),
    scenario(
      "Approved quote to scheduled job",
      "Move an approved Jobber quote into the next service operation.",
      "Jobber reports a quote approval or appointment schedule for a linked customer.",
      [
        "Volimox matches the event to the lead and preserves the provider reference.",
        "Volimox creates or updates the job and stores the scheduled time.",
        "The operator approves the customer confirmation or dispatch handoff.",
      ],
      "Quote state and customer identity must be verified before creating a job.",
      "The approved request moves cleanly from sales intake into service delivery.",
    ),
  ],
  servicetitan: [
    scenario(
      "Lead intake to ServiceTitan customer",
      "Send a qualified service request into the ServiceTitan customer and lead path.",
      "Volimox receives a request that passes the service and location rules.",
      [
        "Volimox checks for an existing ServiceTitan customer and lead.",
        "Volimox creates or updates the lead with the conversation summary and source.",
        "The dispatcher reviews the request and chooses the appointment or callback action.",
      ],
      "Duplicate customer matching and location routing happen before provider writes.",
      "ServiceTitan receives a qualified lead with enough context for dispatch.",
    ),
    scenario(
      "Job status to customer update",
      "Keep customers informed as a ServiceTitan appointment or job changes state.",
      "A linked ServiceTitan appointment or job status changes.",
      [
        "Volimox verifies the status transition and loads the matching conversation.",
        "Volimox prepares the approved customer update or internal dispatch task.",
        "The operator confirms the action and the workflow records the result.",
      ],
      "Unsupported or stale status transitions pause for human review.",
      "Dispatch state and customer communication move together.",
    ),
  ],
  "housecall-pro": [
    scenario(
      "Customer inquiry to Housecall Pro job",
      "Create a Housecall Pro customer and job from a structured Volimox intake.",
      "A service request contains the required contact, location, and job details.",
      [
        "Volimox finds or creates the Housecall Pro customer.",
        "Volimox creates the job with the request summary and source.",
        "The operator reviews the job and selects the next scheduling or contact step.",
      ],
      "Customer matching and service-area rules are checked before job creation.",
      "A captured request becomes a visible service job with clear ownership.",
    ),
    scenario(
      "Job status to customer follow-up",
      "Use a Housecall Pro status change to start the right follow-up.",
      "A linked Housecall Pro job is created, updated, or changes status.",
      [
        "Volimox reads the status and confirms the matching customer record.",
        "Volimox prepares an approved message or internal note for the next step.",
        "The operator sends, edits, or stops the action and records the decision.",
      ],
      "Customer-facing actions require an approved status and verified contact.",
      "Job progress is visible to both the operator and the customer workflow.",
    ),
  ],
  "limo-anywhere": [
    scenario(
      "New reservation to dispatch brief",
      "Bring a Limo Anywhere reservation into Volimox with the context needed for a clean handoff.",
      "Limo Anywhere reports a new reservation or quote request.",
      [
        "Volimox reads the passenger, pickup, timing, vehicle, and trip details.",
        "Volimox creates a dispatch brief and links the reservation reference.",
        "The operator reviews the request and confirms the next customer or dispatch action.",
      ],
      "Reservation status and required trip fields are checked before a customer promise.",
      "A reservation becomes one visible workflow with passenger and dispatch context.",
    ),
    scenario(
      "Dispatch status to passenger update",
      "Send a controlled passenger update when the ride status changes.",
      "Limo Anywhere reports a reservation update or dispatch status change.",
      [
        "Volimox reconciles the event to the existing reservation and lead.",
        "Volimox prepares the approved SMS or email using the verified trip fields.",
        "The operator approves the update and the event is recorded in the timeline.",
      ],
      "Stale events and unmatched passengers pause for review.",
      "Passengers receive timely information without losing dispatch accountability.",
    ),
  ],
  moovs: [
    scenario(
      "Quote request to Moovs reservation",
      "Pass a complete ground-transportation request into a reviewable Moovs reservation flow.",
      "Moovs or Volimox reports a new reservation request with the required trip fields.",
      [
        "Volimox normalizes passenger, pickup, timing, vehicle, and contact details.",
        "Volimox creates or updates the reservation with the original request attached.",
        "The operator reviews availability and confirms the quote or reservation path.",
      ],
      "Vehicle, timing, and passenger details are reviewed before the reservation is treated as ready.",
      "The reservation team receives a complete request rather than a partial message.",
    ),
    scenario(
      "Trip status to passenger update",
      "Keep the passenger informed when a Moovs trip changes state.",
      "A linked Moovs reservation or trip status changes.",
      [
        "Volimox matches the event to the passenger and reservation reference.",
        "Volimox prepares the approved status update and records the new state.",
        "The operator confirms the message or escalates an exception to dispatch.",
      ],
      "Unmatched or conflicting trip events are held for dispatch review.",
      "Passenger communication follows the actual trip state and not an outdated assumption.",
    ),
  ],
}
