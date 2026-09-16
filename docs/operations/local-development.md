# Local development

The canonical product and delivery reference is the sibling [Proton/Volimox blueprint](../../../Proton/BLUEPRINT.md). This repository serves the Volimox public site and Example Limo demonstration. The full reservation and operations portal core belongs to `Proton`; a customer delivery uses that shared core with its own deployment, Firebase resources, brand, account, and provider configuration.

## Start the local demonstration

Use the Node.js version supported by the installed Next.js package and the dependencies from `package-lock.json`. `node scripts/check-setup.mjs --local` checks installed package presence and Node compatibility without installing anything or contacting a provider. A fresh checkout needs its locked dependencies installed with `npm ci` before these commands can run.

```powershell
node scripts/check-setup.mjs --local
node scripts/dev-local.mjs
```

The npm aliases are:

```powershell
npm run check:setup -- --local
npm run dev:local
```

If a Windows npm shim reports that its `npm-cli.js` is missing, use the direct `node scripts/...` commands above with an existing dependency installation. The launcher uses the installed Next.js CLI through the current Node executable; it does not depend on the npm shim or change global Node/npm settings.

Open `http://127.0.0.1:3002` for the site and `http://127.0.0.1:3002/example-limo` for the walkthrough. Stop the launcher with Ctrl+C. Port 3002 is fixed; if another process already uses it, stop that known process or use its existing session before starting a second copy.

The launcher forces these settings only in its child process:

| Setting | Local value |
| --- | --- |
| `VOLIMOX_LOCAL_DEMO` / `NEXT_PUBLIC_VOLIMOX_LOCAL_DEMO` | `true` |
| `EXAMPLE_LIMO_PROVIDER_MODE` | `simulate` |
| `EXAMPLE_LIMO_USE_PROTON_CREDENTIALS` | `false` |
| `NEXT_DIST_DIR` | `.next-local` |
| `NODE_ENV` | `development` |
| `VOLIMOX_DEMO_TENANT_ID` | `volimox-local-demo` |
| Firebase and Google cloud project/database settings | Empty |
| Site and demo URL settings | `http://127.0.0.1:3002` |

It blanks Firebase, Firestore emulator, Google, voice, Stripe, Twilio, Retell, SMTP, and Proton credentials before starting Next.js. Firebase and Google cloud project identifiers, database URLs, and emulator endpoints are also cleared so they cannot attach the simulation to an external service. It disables Next telemetry. Existing `.env.local` values remain on disk and normal `npm run dev` can still use them. The local command creates no Firestore client and uses in-memory demo state; restarting the server clears that state. Simulated checkout and notification results do not represent a payment or delivered message.

## Inspect configured development

```powershell
node scripts/check-setup.mjs
node scripts/check-setup.mjs --local --json
```

The default check loads development environment files with Next's own parser. `--local` applies the launcher's overrides before reporting. Both modes print only configuration names, presence states, and known mode labels. Placeholder values are marked separately. Neither command prints secrets, tests credentials, sends messages, creates payment sessions, or checks provider connectivity. Exit code 0 means the installed runtime and environment-file loading checks passed; it does not mean every provider is configured.

The existing `/api/health` endpoint checks the running application. `/api/ready` checks Firestore and returns degraded/503 when Firestore is absent in local mode; this is expected. Use the page and Example Limo walkthrough to verify the local experience. Development recompilation can clear a walkthrough session; use “Start a fresh walkthrough” if it expires after an edit.

## Verify the local implementation

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/vitest/vitest.mjs run --configLoader native src/tests/local-demo.test.ts src/tests/local-demo-middleware.test.ts
```

The native Vitest configuration loader avoids a Windows configuration-bundling permission failure encountered in this workspace. The npm alias is `npm run test:local-demo`.

Verified on September 12, 2026:

- TypeScript checking and the optimized Next.js production build passed. The build used an environment with provider credentials removed and local-only UI disabled; it verifies compilation, not live provider behavior.
- All 75 focused tests passed: 37 local simulation/middleware checks and 38 existing Example Limo checks.
- The browser completed quote, vehicle selection, explicit price approval, simulated checkout, and simulated payment. A short-notice request stayed in operator review without opening payment; an unsupported passenger count showed a validation error.
- At a 390px viewport, the booking form and homepage had no horizontal overflow. Mobile navigation, pilot disclosure, and local fonts worked.

Webpack reported that it could not persist its dependency snapshot cache in this restricted environment. Compilation and page generation still completed successfully.

## Configure provider work

Copy `.env.example` to `.env.local` only when no environment file exists. Fill in settings for the feature being tested; placeholder strings are not working credentials. `npm run dev` uses the configured runtime on port 3002. With a broken npm shim, use `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3002`.

| Feature | Relevant configuration |
| --- | --- |
| Volimox persistence | `FIREBASE_SERVICE_ACCOUNT_KEY` as one-line JSON or base64 JSON; `VOLIMOX_FIREBASE_PROJECT_ID=volimox-platform`; optional `VOLIMOX_FIRESTORE_DATABASE_ID`. Proton's Firebase project is rejected. |
| Browser voice | `VOICE_PROVIDER`, its matching `XAI_API_KEY` or `GEMINI_API_KEY` / `GEMINI_VOICE_API_KEY`, model settings, and `VOICE_DEMO_SESSION_SECRET`. |
| Example Limo live route/checkout/SMS | `EXAMPLE_LIMO_PROVIDER_MODE=live`, dedicated `EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY`, quote HMAC secret, Stripe secret/webhook secret, Twilio account/token, and a messaging service or sender number. |
| Proton booking bridge | `PROTON_API_BASE_URL` and `PROTON_API_KEY`, with an explicitly chosen Proton environment. |
| Retell call and follow-up SMS | `RETELL_API_KEY`, `RETELL_DEMO_VOICE_AGENT_ID`, `RETELL_WEBHOOK_SECRET`, Twilio account/token, and an allowed sender. |
| Email notifications | `EMAIL_USER` / `EMAIL_PASS` or `SMTP_USER` / `SMTP_PASS`; SMTP host/port and notification recipient as needed. |
| Other demo integrity/routes | `VOLIMOX_DEMO_LINK_SECRET`, `MOX_DEMO_VOICE_HMAC_SECRET`, `VOLIMOX_RATE_LIMIT_SECRET`, and Google Maps key where the route requires it. |

Example Limo's generic Google/Stripe/Twilio credential fallback requires `EXAMPLE_LIMO_USE_PROTON_CREDENTIALS=true`. Keep it false for an independent customer setup and provide dedicated credentials. `simulate` describes the Example Limo provider adapter; the configured runtime can still invoke separate browser voice or other provider routes. Use `dev:local` for the isolated walkthrough.

Before provider work, choose the intended environment and use test accounts, numbers, and payment mode appropriate to that work. Then verify tenant isolation, Auth, Firestore rules and indexes, Storage, Functions, callback URLs and signatures, and the actual call/quote/payment/dispatch/notification outcomes required by the blueprint. Payment success requires provider confirmation. Customer access and commission acceptance belong to the full portal delivery checks. This local setup does not deploy or certify those systems.
