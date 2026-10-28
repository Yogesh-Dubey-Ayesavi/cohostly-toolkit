# spa-login

A single-page app with sign-in and sign-out and no server logic.

- **Shows:** `GET /__platform/me` (who is here), `/__platform/login?return=` and `/__platform/logout`, all on the app's own address.
- **Bindings:** none.
- **Settings:** `context.preset: "friendly"` so `caller.name` can arrive (the person must also agree to share it).
- **In a bundled app** (React, Vue, Vite) the SDK wraps the same call: `import { me, loginUrl } from '@cohostly/sdk'`.
- **A browser-only check is a courtesy.** Anything that must be protected (data, an action) is checked on a server with the verified context, never by hiding a button. Pair this with a server example such as `roles-gate` or `notes-data`.

Read `references/context.md`, "Other ways to read it", and `references/sign-in.md`.
