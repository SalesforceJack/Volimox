import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function serviceAccount() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
  if (!value) return null
  try {
    return JSON.parse(value.startsWith("{") ? value : Buffer.from(value, "base64").toString("utf8"))
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is invalid.")
  }
}

export function demoDb() {
  const account = serviceAccount()
  if (!account) return null
  const app = getApps()[0] || initializeApp({ credential: cert(account) })
  return getFirestore(app, process.env.FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)")
}
