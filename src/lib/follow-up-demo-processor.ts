import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import { event, message, publicBaseUrl, saveFollowUpSession, type FollowUpDemoSession } from "@/lib/follow-up-demo"
import { cancelScheduledSms, sendFollowUpSms, validateTwilioConfig } from "@/lib/twilio-demo"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getDemoTenantId, getSideEffectsCollection, getInboundSmsClaimsCollection } from "@/lib/firebase-admin"

const OPT_OUT_KEYWORDS = /^(stop|stopall|unsubscribe|cancel|end|quit)\b/i

export async function triggerMissedCallRecovery(session: FollowUpDemoSession, request: Request) {
  if (session.messages.some((item) => item.direction === "outbound") || session.events.some((item) => item.type === "sms.recovery_started")) return session
  session.events.push(event("sms.recovery_started", "Text-back triggered", "Waiting for the first SMS to leave Twilio", "sms", "running"))
  await saveFollowUpSession(session)
  const firstName = session.fullName.split(" ")[0]
  const smsBody = `Hi ${firstName}, this is Example ${session.businessType}. Sorry we missed your call. What can we help you with today? Reply STOP to opt out.`

  const db = demoDb()
  const tenantId = getDemoTenantId()
  const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null

  const statusCallback = `${publicBaseUrl(request)}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(session.id)}&channel=sms`

  const store = createSideEffectStore(db, sideEffectsRef)

  try {
    const recoveryOutcome = await executeSideEffect(
      store,
      deriveSideEffectId(session.id, 'recovery-sms'),
      'recovery-sms',
      async () => {
        const res = await sendFollowUpSms({ to: session.phone, body: smsBody, statusCallback })
        return { value: res, providerId: res.sid }
      },
      {
        sessionId: session.id,
        preflight: () => {
          const config = validateTwilioConfig()
          if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
        },
      },
    )

    if (recoveryOutcome.kind === "executed" && recoveryOutcome.value) {
      const sms = recoveryOutcome.value
      session.twilioNumber = sms.from
      session.messages.push(message("outbound", smsBody, sms.status, sms.sid))
      session.events.push(event("sms.sent", "Missed-call text sent", "Text-back triggered after Twilio reported the call was missed", "sms", "completed"))

      try {
        const scheduledOutcome = await executeSideEffect(
          store,
          deriveSideEffectId(session.id, 'scheduled-follow-up-sms'),
          'scheduled-follow-up-sms',
          async () => {
            const res = await sendFollowUpSms({ to: session.phone, body: `Just checking in from Example ${session.businessType}. Do you still need help? Reply here and we will capture the details for the team.`, statusCallback, scheduleAt: new Date(Date.now() + 20 * 60 * 1000) })
            return { value: res, providerId: res.sid }
          },
          {
            sessionId: session.id,
            preflight: () => {
              const config = validateTwilioConfig()
              if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
            },
          },
        )
        if (scheduledOutcome.kind === "executed" && scheduledOutcome.value) {
          session.scheduledMessageSid = scheduledOutcome.value.sid
          session.events.push(event("follow_up.scheduled", "Follow-up scheduled", "Automatically cancels when the customer replies", "sms", "waiting"))
        }
      } catch (scheduleError) {
        session.events.push(event("follow_up.unavailable", "Follow-up scheduling unavailable", scheduleError instanceof Error ? scheduleError.message : "Scheduling failed", "sms", "failed"))
      }
    }
  } catch (smsError) {
    session.events.push(event("sms.failed", "SMS could not be sent", "Twilio request could not be completed", "sms", "failed"))
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

  session.messages.push(message("inbound", body, "received", sid))
  session.status = "engaged"
  session.events.push(event("customer.replied", "Customer replied", body, "sms", "completed"))

  if (OPT_OUT_KEYWORDS.test(body)) {
    session.status = "completed"
    session.events.push(event("consent.revoked", "Messaging stopped", "Customer opted out", "system", "completed"))

    if (session.scheduledMessageSid) {
      try {
        await cancelScheduledSms(session.scheduledMessageSid)
        session.events.push(event("follow_up.canceled", "Follow-up canceled", "Canceled because the customer opted out", "sms", "completed"))
        session.scheduledMessageSid = undefined
      } catch (error) {
        session.events.push(event("follow_up.cancel_uncertain", "Follow-up cancel uncertain", "Scheduled message cancel could not be confirmed", "sms", "failed"))
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
      session.events = session.events.map((item) => item.type === "follow_up.scheduled" ? { ...item, status: "completed", detail: "Canceled because the customer replied" } : item)
      session.scheduledMessageSid = undefined
    } catch (error) {
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
    session.events.push(event("agent.replied", "Automated reply sent", inboundCount === 1 ? "Address and urgency requested" : inboundCount === 2 ? "Service timing requested" : "Lead intake completed", "sms", "completed"))

    if (inboundCount >= 3) {
      session.status = "completed"
      session.events.push(event("lead.created", "Job lead ready", `${session.businessType} request routed with conversation context`, "lead", "completed"))

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
    session.events.push(event("agent.reply_failed", "Automated reply failed", "The reply SMS could not be delivered", "sms", "failed"))
  }
  await saveFollowUpSession(session)
  if (replyProviderId && claimDocId && claimOwnerId) {
    await inboundStore!.markCompleted(claimDocId, claimOwnerId, "completed", replyProviderId).catch((error) => {
      console.error("[follow-up-demo/inbound-complete]", error)
    })
  }
  return session
}
