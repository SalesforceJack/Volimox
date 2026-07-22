import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import { deterministicEvent, message, projectSideEffectRecord, recoverySmsBody, scheduledFollowUpSmsBody, upsertEvent, publicBaseUrl, saveFollowUpSession, type FollowUpDemoSession } from "@/lib/follow-up-demo"
import { cancelScheduledSms, sendFollowUpSms, validateTwilioConfig, validateTwilioSchedulingConfig } from "@/lib/twilio-demo"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getDemoTenantId, getSideEffectsCollection, getInboundSmsClaimsCollection } from "@/lib/firebase-admin"

const OPT_OUT_KEYWORDS = /^(stop|stopall|unsubscribe|cancel|end|quit)\b/i

export async function triggerMissedCallRecovery(session: FollowUpDemoSession, request: Request) {
  const recoveryEventId = `recovery-started-${session.id}`
  upsertEvent(session, deterministicEvent(recoveryEventId, "sms.recovery_started", "Text-back triggered", "The missed-call text is being prepared.", "sms", "running"))
  await saveFollowUpSession(session)
  const smsBody = recoverySmsBody(session)

  const db = demoDb()
  const tenantId = getDemoTenantId()
  const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null

  const statusCallback = `${publicBaseUrl(request)}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(session.id)}&channel=sms`

  try {
    const store = createSideEffectStore(db, sideEffectsRef)
    const recoveryOutcome = await executeSideEffect(
      store,
      deriveSideEffectId(session.id, 'recovery-sms'),
      'recovery-sms',
      async () => {
        const res = await sendFollowUpSms({ to: session.phone, body: smsBody, statusCallback })
        return { value: res, providerId: res.sid, providerMetadata: { from: res.from, status: res.status } }
      },
      {
        sessionId: session.id,
        preflight: () => {
          const config = validateTwilioConfig()
          if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
        },
      },
    )

    let recoveryCompleted = false
    if (recoveryOutcome.kind === "executed") {
      projectSideEffectRecord(session, "recovery-sms", {
        id: deriveSideEffectId(session.id, "recovery-sms"),
        operationType: "recovery-sms",
        state: "sent",
        providerId: recoveryOutcome.providerId,
        providerMetadata: recoveryOutcome.providerMetadata,
      })
      recoveryCompleted = true
    } else if (recoveryOutcome.kind === "already_completed") {
      projectSideEffectRecord(session, "recovery-sms", recoveryOutcome.record)
      recoveryCompleted = ["sent", "started", "completed"].includes(recoveryOutcome.record.state)
    } else if (recoveryOutcome.kind === "already_dispatching") {
      projectSideEffectRecord(session, "recovery-sms", recoveryOutcome.record)
    } else if (recoveryOutcome.kind === "uncertain") {
      projectSideEffectRecord(session, "recovery-sms", { id: recoveryEventId, operationType: "recovery-sms", state: "uncertain_after_dispatch" })
    } else if (recoveryOutcome.kind === "reconciliation_required") {
      projectSideEffectRecord(session, "recovery-sms", { id: recoveryEventId, operationType: "recovery-sms", state: "uncertain_after_dispatch", providerId: recoveryOutcome.providerId, providerMetadata: recoveryOutcome.providerMetadata })
    } else if (recoveryOutcome.kind === "preflight_failed" || recoveryOutcome.kind === "provider_rejected" || recoveryOutcome.kind === "persistence_unavailable") {
      projectSideEffectRecord(session, "recovery-sms", { id: recoveryEventId, operationType: "recovery-sms", state: "provider_rejected" })
    }

    if (recoveryCompleted) {
      upsertEvent(session, deterministicEvent(recoveryEventId, "sms.recovery_started", "Text-back triggered", "The missed-call text was accepted by Twilio.", "sms", "completed"))
      upsertEvent(session, deterministicEvent(`recovery-sms-sent-${session.id}`, "sms.sent", "Missed-call text sent", "Text-back triggered after Twilio reported the call was missed.", "sms", "completed"))

      const scheduledOutcome = await executeSideEffect(
        store,
        deriveSideEffectId(session.id, "scheduled-follow-up-sms"),
        "scheduled-follow-up-sms",
        async () => {
          const res = await sendFollowUpSms({ to: session.phone, body: scheduledFollowUpSmsBody(session), statusCallback, scheduleAt: new Date(Date.now() + 20 * 60 * 1000) })
          return { value: res, providerId: res.sid, providerMetadata: { from: res.from, status: res.status } }
        },
        {
          sessionId: session.id,
          preflight: () => {
            const config = validateTwilioSchedulingConfig()
            if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
          },
        },
      )
      if (scheduledOutcome.kind === "executed") {
        projectSideEffectRecord(session, "scheduled-follow-up-sms", {
          id: deriveSideEffectId(session.id, "scheduled-follow-up-sms"),
          operationType: "scheduled-follow-up-sms",
          state: "sent",
          providerId: scheduledOutcome.providerId,
          providerMetadata: scheduledOutcome.providerMetadata,
        })
        upsertEvent(session, deterministicEvent(`follow-up-scheduled-${session.id}`, "follow_up.scheduled", "Follow-up scheduled", "Automatically cancels when the customer replies.", "sms", "waiting"))
      } else if (scheduledOutcome.kind === "already_completed") {
        projectSideEffectRecord(session, "scheduled-follow-up-sms", scheduledOutcome.record)
        upsertEvent(session, deterministicEvent(`follow-up-scheduled-${session.id}`, "follow_up.scheduled", "Follow-up scheduled", "Automatically cancels when the customer replies.", "sms", "waiting"))
      } else if (scheduledOutcome.kind === "already_dispatching") {
        projectSideEffectRecord(session, "scheduled-follow-up-sms", scheduledOutcome.record)
        upsertEvent(session, deterministicEvent(`follow-up-scheduled-${session.id}`, "follow_up.scheduled", "Follow-up scheduling in progress", "Twilio is still confirming the scheduled message.", "sms", "running"))
      } else if (scheduledOutcome.kind === "uncertain" || scheduledOutcome.kind === "reconciliation_required") {
        if (scheduledOutcome.kind === "reconciliation_required") projectSideEffectRecord(session, "scheduled-follow-up-sms", { id: recoveryEventId, operationType: "scheduled-follow-up-sms", state: "uncertain_after_dispatch", providerId: scheduledOutcome.providerId, providerMetadata: scheduledOutcome.providerMetadata })
        upsertEvent(session, deterministicEvent(`follow-up-scheduling-uncertain-${session.id}`, "follow_up.cancel_uncertain", "Follow-up status is being verified", "The scheduled message was not retried because Twilio confirmation is incomplete.", "sms", "failed"))
      } else {
        upsertEvent(session, deterministicEvent(`follow-up-unavailable-${session.id}`, "follow_up.unavailable", "Follow-up scheduling unavailable", "The recovery text was captured, but the optional follow-up could not be scheduled.", "sms", "failed"))
      }
    } else if (recoveryOutcome.kind === "already_dispatching") {
      upsertEvent(session, deterministicEvent(recoveryEventId, "sms.recovery_started", "Text-back in progress", "Twilio is still confirming the missed-call text.", "sms", "running"))
    } else if (recoveryOutcome.kind === "uncertain" || recoveryOutcome.kind === "reconciliation_required") {
      upsertEvent(session, deterministicEvent(recoveryEventId, "sms.recovery_uncertain", "Text-back status is being verified", "The text-back was not retried because provider confirmation is incomplete.", "sms", "failed"))
    } else {
      upsertEvent(session, deterministicEvent(recoveryEventId, "sms.failed", "SMS could not be sent", "The text-back could not be started with the current configuration.", "sms", "failed"))
    }
  } catch {
    session.recoverySmsState = "uncertain_after_dispatch"
    upsertEvent(session, deterministicEvent(`recovery-uncertain-${session.id}`, "sms.recovery_uncertain", "Text-back status is being verified", "The text-back state could not be confirmed.", "sms", "failed"))
  }
  await saveFollowUpSession(session)
  return session
}

export async function processInboundDemoSms(session: FollowUpDemoSession, rawBody: string, sid: string | undefined, request: Request) {
  const body = rawBody.replace(/[\r\n]+/g, " ").trim().slice(0, 1000)
  if (!body) return session

  const db = demoDb()
  const tenantId = getDemoTenantId()
  const inboundClaimsRef = db ? getInboundSmsClaimsCollection(db, tenantId) : null
  const inboundStore = sid ? createSideEffectStore(db, inboundClaimsRef) : null
  let claimDocId: string | undefined
  let claimOwnerId: string | undefined
  if (sid) {
    claimDocId = deriveSideEffectId(session.id, sid)
    const claim = await inboundStore!.claim(claimDocId, "inbound_sms", { sessionId: session.id, ttlHours: 24 })
    if (!claim.claimed) return session
    claimOwnerId = claim.ownerId
    if (!claimOwnerId) return session
    try {
      await inboundStore!.markDispatching(claimDocId, claimOwnerId)
    } catch {
      return session
    }
  }

  const inboundMessage = message("inbound", body, "received", sid)
  if (sid) inboundMessage.id = `inbound-${sid}`
  session.messages.push(inboundMessage)
  session.status = "engaged"
  upsertEvent(session, deterministicEvent(sid ? `customer-replied-${sid}` : `customer-replied-${session.id}-${session.messages.length}`, "customer.replied", "Customer replied", body, "sms", "completed"))

  if (OPT_OUT_KEYWORDS.test(body)) {
    session.status = "completed"
    upsertEvent(session, deterministicEvent(sid ? `consent-revoked-${sid}` : `consent-revoked-${session.id}`, "consent.revoked", "Messaging stopped", "Customer opted out", "system", "completed"))

    if (session.scheduledMessageSid) {
      try {
        await cancelScheduledSms(session.scheduledMessageSid)
        session.scheduledMessageStatus = "canceled"
        upsertEvent(session, deterministicEvent(`follow-up-canceled-${session.id}`, "follow_up.canceled", "Follow-up canceled", "Canceled because the customer opted out.", "sms", "completed"))
        session.scheduledMessageSid = undefined
      } catch (error) {
        session.scheduledMessageStatus = "cancellation_uncertain"
        upsertEvent(session, deterministicEvent(`follow-up-cancel-uncertain-${session.id}`, "follow_up.cancel_uncertain", "Follow-up cancel uncertain", "The scheduled message was not confirmed canceled.", "sms", "failed"))
        console.error("[follow-up-demo/cancel-scheduled]", error)
      }
    }
    await saveFollowUpSession(session)
    if (claimDocId && claimOwnerId) {
      await inboundStore!.markCompleted(claimDocId, claimOwnerId, "completed").catch((error) => {
        console.error("[follow-up-demo/inbound-complete]", error)
      })
    }
    return session
  }

  if (session.scheduledMessageSid) {
    try {
      await cancelScheduledSms(session.scheduledMessageSid)
        session.scheduledMessageStatus = "canceled"
        session.events = session.events.map((item) => item.type === "follow_up.scheduled" ? { ...item, status: "completed", detail: "Canceled because the customer replied." } : item)
        session.scheduledMessageSid = undefined
      } catch (error) {
        session.scheduledMessageStatus = "cancellation_uncertain"
        upsertEvent(session, deterministicEvent(`follow-up-cancel-uncertain-${session.id}`, "follow_up.cancel_uncertain", "Follow-up cancel uncertain", "The scheduled message was not confirmed canceled.", "sms", "failed"))
        console.error("[follow-up-demo/cancel-scheduled]", error)
    }
  }

  const inboundCount = session.messages.filter((item) => item.direction === "inbound").length
  const firstName = session.fullName.split(" ")[0]
  const reply = inboundCount === 1
    ? `Thanks, ${firstName}. What is the service address, and is this urgent?`
    : inboundCount === 2
      ? "Got it. What is the best time for the technician to call or arrive?"
      : "Thank you. We captured the job details and notified the team. They can now follow up with the full context."
  const statusCallback = `${publicBaseUrl(request)}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(session.id)}&channel=sms`

  let replyProviderId: string | undefined
  try {
    const sms = await sendFollowUpSms({ to: session.phone, body: reply, statusCallback })
    replyProviderId = sms.sid

    if (!session.twilioNumber && sms.from) session.twilioNumber = sms.from
    session.messages.push(message("outbound", reply, sms.status, sms.sid))
    upsertEvent(session, deterministicEvent(replyProviderId ? `agent-replied-${replyProviderId}` : `agent-replied-${session.id}-${inboundCount}`, "agent.replied", "Automated reply sent", inboundCount === 1 ? "Address and urgency requested" : inboundCount === 2 ? "Service timing requested" : "Lead intake completed", "sms", "completed"))

    if (inboundCount >= 3) {
      session.status = "completed"
        upsertEvent(session, deterministicEvent(`lead-created-${session.id}`, "lead.created", "Job lead ready", `${session.businessType} request routed with conversation context`, "lead", "completed"))

      const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null
      const store = createSideEffectStore(db, sideEffectsRef)
      await executeSideEffect(
        store,
        deriveSideEffectId(session.id, 'completed-lead-email'),
        'completed-lead-email',
        async () => {
          const res = await sendLeadNotification({
            fullName: session.fullName,
            email: session.email,
            companyName: session.companyName,
            industry: session.businessType,
            projectScope: session.messages.filter((item) => item.direction === "inbound").map((item) => item.body).join(" | "),
            estimatedVolume: "Live demo lead",
          })
          if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
          return { value: { success: true }, providerId: res.providerId }
        },
          {
            sessionId: session.id,
            preflight: () => {
              if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
            },
          },
        ).catch((error) => console.error("[follow-up-demo/completed-lead]", error))
    }
  } catch (error) {
    if (claimDocId && claimOwnerId) {
      await inboundStore!.markUncertain(claimDocId, claimOwnerId, "unknown_error").catch((markError) => {
        console.error("[follow-up-demo/inbound-uncertain]", markError)
      })
    }
    upsertEvent(session, deterministicEvent(sid ? `agent-reply-failed-${sid}` : `agent-reply-failed-${session.id}-${inboundCount}`, "agent.reply_failed", "Automated reply failed", "The reply SMS could not be delivered.", "sms", "failed"))
  }
  await saveFollowUpSession(session)
  if (replyProviderId && claimDocId && claimOwnerId) {
    await inboundStore!.markCompleted(claimDocId, claimOwnerId, "completed", replyProviderId).catch((error) => {
      console.error("[follow-up-demo/inbound-complete]", error)
    })
  }
  return session
}
