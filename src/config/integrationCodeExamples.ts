import type { IntegrationSlug } from "./integrationCatalog"

export type IntegrationCodeExample = {
  sdkApp: string
  action: string
  actionLabel: string
  connectionHint: string
  input: Record<string, string | number | boolean>
  requiredEnv: string[]
  notes: string[]
}

const example = (
  sdkApp: string,
  action: string,
  actionLabel: string,
  connectionHint: string,
  input: Record<string, string | number | boolean>,
  requiredEnv: string[],
  notes: string[],
): IntegrationCodeExample => ({ sdkApp, action, actionLabel, connectionHint, input, requiredEnv, notes })

export const integrationCodeExamples: Record<IntegrationSlug, IntegrationCodeExample> = {
  gmail: example("gmail", "send_email", "Send a customer follow-up", "Connect the approved Google Workspace mailbox.", { to: "customer@example.com", subject: "Your Volimox request", body: "We received your request and assigned it to the service team.", threadId: "{{lead.gmailThreadId}}" }, ["ZAPIER_API_KEY"], ["Create drafts first when human approval is required.", "Store the provider message ID on the Volimox conversation for idempotency."]),
  "microsoft-outlook": example("microsoft-outlook", "send_email", "Send a Microsoft 365 update", "Authorize the shared or user mailbox used by operations.", { to: "customer@example.com", subject: "Booking status update", body: "Your requested time is being reviewed.", conversationId: "{{lead.outlookConversationId}}" }, ["ZAPIER_API_KEY"], ["Use delegated mailbox scopes only.", "Do not send when the workflow is still in an ambiguous state."]),
  slack: example("slack", "send_channel_message", "Post a qualified lead card", "Authorize only the private channels Volimox may use.", { channel: "C0123456789", text: "New qualified lead: {{lead.summary}}", blocks: "{{lead.slackBlocksJson}}" }, ["ZAPIER_API_KEY"], ["Keep customer-sensitive fields out of broad channels.", "Write the Slack timestamp back to Volimox so updates can target the original message."]),
  "microsoft-teams": example("microsoft-teams", "send_channel_message", "Post an operations handoff", "Authorize the target Microsoft 365 tenant, team, and channel.", { teamId: "{{env.TEAMS_TEAM_ID}}", channelId: "{{env.TEAMS_CHANNEL_ID}}", message: "{{lead.summary}}" }, ["ZAPIER_API_KEY", "TEAMS_TEAM_ID", "TEAMS_CHANNEL_ID"], ["Use a dedicated operations channel.", "Record the returned activity ID for audit and follow-up."]),
  twilio: example("twilio", "send_sms", "Send a missed-call text-back", "Connect the Twilio project and approved messaging sender.", { from: "{{env.TWILIO_FROM_NUMBER}}", to: "{{lead.phone}}", body: "Sorry we missed you. What service do you need? Reply STOP to opt out." }, ["ZAPIER_API_KEY", "TWILIO_FROM_NUMBER"], ["Enforce consent, quiet hours, and opt-out handling.", "Use the call SID or message SID as the deduplication key."]),
  ringcentral: example("ringcentral", "send_sms", "Send a reviewed callback message", "Authorize the extension and phone numbers used by the operations team.", { from: "{{env.RINGCENTRAL_FROM_NUMBER}}", to: "{{lead.phone}}", text: "We received your voicemail and will call you shortly." }, ["ZAPIER_API_KEY", "RINGCENTRAL_FROM_NUMBER"], ["Confirm the caller-to-lead match before sending.", "Store the provider message identifier on the conversation timeline."]),
  "google-calendar": example("google-calendar", "create_detailed_event", "Create a tentative booking hold", "Connect the exact calendar used for customer appointments.", { calendar: "{{env.GOOGLE_CALENDAR_ID}}", summary: "Tentative: {{lead.service}}", start: "{{lead.requestedStartIso}}", end: "{{lead.requestedEndIso}}", description: "Volimox lead {{lead.id}}", attendees: "{{lead.email}}" }, ["ZAPIER_API_KEY", "GOOGLE_CALENDAR_ID"], ["Create tentative holds until a human confirms.", "Persist the event ID so reschedules update rather than duplicate."]),
  "microsoft-outlook-calendar": example("microsoft-outlook", "create_event", "Create an Outlook calendar hold", "Authorize the selected Microsoft 365 calendar.", { calendarId: "{{env.OUTLOOK_CALENDAR_ID}}", subject: "Tentative: {{lead.service}}", start: "{{lead.requestedStartIso}}", end: "{{lead.requestedEndIso}}", attendees: "{{lead.email}}" }, ["ZAPIER_API_KEY", "OUTLOOK_CALENDAR_ID"], ["Normalize all times to the business timezone before calling the action.", "Update by event ID when the request changes."]),
  calendly: example("calendly", "create_single_use_scheduling_link", "Create a controlled booking link", "Connect the Calendly owner or team that owns the event type.", { eventType: "{{env.CALENDLY_EVENT_TYPE_URI}}", maxEventCount: 1, owner: "{{lead.ownerEmail}}" }, ["ZAPIER_API_KEY", "CALENDLY_EVENT_TYPE_URI"], ["Use single-use links for qualified leads.", "Attach the invitee URI to the Volimox lead after booking."]),
  "acuity-scheduling": example("acuity-scheduling", "create_appointment", "Create an appointment", "Connect the Acuity account and target appointment calendar.", { calendarId: "{{env.ACUITY_CALENDAR_ID}}", appointmentTypeId: "{{env.ACUITY_APPOINTMENT_TYPE_ID}}", datetime: "{{lead.requestedStartIso}}", firstName: "{{lead.firstName}}", lastName: "{{lead.lastName}}", email: "{{lead.email}}", phone: "{{lead.phone}}" }, ["ZAPIER_API_KEY", "ACUITY_CALENDAR_ID", "ACUITY_APPOINTMENT_TYPE_ID"], ["Validate availability immediately before creation.", "Do not collect payment data directly in Volimox logs."]),
  salesforce: example("salesforce", "create_record", "Create a qualified Salesforce lead", "Authorize the integration user and approved objects.", { object: "Lead", LastName: "{{lead.lastName}}", Company: "{{lead.company || 'Individual'}}", Email: "{{lead.email}}", Phone: "{{lead.phone}}", LeadSource: "Volimox", Description: "{{lead.summary}}" }, ["ZAPIER_API_KEY"], ["Use an External ID such as Volimox_Lead_ID__c for upsert behavior.", "Run duplicate rules and field-level security under the integration user."]),
  hubspot: example("hubspot", "create_contact", "Create or update a HubSpot contact", "Connect the HubSpot portal and approved CRM scopes.", { email: "{{lead.email}}", firstname: "{{lead.firstName}}", lastname: "{{lead.lastName}}", phone: "{{lead.phone}}", volimox_lead_id: "{{lead.id}}", lifecyclestage: "lead" }, ["ZAPIER_API_KEY"], ["Find by email before create to avoid duplicate contacts.", "Store the HubSpot object ID on the Volimox record."]),
  highlevel: example("leadconnector", "create_contact", "Create a HighLevel contact", "Authorize the correct agency location and pipeline.", { locationId: "{{env.HIGHLEVEL_LOCATION_ID}}", firstName: "{{lead.firstName}}", lastName: "{{lead.lastName}}", email: "{{lead.email}}", phone: "{{lead.phone}}", source: "Volimox", tags: "volimox,qualified" }, ["ZAPIER_API_KEY", "HIGHLEVEL_LOCATION_ID"], ["Search by phone and email before creating.", "Keep location IDs isolated per customer account."]),
  "zoho-crm": example("zoho-crm", "create_module_entry", "Create a Zoho CRM lead", "Connect the correct Zoho region and CRM organization.", { module: "Leads", Last_Name: "{{lead.lastName}}", Company: "{{lead.company || 'Individual'}}", Email: "{{lead.email}}", Phone: "{{lead.phone}}", Lead_Source: "Volimox", Description: "{{lead.summary}}" }, ["ZAPIER_API_KEY"], ["Respect the account data-center region.", "Use a custom Volimox ID field for reconciliation."]),
  pipedrive: example("pipedrive", "create_deal", "Create a Pipedrive deal", "Authorize the company account and select the target pipeline.", { title: "{{lead.name}} — {{lead.service}}", personId: "{{lead.pipedrivePersonId}}", pipelineId: "{{env.PIPEDRIVE_PIPELINE_ID}}", stageId: "{{env.PIPEDRIVE_STAGE_ID}}", value: "{{lead.estimatedValue}}", currency: "USD" }, ["ZAPIER_API_KEY", "PIPEDRIVE_PIPELINE_ID", "PIPEDRIVE_STAGE_ID"], ["Create or find the person before creating the deal.", "Persist both person and deal IDs for later updates."]),
  stripe: example("stripe", "create_checkout_session", "Create a deposit checkout session", "Connect the Stripe account in test mode first, then production.", { mode: "payment", priceId: "{{env.STRIPE_DEPOSIT_PRICE_ID}}", quantity: 1, customerEmail: "{{lead.email}}", successUrl: "https://volimox.com/payment/success?lead={{lead.id}}", cancelUrl: "https://volimox.com/payment/cancel", metadata: "volimox_lead_id={{lead.id}}" }, ["ZAPIER_API_KEY", "STRIPE_DEPOSIT_PRICE_ID"], ["Never trust the browser redirect as payment confirmation; verify the provider event.", "Use the Volimox lead ID as metadata and an idempotency key."]),
  square: example("square", "create_payment_link", "Create a Square payment link", "Authorize the Square seller and exact business location.", { locationId: "{{env.SQUARE_LOCATION_ID}}", amount: "{{lead.depositMinorUnits}}", currency: "USD", description: "Deposit for {{lead.service}}", customerEmail: "{{lead.email}}" }, ["ZAPIER_API_KEY", "SQUARE_LOCATION_ID"], ["Keep amounts in minor units.", "Reconcile the returned order and payment IDs before updating the booking."]),
  "quickbooks-online": example("quickbooks", "create_invoice", "Create a reviewable invoice", "Connect the QuickBooks company and map products, tax, and income accounts.", { customer: "{{lead.quickBooksCustomerId}}", invoiceNumber: "VMX-{{lead.id}}", lineItems: "{{lead.invoiceLinesJson}}", dueDate: "{{lead.invoiceDueDate}}", memo: "Created from Volimox workflow" }, ["ZAPIER_API_KEY"], ["Find or create the customer before the invoice action.", "Use a deterministic document number and stop duplicate invoice creation."]),
  paypal: example("paypal", "create_invoice", "Create a PayPal invoice", "Authorize the PayPal Business account used for customer billing.", { recipientEmail: "{{lead.email}}", currency: "USD", itemName: "{{lead.service}}", quantity: 1, unitAmount: "{{lead.depositAmount}}", note: "Volimox lead {{lead.id}}" }, ["ZAPIER_API_KEY"], ["Verify payment events independently of customer-facing redirects.", "Record invoice and transaction IDs on the lead."]),
  "google-sheets": example("google-sheets", "create_spreadsheet_row", "Append a lead review row", "Connect the shared Drive account and selected worksheet.", { spreadsheet: "{{env.GOOGLE_SHEET_ID}}", worksheet: "Leads", Volimox_ID: "{{lead.id}}", Name: "{{lead.name}}", Phone: "{{lead.phone}}", Service: "{{lead.service}}", Status: "Needs review" }, ["ZAPIER_API_KEY", "GOOGLE_SHEET_ID"], ["Use a stable Volimox ID column for updates.", "Avoid using Sheets as the system of record for secrets or regulated data."]),
  airtable: example("airtable", "create_record", "Create an Airtable operations record", "Authorize the workspace, base, and table only.", { base: "{{env.AIRTABLE_BASE_ID}}", table: "Leads", fields: "{{lead.airtableFieldsJson}}" }, ["ZAPIER_API_KEY", "AIRTABLE_BASE_ID"], ["Map fields by stable field IDs where possible.", "Store the Airtable record ID for later status updates."]),
  "google-forms": example("google-forms", "find_response", "Read a submitted intake response", "Connect the form owner and linked response destination.", { formId: "{{env.GOOGLE_FORM_ID}}", responseId: "{{event.responseId}}" }, ["ZAPIER_API_KEY", "GOOGLE_FORM_ID"], ["Treat Google Forms primarily as a trigger source.", "Normalize answer keys before creating the Volimox lead."]),
  typeform: example("typeform", "find_response", "Load a completed Typeform response", "Authorize only the selected forms and workspace.", { formId: "{{env.TYPEFORM_FORM_ID}}", responseToken: "{{event.responseToken}}" }, ["ZAPIER_API_KEY", "TYPEFORM_FORM_ID"], ["Verify webhook signatures when receiving instant events.", "Map answer field refs rather than relying on display labels."]),
  jotform: example("jotform", "find_submission", "Load a Jotform submission", "Connect the Jotform account and selected intake forms.", { submissionId: "{{event.submissionId}}", includeAnswers: true }, ["ZAPIER_API_KEY"], ["Validate uploaded file URLs before storing them.", "Keep the submission ID as the source-system key."]),
  mailchimp: example("mailchimp", "add_update_subscriber", "Add or update a consented subscriber", "Authorize the Mailchimp account and one audience.", { audienceId: "{{env.MAILCHIMP_AUDIENCE_ID}}", email: "{{lead.email}}", statusIfNew: "subscribed", tags: "Volimox,Qualified", mergeFields: "FNAME={{lead.firstName}},LNAME={{lead.lastName}}" }, ["ZAPIER_API_KEY", "MAILCHIMP_AUDIENCE_ID"], ["Only subscribe contacts with recorded marketing consent.", "Propagate unsubscribe events back to the CRM."]),
  "meta-lead-ads": example("facebook-lead-ads", "find_lead", "Retrieve a Meta lead form submission", "Authorize the Business account, Page, and exact lead form.", { pageId: "{{env.META_PAGE_ID}}", formId: "{{env.META_FORM_ID}}", leadId: "{{event.leadgenId}}" }, ["ZAPIER_API_KEY", "META_PAGE_ID", "META_FORM_ID"], ["Preserve campaign, ad set, ad, and form identifiers.", "Respond quickly but run duplicate checks before CRM creation."]),
  "google-ads": example("google-ads", "send_offline_conversion", "Send an approved offline conversion", "Authorize the manager/customer account and conversion action.", { customerId: "{{env.GOOGLE_ADS_CUSTOMER_ID}}", conversionAction: "{{env.GOOGLE_ADS_CONVERSION_ACTION}}", gclid: "{{lead.gclid}}", conversionDateTime: "{{lead.qualifiedAtIso}}", conversionValue: "{{lead.value}}", currencyCode: "USD", orderId: "{{lead.id}}" }, ["ZAPIER_API_KEY", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CONVERSION_ACTION"], ["Upload only after the configured qualification or revenue event.", "Use the Volimox ID as order ID to prevent duplicate conversions."]),
  "google-drive": example("google-drive", "create_folder", "Create a controlled lead folder", "Authorize the shared Drive and selected parent folder.", { parentFolderId: "{{env.GOOGLE_DRIVE_PARENT_ID}}", folderName: "{{lead.id}} - {{lead.name}}" }, ["ZAPIER_API_KEY", "GOOGLE_DRIVE_PARENT_ID"], ["Use least-privilege sharing and inherit from a controlled parent.", "Store the folder ID rather than searching by name later."]),
  dropbox: example("dropbox", "create_folder", "Create a customer job folder", "Authorize the business account and selected root path.", { path: "/Volimox/{{lead.id}}-{{lead.safeName}}", autorename: false }, ["ZAPIER_API_KEY"], ["Sanitize path segments before calling the action.", "Use the returned path ID for future uploads and links."]),
  notion: example("notion", "create_database_item", "Create an operations database item", "Share only the required database with the integration.", { databaseId: "{{env.NOTION_DATABASE_ID}}", Name: "{{lead.name}}", Status: "Needs review", Service: "{{lead.service}}", Volimox_ID: "{{lead.id}}", Summary: "{{lead.summary}}" }, ["ZAPIER_API_KEY", "NOTION_DATABASE_ID"], ["Use database property IDs where available.", "Do not grant workspace-wide access when one database is sufficient."]),
  jobber: example("jobber", "clientCreate", "Create a Jobber client", "Authorize the Jobber account and required client/job scopes.", { firstName: "{{lead.firstName}}", lastName: "{{lead.lastName}}", email: "{{lead.email}}", phone: "{{lead.phone}}", address: "{{lead.serviceAddress}}", source: "Volimox" }, ["ZAPIER_API_KEY"], ["Find existing clients by email or phone before creation.", "Store the Jobber client ID before creating requests, quotes, or jobs."]),
  servicetitan: example("servicetitan", "create_lead", "Create a ServiceTitan lead", "Use approved partner credentials, tenant, and business unit mappings.", { tenantId: "{{env.SERVICETITAN_TENANT_ID}}", businessUnitId: "{{env.SERVICETITAN_BUSINESS_UNIT_ID}}", customerName: "{{lead.name}}", phone: "{{lead.phone}}", summary: "{{lead.summary}}", campaignId: "{{env.SERVICETITAN_CAMPAIGN_ID}}" }, ["ZAPIER_API_KEY", "SERVICETITAN_TENANT_ID", "SERVICETITAN_BUSINESS_UNIT_ID", "SERVICETITAN_CAMPAIGN_ID"], ["Partner and tenant access must be verified before activation.", "Use provider external IDs and retry only safe, idempotent operations."]),
  "housecall-pro": example("housecall-pro", "create_customer", "Create a Housecall Pro customer", "Authorize the provider account and confirm API availability for the customer plan.", { firstName: "{{lead.firstName}}", lastName: "{{lead.lastName}}", email: "{{lead.email}}", mobileNumber: "{{lead.phone}}", address: "{{lead.serviceAddress}}", tags: "Volimox" }, ["ZAPIER_API_KEY"], ["Search existing customers before create.", "Create the job only after service type, time, and address are confirmed."]),
  "limo-anywhere": example("webhooks-by-zapier", "custom_request", "Create a reservation through the customer API", "Configure the operator API license and a server-side Volimox credential vault.", { method: "POST", url: "{{env.LIMO_ANYWHERE_API_BASE}}/reservations", headers: "Authorization=Bearer {{secret.LIMO_ANYWHERE_API_KEY}}", body: "{{lead.limoAnywhereReservationJson}}" }, ["ZAPIER_API_KEY", "LIMO_ANYWHERE_API_BASE"], ["Never expose operator API credentials in browser code.", "Use the Volimox lead ID as the external reservation reference."]),
  moovs: example("webhooks-by-zapier", "custom_request", "Create a Moovs reservation request", "Confirm provider API access and keep credentials in the server-side connection vault.", { method: "POST", url: "{{env.MOOVS_API_BASE}}/reservations", headers: "Authorization=Bearer {{secret.MOOVS_API_TOKEN}}", body: "{{lead.moovsReservationJson}}" }, ["ZAPIER_API_KEY", "MOOVS_API_BASE"], ["Treat the endpoint and fields as account-specific until provider approval is complete.", "Persist the returned reservation ID and reject duplicate lead references."]),
}

export function buildZapierSdkSnippet(appName: string, config: IntegrationCodeExample) {
  const input = JSON.stringify(config.input, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")

  return `import { createZapierSdk } from "@zapier/zapier-sdk"

const zapier = createZapierSdk({
  apiKey: process.env.ZAPIER_API_KEY,
})

export async function run${appName.replace(/[^a-zA-Z0-9]/g, "")}Action() {
  const { data: connection } = await zapier.findFirstConnection({
    app: "${config.sdkApp}",
    owner: "me",
  })

  if (!connection) {
    throw new Error("No approved ${appName} connection was found")
  }

  const result = await zapier.runAction({
    app: "${config.sdkApp}",
    action: "${config.action}",
    connection: connection.id,
    input:
${input},
  })

  return result.data
}`
}
