"use client"

import { FormEvent, useState } from "react"
import { ArrowRight, Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react"

type Props = {
  token: string
  routeSummary: string
}

export function DemoContinuationForm({ token, routeSummary }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState("sending")
    setMessage("")
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())

    try {
      const response = await fetch("/api/demo/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...values, token }),
      })
      const result = await response.json() as { success?: boolean; error?: string; message?: string }
      if (!response.ok || !result.success) throw new Error(result.error || "Your workflow brief could not be sent.")
      setState("success")
      setMessage(result.message || "Your workflow brief is with Volimox.")
    } catch (error) {
      setState("error")
      setMessage(error instanceof Error ? error.message : "Your workflow brief could not be sent.")
    }
  }

  if (state === "success") {
    return (
      <div className="border border-signal bg-signal/10 p-6 text-white sm:p-8" role="status">
        <Check size={26} weight="bold" className="text-signal" />
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">We have your operation in view.</h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">{message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Your name" name="fullName" autoComplete="name" required />
      <Field label="Work email" name="email" type="email" autoComplete="email" required />
      <Field label="Company" name="companyName" autoComplete="organization" required />
      <label className="field-label">
        Industry
        <select name="industry" required defaultValue="" className="field-control">
          <option value="" disabled>Select your industry</option>
          <option>Transportation and logistics</option>
          <option>Dental and healthcare administration</option>
          <option>Legal services</option>
          <option>Auto repair</option>
          <option>Spa, wellness, and massage</option>
          <option>Other</option>
        </select>
      </label>
      <label className="field-label sm:col-span-2">
        Where should the operation finish without your team stepping in?
        <textarea name="challenge" rows={5} required placeholder="A customer calls, our team manually checks availability, sends a quote, then follows up..." className="field-control resize-none" />
      </label>
      <label className="field-label sm:col-span-2">
        Approximate monthly customer requests
        <input name="estimatedVolume" required inputMode="numeric" pattern="[0-9]+" placeholder="5000" className="field-control" />
      </label>

      <div className="sm:col-span-2">
        <p className="mb-4 border-l-2 border-signal pl-3 text-xs leading-6 text-white/45">This live run used {routeSummary}. Your own system can use the tools, rules, and outcomes your business actually needs.</p>
        <button type="submit" disabled={state === "sending"} className="button-signal w-full justify-center disabled:cursor-wait disabled:opacity-60">
          {state === "sending" ? <SpinnerGap size={16} className="animate-spin" /> : <ArrowRight size={16} weight="bold" />}
          {state === "sending" ? "Sending your workflow brief" : "Show Volimox my operation"}
        </button>
        {message && (
          <p className="mt-4 flex items-start gap-2 border border-red-300/40 bg-red-300/10 p-3 text-sm text-red-100" role="alert"><WarningCircle size={18} className="mt-0.5 shrink-0" />{message}</p>
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
