import { demoDb } from "@/lib/firebase-admin"
import { createReadinessHandler } from "@/lib/readiness"

export const runtime = "nodejs"

export const GET = createReadinessHandler({ service: "volimox", getDb: demoDb })
