"use server"

import { revalidatePath } from "next/cache"
import { completeExampleLimoSimulation } from "@/lib/example-limo/simulation"

export async function completeSimulationAction(id: string) {
  await completeExampleLimoSimulation(id)
  revalidatePath(`/example-limo/checkout/${id}`)
}
