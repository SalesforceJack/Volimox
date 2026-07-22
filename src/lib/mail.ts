import nodemailer from "nodemailer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadFormData {
  fullName: string
  email: string
  companyName: string
  industry: string
  projectScope: string
  estimatedVolume: string
}

// ---------------------------------------------------------------------------
// Config Validation
// ---------------------------------------------------------------------------

export function validateSmtpConfig(): { configured: boolean } {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS
  return { configured: Boolean(user && pass) }
}

function isDefinitiveSmtpRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const responseCode = Number((error as { responseCode?: unknown }).responseCode)
  return Number.isInteger(responseCode) && responseCode >= 400 && responseCode < 600
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function createTransport() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS

  if (!user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  })
}

// ---------------------------------------------------------------------------
// Send lead notification
// ---------------------------------------------------------------------------

export async function sendLeadNotification(
  data: LeadFormData
): Promise<{ sent: true; providerId: string } | { sent: false; reasonCode: "not_configured" | "rejected" }> {
  const transport = createTransport()
  const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER

  if (!transport || !smtpUser) {
    return { sent: false, reasonCode: "not_configured" }
  }

  const subject = `[Volimox] New operation brief: ${data.companyName} (${data.industry})`

  const safe = {
    fullName: esc(data.fullName),
    email: esc(data.email),
    companyName: esc(data.companyName),
    industry: esc(data.industry),
    projectScope: esc(data.projectScope),
    estimatedVolume: esc(data.estimatedVolume),
  }

  const html = [
    "<!DOCTYPE html><html><head><meta charset='utf-8'><style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f3f3ef;color:#161713;padding:32px}",
    ".container{max-width:560px;margin:0 auto;background:#fff;border:1px solid #cbc9c0;padding:32px}",
    "h1{font-size:20px;font-weight:700;color:#161713;margin:0 0 24px}",
    "table{width:100%;border-collapse:collapse}",
    "td{padding:10px 0;border-bottom:1px solid #e5e3dc}",
    "td:first-child{color:#77776f;font-size:13px;width:140px;vertical-align:top}",
    "td:last-child{color:#161713;font-size:14px}",
    ".footer{margin-top:24px;font-size:12px;color:#77776f;text-align:center}",
    "</style></head><body><div class='container'>",
    "<h1>New Volimox operation brief</h1><table>",
    "<tr><td>Full Name</td><td>", safe.fullName, "</td></tr>",
    "<tr><td>Work Email</td><td>", safe.email, "</td></tr>",
    "<tr><td>Company</td><td>", safe.companyName, "</td></tr>",
    "<tr><td>Industry</td><td>", safe.industry, "</td></tr>",
    "<tr><td>Project Scope</td><td>", safe.projectScope, "</td></tr>",
    "<tr><td>Est. Monthly Volume</td><td>", safe.estimatedVolume, "</td></tr>",
    "</table><div class='footer'>Volimox | Conversation to completion</div>",
    "</div></body></html>",
  ].join("")

  const to = process.env.NOTIFICATION_EMAIL || smtpUser

  try {
    const info = await transport.sendMail({
      from: `"Volimox Leads" <${smtpUser}>`,
      to,
      replyTo: data.email,
      subject,
      html,
    })
    if (!info.messageId) throw new Error("SMTP response missing message ID")
    return { sent: true, providerId: info.messageId }
  } catch (err) {
    if (isDefinitiveSmtpRejection(err)) return { sent: false, reasonCode: "rejected" }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function sendDemoExperienceEmail(input: {
  fullName: string
  email: string
  businessType: string
}): Promise<{ sent: true; providerId: string } | { sent: false; reasonCode: string }> {
  const transport = createTransport()
  const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER
  if (!transport || !smtpUser) return { sent: false, reasonCode: "not_configured" }

  const firstName = esc(input.fullName.split(" ")[0] || input.fullName)
  const businessType = esc(input.businessType)

  try {
    const info = await transport.sendMail({
      from: `"Volimox Demo" <${smtpUser}>`,
      to: input.email,
      subject: "Your Volimox live workflow is running",
      text: `Hi ${input.fullName}, your ${input.businessType} missed-call workflow is live. Reply to the SMS on your phone to watch Volimox capture and route the lead in real time.`,
      html: [
        "<!DOCTYPE html><html><body style='margin:0;background:#f3f3ef;color:#161713;font-family:Arial,sans-serif;padding:32px'>",
        "<div style='max-width:560px;margin:0 auto;background:#fff;border:1px solid #cbc9c0;padding:32px'>",
        "<div style='font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#77776f'>Volimox live demo</div>",
        `<h1 style='font-size:30px;line-height:1.05;margin:22px 0'>Your missed call workflow is live, ${firstName}.</h1>`,
        `<p style='font-size:16px;line-height:1.7;color:#55564f'>We started an Example ${businessType} workflow on your phone. Reply to the SMS and the site will show each completed action in real time.</p>`,
        "<div style='margin-top:28px;border-left:4px solid #f4ce38;padding:14px 18px;background:#f7f5ed'>One missed call. One automatic response. One recovered opportunity.</div>",
        "<p style='margin-top:28px;font-size:12px;color:#77776f'>This is a requested Volimox demonstration. Reply STOP to the SMS at any time.</p>",
        "</div></body></html>",
      ].join(""),
    })
    if (!info.messageId) throw new Error("SMTP response missing message ID")
    return { sent: true, providerId: info.messageId }
  } catch (err) {
    if (isDefinitiveSmtpRejection(err)) return { sent: false, reasonCode: "rejected" }
    throw err
  }
}
