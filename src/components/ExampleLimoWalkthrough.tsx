"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Check, CheckCircle, Clock, MapPin, SteeringWheel } from "@phosphor-icons/react"
import type { ExampleLimoQuoteResponse, ExampleLimoVehicleName, ExampleLimoVehicleQuote } from "@/lib/example-limo/types"

type Reservation = {
  id: string
  status: string
  providerMode: string
  vehicleName: ExampleLimoVehicleName
  quotedTotalUsd: number
}

type Selection = {
  approvalIntentToken: string
  selectedVehicle: ExampleLimoVehicleName
  quotedTotalUsd: number
}

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
const stages = ["Trip details", "Vehicle & price", "Your approval", "Booking result"]
const controlClass = "min-h-12 w-full rounded-lg border border-line-strong bg-white px-3 py-3 text-base text-ink outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:bg-canvas-muted"

function futurePickup(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

async function callWalkthrough<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/example-limo/simulation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "The walkthrough could not complete that step. Please try again.")
  return payload as T
}

export function ExampleLimoWalkthrough() {
  const [pickup, setPickup] = useState("JFK Terminal 4, Queens, NY")
  const [destination, setDestination] = useState("Times Square, New York, NY")
  const [departure, setDeparture] = useState("")
  const [timeZone, setTimeZone] = useState("")
  const [passengers, setPassengers] = useState(2)
  const [bags, setBags] = useState(2)
  const [sessionToken, setSessionToken] = useState("")
  const [quote, setQuote] = useState<ExampleLimoQuoteResponse | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [approved, setApproved] = useState(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const complete = reservation?.status === "paid"
  const reviewRequired = reservation?.status === "pending_review"
  const step = reservation ? 3 : selection ? 2 : quote ? 1 : 0
  const selectedQuote = selection ? quote?.quotes_by_vehicle[selection.selectedVehicle] : undefined

  useEffect(() => {
    setDeparture(futurePickup(24))
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  useEffect(() => {
    if (reservation) resultHeading.current?.focus()
  }, [reservation])

  function editTrip() {
    setQuote(null)
    setSelection(null)
    setApproved(false)
    setReservation(null)
    setError("")
  }

  async function requestQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("quote")
    setError("")
    setSelection(null)
    setApproved(false)
    try {
      let token = sessionToken
      if (!token) {
        const started = await callWalkthrough<{ sessionToken: string }>({ action: "start" })
        token = started.sessionToken
        setSessionToken(token)
      }
      const result = await callWalkthrough<{ quote: ExampleLimoQuoteResponse }>({
        action: "quote", sessionToken: token,
        trip: {
          pickup_address: pickup,
          destination_address: destination,
          departure_time_iso: new Date(departure).toISOString(),
          passenger_count: passengers,
          luggage_count: bags,
          phone: "+12125550123",
          service_type: "point_to_point",
          trip_type: "one_way",
        },
      })
      setQuote(result.quote)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not calculate this trip.")
    } finally { setBusy(null) }
  }

  async function selectVehicle(vehicleName: ExampleLimoVehicleName) {
    if (!quote) return
    setBusy(vehicleName)
    setError("")
    setApproved(false)
    try {
      const result = await callWalkthrough<Selection>({ action: "select_vehicle", sessionToken, quoteId: quote.quoteId, vehicleName })
      setSelection(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not select this vehicle.")
    } finally { setBusy(null) }
  }

  async function createCheckout() {
    if (!quote || !selection || !approved) return
    setBusy("checkout")
    setError("")
    try {
      const result = await callWalkthrough<{ reservation: Reservation }>({
        action: "create_checkout", sessionToken, quoteId: quote.quoteId,
        vehicleName: selection.selectedVehicle,
        approvalIntentToken: selection.approvalIntentToken,
        approved: true,
      })
      setReservation(result.reservation)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not prepare this checkout.")
    } finally { setBusy(null) }
  }

  async function completePayment() {
    if (!reservation) return
    setBusy("complete")
    setError("")
    try {
      const result = await callWalkthrough<{ reservation: Reservation }>({ action: "complete", sessionToken, reservationId: reservation.id })
      setReservation(result.reservation)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not complete the simulation.")
    } finally { setBusy(null) }
  }

  function restart() {
    editTrip()
    setSessionToken("")
    setDeparture(futurePickup(24))
  }

  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 sm:px-8 lg:px-12">
      <div className="grid gap-7 border-b border-line-strong pb-10 lg:grid-cols-[1fr_350px] lg:items-end">
        <div>
          <p className="section-kicker">Example Limo / Local walkthrough</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[.96] tracking-[-.06em]">Follow a request<br />through to booking.</h1>
        </div>
        <p className="max-w-lg text-sm leading-7 text-ink-muted">Try the trip rules, compare vehicles and approve a price. This local simulation uses example route estimates and makes no calls, sends no messages and takes no payment.</p>
      </div>

      <ol aria-label="Walkthrough progress" className="grid grid-cols-2 gap-3 border-b border-line py-5 md:grid-cols-4">
        {stages.map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined} className={`flex min-h-10 items-center gap-3 text-xs sm:text-sm ${index <= step ? "text-ink" : "text-ink-faint"}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center font-mono text-[10px] ${index <= step ? "bg-ink text-white" : "border border-line-strong"}`}>
              {index < step ? <Check size={13} weight="bold" /> : `0${index + 1}`}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="mt-9 grid items-start gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-.035em]">Build a sample trip.</h2>
            {quote && !reservation && <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={editTrip} disabled={Boolean(busy)}>Edit trip</button>}
          </div>
          <form className="mt-6 space-y-5" onSubmit={requestQuote}>
            <fieldset className="space-y-5 disabled:opacity-70" disabled={Boolean(busy || quote || reservation)}>
              <Field label="Pickup address"><input className={controlClass} required value={pickup} onChange={(e) => setPickup(e.target.value)} autoComplete="off" /></Field>
              <Field label="Destination address"><input className={controlClass} required value={destination} onChange={(e) => setDestination(e.target.value)} autoComplete="off" /></Field>
              <Field label="Pickup date and time"><input className={controlClass} type="datetime-local" required value={departure} onChange={(e) => setDeparture(e.target.value)} /></Field>
              <p className="!mt-2 text-xs leading-5 text-ink-muted">Your time zone{timeZone ? `: ${timeZone}` : ""}. At least two hours of notice is required.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Passengers"><input className={controlClass} type="number" min={1} max={12} required value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} /></Field>
                <Field label="Bags"><input className={controlClass} type="number" min={0} max={14} required value={bags} onChange={(e) => setBags(Number(e.target.value))} /></Field>
              </div>
              <button type="button" className="min-h-11 text-left text-xs text-ink-muted underline underline-offset-4" onClick={() => setDeparture(futurePickup(4))}>Try a pickup that needs human review</button>
            </fieldset>
            {!quote && <button className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-50" type="submit" disabled={Boolean(busy) || !departure}>{busy === "quote" ? "Checking the trip…" : "Compare vehicle prices"}<ArrowRight size={16} /></button>}
          </form>
          <div className="mt-7 flex items-start gap-3 border-t border-line pt-5 text-xs leading-6 text-ink-muted">
            <MapPin size={18} className="mt-1 shrink-0" />
            <p>Sample service area: New York and New Jersey. Vehicle capacity and short-notice rules are checked before checkout. Records last for this local server session.</p>
          </div>
        </div>

        <div aria-busy={Boolean(busy)}>
          {error && <div role="alert" className="mb-5 border-l-4 border-red-700 bg-red-50 p-4 text-sm leading-6 text-red-900">{error}<button type="button" onClick={restart} className="mt-2 block min-h-11 underline underline-offset-4">Start a fresh walkthrough</button></div>}

          {reservation ? (
            <div className="border border-line-strong bg-white p-6 sm:p-8">
              {reviewRequired ? <Clock size={32} weight="duotone" /> : <CheckCircle size={32} weight={complete ? "fill" : "duotone"} />}
              <p className="section-kicker mt-6">{reviewRequired ? "Human handoff" : "Simulation"}</p>
              <h2 ref={resultHeading} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-[-.04em] outline-none">{reviewRequired ? "Held for operator review." : complete ? "Walkthrough complete." : "Your demo checkout is ready."}</h2>
              <p className="mt-4 text-sm leading-7 text-ink-muted">{reviewRequired ? "This pickup is within twelve hours. The request is recorded for a person to review; the walkthrough does not approve it or open payment." : complete ? "The example payment step is recorded. No actual payment, ride booking or driver dispatch took place." : "The vehicle and approved price are attached to one reservation. Complete the simulated payment to see the final state."}</p>
              <dl className="mt-7 divide-y divide-line border-y border-line">
                <Detail label="Vehicle" value={reservation.vehicleName} />
                <Detail label="Approved total" value={money(reservation.quotedTotalUsd)} />
                <Detail label="Record" value={reservation.id} />
              </dl>
              {!complete && !reviewRequired && <button type="button" onClick={completePayment} disabled={Boolean(busy)} className="button-primary mt-7 w-full justify-center disabled:opacity-50">{busy === "complete" ? "Completing…" : "Complete simulated payment"}<ArrowRight size={16} /></button>}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button type="button" onClick={restart} disabled={Boolean(busy)} className="min-h-11 text-sm underline underline-offset-4">Try another trip</button>
                <Link href="/#contact" className="min-h-11 py-3 text-sm underline underline-offset-4">Discuss your operation</Link>
              </div>
            </div>
          ) : quote ? (
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-[-.035em]">Choose a vehicle.</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Example prices</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{quote.routeLegs[0] ? `${quote.routeLegs[0].distanceMiles.toFixed(1)} estimated miles · ${Math.round(quote.routeLegs[0].durationMinutes)} minutes` : "Trip validated"}. Only vehicles that fit your party are shown.</p>
              <div className="mt-6 space-y-3">
                {Object.values(quote.quotes_by_vehicle).filter((item): item is ExampleLimoVehicleQuote => Boolean(item)).map((vehicle) => (
                  <button type="button" key={vehicle.vehicleName} onClick={() => selectVehicle(vehicle.vehicleName)} aria-pressed={selection?.selectedVehicle === vehicle.vehicleName} disabled={Boolean(busy)} className={`flex w-full items-center gap-4 border p-5 text-left transition-colors disabled:opacity-60 ${selection?.selectedVehicle === vehicle.vehicleName ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink"}`}>
                    <SteeringWheel size={26} className="shrink-0" />
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold">{vehicle.vehicleName}</span><span className={`mt-1 block text-xs ${selection?.selectedVehicle === vehicle.vehicleName ? "text-white/60" : "text-ink-muted"}`}>{vehicle.vehicleName === "Luxury Sedan" ? "Up to 3 passengers · 3 bags" : "Up to 6 passengers · 6 bags"}</span></span>
                    <span className="text-xl font-semibold tracking-[-.04em]">{busy === vehicle.vehicleName ? "…" : money(vehicle.quotedTotalUsd)}</span>
                  </button>
                ))}
              </div>
              {quote.requiresAdminApproval && <p className="mt-5 border-l-4 border-signal bg-white p-4 text-sm leading-6">This pickup needs operator review before payment. You can still submit the quoted request to see the handoff.</p>}
              {selection && selectedQuote && <div className="mt-7 border-t border-line-strong pt-6">
                <h3 className="text-xl font-semibold tracking-[-.03em]">Review and approve.</h3>
                <dl className="mt-4 divide-y divide-line"><Detail label="Subtotal" value={money(selectedQuote.subtotal)} /><Detail label="Gratuity" value={money(selectedQuote.gratuityAmount)} /><Detail label="Tax" value={money(selectedQuote.taxAmount)} /><Detail label="Total" value={money(selection.quotedTotalUsd)} /></dl>
                <label className="mt-5 flex cursor-pointer items-start gap-3 border border-line-strong bg-white p-4 text-sm leading-6"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} disabled={Boolean(busy)} className="mt-1 h-5 w-5 shrink-0 accent-black" /><span>I approve the {selection.selectedVehicle} at {money(selection.quotedTotalUsd)} for this sample trip.</span></label>
                <button type="button" onClick={createCheckout} disabled={!approved || Boolean(busy)} className="button-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">{busy === "checkout" ? "Preparing your request…" : quote.requiresAdminApproval ? "Submit for operator review" : "Create demo checkout"}<ArrowRight size={16} /></button>
              </div>}
            </div>
          ) : (
            <div className="flex min-h-[390px] flex-col justify-between border border-line-strong bg-ink p-6 text-white sm:p-8">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-signal">The next step stays controlled</span>
              <div className="my-10"><SteeringWheel size={48} weight="duotone" className="text-signal" /><h2 className="mt-5 max-w-sm text-3xl font-semibold leading-tight tracking-[-.04em]">A clear price.<br />An explicit approval.</h2><p className="mt-5 max-w-sm text-sm leading-7 text-white/60">Compare vehicles for your trip, then choose the exact price you want to approve. Requests that need a person stay in review.</p></div>
              <p className="border-t border-white/15 pt-5 text-xs leading-6 text-white/50">The live product requires configured operator rates, connected providers and customer acceptance before it can take real bookings.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-2 text-xs font-semibold text-ink-muted">{label}{children}</label>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-5 py-3 text-sm"><dt className="shrink-0 text-ink-muted">{label}</dt><dd className="min-w-0 break-all text-right font-medium">{value}</dd></div>
}
