import type { PublicFollowUpDemoSession } from "@/lib/follow-up-demo"

const FAILED_STATES = new Set(["failed", "failed_before_dispatch", "provider_rejected"])

/**
 * publicSession() primarily summarizes the initial call/email/lead setup.
 * Once missed-call recovery begins, a definitive recovery SMS failure must
 * prevent the API from continuing to describe the workflow as fully started.
 */
export function withRecoveryWorkflowStatus(session: PublicFollowUpDemoSession): PublicFollowUpDemoSession {
  if (!session.recoverySmsState || !FAILED_STATES.has(session.recoverySmsState)) return session
  if (session.workflowStatus !== "started") return session
  return { ...session, workflowStatus: "partially_started" }
}
