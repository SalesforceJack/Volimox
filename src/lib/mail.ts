/**
 * Volimox — Nodemailer transport for lead notification emails
 *
 * Uses Gmail SMTP via App Password.
 * Configure SMTP_USER (your Gmail address) and SMTP_PASS (App Password)
 * in .env.local.
 */

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
// Transport
// ---------------------------------------------------------------------------

function createTransport() {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    console.warn(
      "[mail] SMTP_USER or SMTP_PASS not set. Emails will be logged to console only.",
    )
    return null
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  })
}

// ---------------------------------------------------------------------------
// Send lead notification
// ---------------------------------------------------------------------------

export async function sendLeadNotification(data: LeadFormData): Promise<void> {
  const transport = createTransport()
  const smtpUser = process.env.SMTP_USER

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

  // Log to console as fallback
  console.log("---[Volimox Lead]---")
  console.log(JSON.stringify(data, null, 2))
  console.log("--------------------")

  if (!transport) {
    console.log("[mail] No SMTP configured. Lead logged to console.")
    return
  }

  const to = process.env.NOTIFICATION_EMAIL || smtpUser

  await transport.sendMail({
    from: `"Volimox Leads" <${smtpUser}>`,
    to,
    replyTo: data.email,
    subject,
    html,
  })

  console.log("[mail] Lead notification sent to", to)
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
