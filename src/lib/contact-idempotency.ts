import { deriveSideEffectId } from "./side-effect-machine"
import type { LeadFormData } from "./mail"

export function deriveContactLeadEffectId(lead: LeadFormData): string {
  const payload = JSON.stringify({
    fullName: lead.fullName,
    email: lead.email,
    companyName: lead.companyName,
    industry: lead.industry,
    projectScope: lead.projectScope,
    estimatedVolume: lead.estimatedVolume,
  })
  return deriveSideEffectId("contact-lead", payload)
}
