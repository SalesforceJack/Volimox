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

const NOTIFICATION_STATUS_RANK: Record<ContactLeadNotificationStatus, number> = {
  pending: 0,
  failed: 1,
  uncertain_after_dispatch: 2,
  reconciliation_required: 3,
  sent: 4,
}

export function mergeContactLeadNotificationStatus(
  existing: ContactLeadNotificationStatus,
  incoming: ContactLeadNotificationStatus,
): ContactLeadNotificationStatus {
  if (existing === "sent" || incoming === "sent") return "sent"
  return NOTIFICATION_STATUS_RANK[incoming] >= NOTIFICATION_STATUS_RANK[existing] ? incoming : existing
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
  const docRef = getContactLeadsCollection(db, tenantId).doc(leadId)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef)
    if (!snapshot.exists) throw new Error("contact_lead_not_found")

    const existing = snapshot.data() as Partial<ContactLeadRecord> & { notificationProviderId?: string }
    const existingStatus = existing.notificationStatus || "pending"
    const mergedStatus = mergeContactLeadNotificationStatus(existingStatus, status)
    const update: Record<string, unknown> = {
      notificationStatus: mergedStatus,
      updatedAtServer: FieldValue.serverTimestamp(),
    }

    const durableProviderId = providerId || existing.notificationProviderId
    if (durableProviderId) update.notificationProviderId = durableProviderId
    transaction.update(docRef, update)
  })
}
