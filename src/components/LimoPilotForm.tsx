"use client"

import { FormEvent, useState } from "react"
import { Check, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react"
import { trackDemoEvent } from "@/lib/client-analytics"

type SubmitState = "idle" | "sending" | "success" | "error"

export function LimoPilotForm() {
  const [state, setState] = useState<SubmitState>("idle")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setState("sending")
    setMessage("")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement).entries())),
      })
      const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
      if (!response.ok || !result.success) throw new Error(result.error || "Your pilot request could not be sent.")
      setState("success")
      setMessage(result.message || "Your pilot request is in the queue.")
      trackDemoEvent("limo_pilot_submitted")
      formElement.reset()
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "Your pilot request could not be sent.")
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 border border-white/15 bg-ink p-6 text-white sm:grid-cols-2 sm:p-10">
      <Field label="Your name" name="fullName" autoComplete="name" required />
      <Field label="Work email" name="email" type="email" autoComplete="email" required />
      <Field label="Company name" name="companyName" autoComplete="organization" required />
      <Field label="Business phone" name="businessPhone" type="tel" autoComplete="tel" required />

      <SelectField label="Current phone provider" name="currentPhoneProvider" options={["Twilio", "RingCentral", "Dialpad", "Vonage", "Other", "Not sure yet"]} />
      <SelectField label="Booking system" name="bookingSystem" options={["None / mostly phone and text", "A custom system", "A limo booking platform", "Other", "Not sure yet"]} />
      <SelectField label="When are calls usually missed?" name="afterHours" options={["During active rides", "After hours", "Both during rides and after hours", "We are not sure yet"]} required />
      <SelectField label="Approx. monthly inbound calls" name="estimatedVolume" options={["25", "50", "100", "250", "500", "1000"]} required />

      <label className="field-label sm:col-span-2">
        What should happen when a call is missed?
        <textarea
          name="projectScope"
          rows={5}
          required
          placeholder="Today the call goes to voicemail. We want the customer qualified, transferred when possible, and followed up when the team is busy."
          className="field-control resize-none"
        />
      </label>
      <input type="hidden" name="industry" value="Limo and chauffeur transportation" />

      <div className="sm:col-span-2">
        <button type="submit" disabled={state === "sending"} className="button-signal w-full justify-center disabled:cursor-wait disabled:opacity-60" data-cta="submit-limo-pilot">
          {state === "sending" ? "Sending pilot request" : "Request a pilot conversation"}
          <PaperPlaneTilt size={16} weight="bold" />
        </button>
        <p className="mt-4 text-xs leading-5 text-white/35">We use these details to understand your call flow and prepare a practical pilot scope.</p>

        {message && (
          <div className={`mt-4 flex items-start gap-3 border p-4 text-sm ${state === "success" ? "border-signal/50 bg-signal/10 text-white" : "border-red-400/40 bg-red-400/10 text-red-100"}`} role={state === "error" ? "alert" : "status"}>
            {state === "success" ? <Check size={18} className="mt-0.5 shrink-0 text-signal" /> : <WarningCircle size={18} className="mt-0.5 shrink-0" />}
            {message}
          </div>
        )}
      </div>
    </form>
  )
}

function Field({ label, name, type = "text", autoComplete, required = false }: { label: string; name: string; type?: string; autoComplete?: string; required?: boolean }) {
  return (
    <label className="field-label">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required={required} className="field-control" />
    </label>
  )
}

function SelectField({ label, name, options, required = false }: { label: string; name: string; options: string[]; required?: boolean }) {
  return (
    <label className="field-label">
      {label}
      <select name={name} required={required} defaultValue="" className="field-control">
        <option value="">Select one</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}
