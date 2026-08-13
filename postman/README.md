# Volimox API contract collection

The collection covers liveness/readiness, the global demo quote, lead validation, and the Proton quote bridge. It uses only placeholder variables and example payloads; it does not create provider side effects.

1. Start Volimox with `npm run dev`.
2. Import `Volimox.postman_collection.json` and `Volimox.local.postman_environment.json` into Postman.
3. Set `baseUrl` to local or staging. Keep provider secrets out of the collection and Git.
4. Run the collection in an environment where external dependencies are intentionally configured if you want the successful provider paths.

Validate the committed collection and environment JSON without network access with `npm run validate:postman`. This statically checks collection structure, request definitions, environment values, and credential hygiene; it does not execute endpoints or Postman test scripts. Newman can execute the collection when it is installed locally:

```text
npx newman run postman/Volimox.postman_collection.json -e postman/Volimox.local.postman_environment.json
```
