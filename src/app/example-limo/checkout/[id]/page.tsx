import Link from "next/link"
import { notFound } from "next/navigation"
import { readExampleLimoReservation } from "@/lib/example-limo/store"
import { completeSimulationAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ExampleLimoCheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params
  await searchParams
  const reservation = await readExampleLimoReservation(id)
  if (!reservation) notFound()
  const paid = reservation.status === "paid"
  return (
    <main className="min-h-screen bg-[#111111] px-5 py-16 text-white sm:px-10">
      <div className="mx-auto max-w-xl border border-white/15 bg-white/[.04] p-8 sm:p-12">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#f4d03f]">Example Limo secure checkout</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-.05em]">{paid ? "Payment received." : reservation.status === "pending_review" ? "Human review required." : "Your secure checkout is ready."}</h1>
        <p className="mt-5 text-sm leading-7 text-white/60">{paid ? "Your Example Limo reservation has been marked paid." : reservation.status === "pending_review" ? "This ride is within the short-notice review window. Dispatch must approve it before payment can begin." : `Vehicle: ${reservation.vehicleName}. Total: $${reservation.quotedTotalUsd.toFixed(2)}.`}</p>
        {!paid && reservation.status !== "pending_review" && reservation.providerMode === "simulate" && <p className="mt-6 border border-[#f4d03f]/30 bg-[#f4d03f]/10 p-4 text-sm text-[#f4d03f]">Simulation mode is active. No real payment, SMS, or dispatch action was performed.</p>}
        {reservation.status === "simulation_ready" && reservation.providerMode === "simulate" && <form action={completeSimulationAction.bind(null, reservation.id)} className="mt-6"><button type="submit" className="inline-flex h-12 items-center bg-[#f4d03f] px-5 text-sm font-semibold text-[#111111]">Complete simulation</button></form>}
        <Link href="/#live-demo" className="mt-8 inline-flex h-12 items-center bg-white px-5 text-sm font-semibold text-[#111111]">Return to live demo</Link>
      </div>
    </main>
  )
}
