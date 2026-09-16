import { readExampleLimoReservation, saveExampleLimoReservation } from "./store"

export async function completeExampleLimoSimulation(reservationId: string) {
  const reservation = await readExampleLimoReservation(reservationId)
  if (!reservation) throw new Error("Example Limo reservation was not found.")
  if (reservation.providerMode !== "simulate") throw new Error("Simulation completion is unavailable for live reservations.")
  if (reservation.status === "paid") return { reservation, idempotent: true }
  if (reservation.status !== "simulation_ready") throw new Error("This simulation is not ready to complete.")
  const updated = { ...reservation, status: "paid" as const, simulationCompletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  await saveExampleLimoReservation(updated)
  return { reservation: updated, idempotent: false }
}
