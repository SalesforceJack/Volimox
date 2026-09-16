export type LiveTranscriptRole = "user" | "agent"

export type LiveTranscriptDeduplicationState = {
  finalizedEventKeys: Set<string>
  recentFinals: Map<LiveTranscriptRole, { normalizedText: string; at: number }>
}

export function createLiveTranscriptDeduplicationState(): LiveTranscriptDeduplicationState {
  return {
    finalizedEventKeys: new Set<string>(),
    recentFinals: new Map<LiveTranscriptRole, { normalizedText: string; at: number }>(),
  }
}

export function resetLiveTranscriptDeduplicationState(state: LiveTranscriptDeduplicationState) {
  state.finalizedEventKeys.clear()
  state.recentFinals.clear()
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function transcriptEventItemId(event: Record<string, unknown>) {
  return stringValue(event.item_id)
    || stringValue(event.itemId)
    || stringValue(event.conversation_item_id)
    || stringValue(event.conversationItemId)
}

export function normalizeTranscriptText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

export function shouldAcceptFinalTranscript(input: {
  state: LiveTranscriptDeduplicationState
  role: LiveTranscriptRole
  itemId?: string
  text: string
  now?: number
  duplicateWindowMs?: number
}) {
  const normalizedText = normalizeTranscriptText(input.text)
  const now = input.now ?? Date.now()
  const duplicateWindowMs = input.duplicateWindowMs ?? 5000
  const itemId = input.itemId?.trim() || ""

  if (itemId) {
    const eventKey = `${input.role}:${itemId}`
    if (input.state.finalizedEventKeys.has(eventKey)) return false
    input.state.finalizedEventKeys.add(eventKey)
  }

  if (normalizedText) {
    const previous = input.state.recentFinals.get(input.role)
    if (!itemId && previous && previous.normalizedText === normalizedText && now - previous.at <= duplicateWindowMs) return false
    input.state.recentFinals.set(input.role, { normalizedText, at: now })
  }

  return true
}
