# connect-accounts

A multi-tenant app: every visitor connects their own Google and Outlook account and sees their own calendar. The app stores nothing about anyone.

- **Shows:** `access: "user"` connections end to end. Per visitor, a status card with the three states you must design for: **not connected** (a Connect button), **connected** (the account name and their data, plus "Use a different account"), and **needs to be connected again** (a reconnect button). `allowed()` tells you which, before you make the real call.
- **Bindings:** `connections` with two person-mode connections (`google-workspace` and `microsoft-graph`, both `calendar.read`).
- **How the visitor connects:** the Connect button is the platform's own connect page (`connect_url`): one page, the provider's OAuth consent, then back to your app. Your app never sees a code, a token or a client secret, and does not need its own OAuth app registration.
- **Why it is safe for many visitors:** the platform picks the connection from the signed request context, so one visitor can never reach another's account. The middleware must wrap the request (`middleware()`); a call made outside a request (a timer) fails with `caller_unknown`.
- **Sharing:** open it to the people who should connect (`link`, `public` or `signed_in`). A visitor must be signed in to Cohostly to connect, because the connection belongs to their Cohostly account; anonymous visitors get a sign-in link.
- **Before the first run:** `npm run types` writes `platform.gen.ts` (or use `preview_contract` with `cohostly.json` before the first deploy).
- **Visitor ends the link:** a person can disconnect their own account any time in the dashboard under Connections; the card then shows "Not connected" again.

Read `references/bindings.md`, "Connections", for the error table, and `sign-in.md` if your visitors may not have Cohostly accounts.
