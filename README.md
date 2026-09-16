# Volimox

Volimox's public site and Example Limo demonstration run in this Next.js project. The product direction and customer delivery model are defined in the canonical [Proton/Volimox blueprint](../Proton/BLUEPRINT.md). The shared reservation and operations portal core remains in the sibling `Proton` project.

For a local demonstration, use the installed project dependencies and run:

```powershell
node scripts/check-setup.mjs --local
node scripts/dev-local.mjs
```

With a working npm installation, the equivalent commands are `npm run check:setup -- --local` and `npm run dev:local`.

Open [the site](http://127.0.0.1:3002) or [Example Limo](http://127.0.0.1:3002/example-limo). The local launcher fixes simulation mode, disables provider credentials in its child process, and uses `.next-local` for development output. It leaves `.env.local` intact. No provider keys are needed for the walkthrough.

`npm run dev` retains the configured development runtime and can use external providers. Read [local development and provider setup](docs/operations/local-development.md) before enabling those paths. A working simulation does not establish live payment, telephony, customer portal delivery, or production readiness.
