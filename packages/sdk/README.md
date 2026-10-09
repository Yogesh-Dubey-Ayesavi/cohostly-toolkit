# @cohostly/sdk

The app-side SDK. Private for now; it will be one of the two npm packages (with the CLI).

- **Request context:** `context(request)`, `middleware()`, `me()`, `platformFetch()` verify and carry the signed caller context (Phase 7).
- **The `platform` object:** `createPlatform(routes)` turns a generated route table into typed methods for the bindings a project declared (Phase 9). It owns the token, request ids, idempotency keys, timeouts, retries and structured `PlatformError`s.
- **Type generation:** `platform types --project <name>` (CLI), or `cohostly-sdk types` under `platform dev`, fetches each declared binding's OpenAPI document from the gateway and writes `platform.gen.ts` and `platform.contract.md` into the project. `--check` fails on a stale file. See `docs/decisions/bindings.md`.

```ts
import platform from './platform.gen.js'
const reply = await platform.ai.messages({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })
```

TypeScript only for now. Python and Go come later as generated files from the same documents.
