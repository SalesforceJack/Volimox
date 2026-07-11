"use client"

import { FormEvent, useState } from "react"
import { Check, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react"

type SubmitState = "idle" | "sending" | "success" | "error"

function getBuildProfile(volume: number) {
  if (volume < 1000) return { label: "Focused pilot", detail: "One intake channel · one decision flow · one fulfillment system" }
  if (volume < 10000) return { label: "Operational system", detail: "Multi-channel intake · business rules · payment or scheduling · CRM" }
  return { label: "Scaled orchestration", detail: "Multiple workflows · observability · permissions · exception operations" }
}

export function ContactStudio() {
  const [volume, setVolume] = useState(5000)
  const [state, setState] = useState<SubmitState>("idle")
  const [message, setMessage] = useState("")
  const profile = getBuildProfile(volume)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setState("sending")
    setMessage("")

    const form = new FormData(formElement)
    const payload = Object.fromEntries(form.entries())

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
      if (!response.ok || !result.success) throw new Error(result.error || "Your request could not be sent.")
      setState("success")
      setMessage(result.message || "Your operation map is in the queue.")
      formElement.reset()
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "Your request could not be sent.")
    }
  }

  return (
    <div className="grid overflow-hidden border border-white/15 bg-ink text-white lg:grid-cols-[0.42fr_0.58fr]">
      <div className="relative border-b border-white/15 p-6 sm:p-10 lg:border-b-0 lg:border-r">
        <div className="absolute inset-0 operations-grid opacity-20" aria-hidden="true" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">Build profile</p>
          <h3 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Start with the operation, not the model.</h3>
          <p className="mt-5 text-sm leading-7 text-white/50">
            Give us the workflow volume and the bottleneck. We will map the decision points, systems, and safe handoffs.
          </p>

          <div className="mt-10">
            <label htmlFor="estimatedVolume" className="text-xs font-semibold text-white/70">Monthly customer requests</label>
            <input
              id="estimatedVolume"
              type="range"
              min="250"
              max="50000"
              step="250"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="signal-range mt-5 w-full"
            />
            <div className="mt-3 flex items-end justify-between">
              <span className="text-4xl font-semibold tracking-[-0.05em]">{volume.toLocaleString()}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">requests / month</span>
            </div>
          </div>

          <div className="mt-10 border-t border-white/15 pt-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">Likely starting shape</p>
            <p className="mt-3 text-lg font-semibold text-signal">{profile.label}</p>
            <p className="mt-2 text-xs leading-6 text-white/45">{profile.detail}</p>
          </div>
        </div>
      </div>

      <form id="operation-form" onSubmit={submit} className="grid gap-5 bg-[#171815] p-6 sm:grid-cols-2 sm:p-10">
        <Field label="Your name" name="fullName" autoComplete="name" required />
        <Field label="Work email" name="email" type="email" autoComplete="email" required />
        <Field label="Company" name="companyName" autoComplete="organization" required />
        <label className="field-label">
          Industry
          <select name="industry" required className="field-control">
            <option value="">Select one</option>
            <option>Transportation and logistics</option>
            <option>Manufacturing</option>
            <option>Real estate</option>
            <option>Healthcare administration</option>
            <option>Other</option>
          </select>
        </label>
        <label className="field-label sm:col-span-2">
          What operation should run better?
          <textarea
            name="projectScope"
            rows={5}
            required
            placeholder="Today a customer calls, then our team manually..."
            className="field-control resize-none"
          />
        </label>
        <input type="hidden" name="estimatedVolume" value={String(volume)} />

        <div className="sm:col-span-2">
          <button type="submit" disabled={state === "sending"} data-cta="submit-operation-brief" className="button-signal w-full justify-center disabled:cursor-wait disabled:opacity-60">
            {state === "sending" ? "Sending operation brief" : "Map my operation"}
            <PaperPlaneTilt size={16} weight="bold" />
          </button>

          {message && (
            <div
              className={`mt-4 flex items-start gap-3 border p-4 text-sm ${
                state === "success" ? "border-signal/50 bg-signal/10 text-white" : "border-red-400/40 bg-red-400/10 text-red-100"
              }`}
              role={state === "error" ? "alert" : "status"}
            >
              {state === "success" ? <Check size={18} className="mt-0.5 shrink-0 text-signal" /> : <WarningCircle size={18} className="mt-0.5 shrink-0" />}
              {message}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, name, type = "text", autoComplete, required = false }: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="field-label">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} className="field-control" />
    </label>
  )
}
