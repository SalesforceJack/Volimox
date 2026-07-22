import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { deriveContactLeadEffectId } from "@/lib/contact-idempotency"
import { getContactLeadsCollection, getDemoTenantId } from "@/lib/firebase-admin"
import type { LeadFormData } from "@/lib/mail"

export type ContactLeadNotificationStatus =
  | "pending"
  | "sent"
  | "failed"
  | "uncertain_after_dispatch"
  | "reconciliation_required"

export type ContactLeadRecord = LeadFormData & {
  leadId: string
  tenantId: string
  source: "contact_form"
  schemaVersion: 1
  submissionStatus: "captured"
  notificationStatus: ContactLeadNotificationStatus
}

export async function persistContactLead(db: Firestore, lead: LeadFormData, tenantId = getDemoTenantId()) {
  const leadId = deriveContactLeadEffectId(lead)
  const docRef = getContactLeadsCollection(db, tenantId).doc(leadId)
  const now = new Date()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef)
    if (snapshot.exists) return
    const record: ContactLeadRecord = {
      ...lead,
      leadId,
      tenantId,
      source: "contact_form",
      schemaVersion: 1,
      submissionStatus: "captured",
      notificationStatus: "pending",
    }
    transaction.set(docRef, {
      ...record,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
      expiresAtServer: Timestamp.fromDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)),
    })
  })
  return { leadId, docRef }
}

export async function updateContactLeadNotification(
  db: Firestore,
  leadId: string,
  status: ContactLeadNotificationStatus,
  providerId?: string,
  tenantId = getDemoTenantId(),
) {
  const update: Record<string, unknown> = {
    notificationStatus: status,
    updatedAtServer: FieldValue.serverTimestamp(),
  }
  if (providerId) update.notificationProviderId = providerId
  await getContactLeadsCollection(db, tenantId).doc(leadId).update(update)
}
