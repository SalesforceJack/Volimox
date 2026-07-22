type DemoEventDetail = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export function trackDemoEvent(name: string, detail: DemoEventDetail = {}) {
  if (typeof window === "undefined") return
  const safeDetail = Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined))
  window.dispatchEvent(new CustomEvent("volimox:demo-event", { detail: { name, ...safeDetail } }))
  window.dataLayer?.push({ event: name, ...safeDetail })
}
