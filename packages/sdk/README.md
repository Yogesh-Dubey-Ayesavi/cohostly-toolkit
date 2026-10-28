# @cohostly/sdk

The app-side SDK, published to npm as `@cohostly/sdk`. See `CHANGELOG.md`.

- **Request context:** `context(request)`, `middleware()`, `me()`, `platformFetch()` verify and carry the signed caller context (Phase 7).
- **The `platform` object:** `createPlatform(routes)` turns a generated route table into typed methods for the bindings a project declared (Phase 9). It owns the token, request ids, idempotency keys, timeouts, retries and structured `PlatformError`s.
- **Type generation:** `platform types --project <name>` (CLI), or `cohostly-sdk types` under `platform dev`, fetches each declared binding's OpenAPI document from the gateway and writes `platform.gen.ts` and `platform.contract.md` into the project. `--check` fails on a stale file. See `docs/decisions/bindings.md`.

```ts
import platform from './platform.gen.js'
const reply = await platform.ai.messages({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'hi' }] })
```

TypeScript only for now. Python and Go come later as generated files from the same documents.

## platform.cron (Phase 13B)

The platform owns the clock, because a paused sandbox runs nothing. `platform.cron` tells it what to run, in the argument order of node-cron (`schedule(when, handler, options)`), so moving from a timer library is an import change. Declare `"cron": { "code": true }` under `bindings` in the manifest.

```js
import platform from "./platform.gen.js";

platform.cron.schedule("every weekday at 9:00", dailyReport, { name: "daily-report", timeZone: "Asia/Kolkata" });

platform.cron.on("trial-ending", async (run) => { await sendReminder(run.payload.userId); });
await platform.cron.once("2026-11-01T09:00:00Z", "trial-ending", { userId });   // up to 8 KB of payload
```

- The schedules are sent to the platform once, shortly after start-up. Define them while the app starts. A name is the schedule's identity across versions; the same name cannot also be in the manifest.
- A web app serves the platform's call at `POST /__platform/jobs/<name>`: mount `platform.cron.express()` (or call `platform.cron.handle(request)`). Only the platform's scheduler may reach it.
- A script with no server needs nothing more: the platform starts it in run mode (`PLATFORM_RUN=<name>`), the SDK runs only that handler and exits 0, or 1 when it throws.
- The handler receives `{ id, name, scheduledFor, attempt, payload }`. Delivery is at least once, so a handler must be safe to run twice: use `run.id` to ignore a repeat.
- In Python: `@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata")`, `platform.cron.once(...)`, and `platform.cron.handle(name, body, caller)` for a web route.
