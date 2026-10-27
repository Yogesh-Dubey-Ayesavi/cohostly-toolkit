# my-agenda

Shows each signed-in visitor their own next calendar events, using their own Google account.

- **Shows:** a connection with `access: "user"`: the call acts as the visitor, not as the owner. A first-time visitor gets a "Connect Google Calendar" link (`connection_required`, `err.connectUrl`), which is a normal state.
- **Bindings:** `connections` (`google-workspace`, permission `calendar.read`).
- **Settings:** `visibility: "link"`. The app shows a sign-in link to anonymous visitors. To admit only people with a Cohostly account, set `signed_in` with `set_visibility` after deploying (the settings file does not accept it).
- **Before the first run:** `npm run types` writes `platform.gen.ts`.
- **Contrast:** `sheet-form` uses `access: "owner"`, where every visitor writes to the one sheet the owner connected.

Read `references/bindings.md`, "Connections", for the error table.
