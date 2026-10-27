# sheet-form

A sign-up form that appends each email to the owner's Google Sheet.

- **Shows:** a connection (`google-sheets`, `access: "owner"`), the official Google client handed to the connection, and answering the "not connected yet" state plainly.
- **Bindings:** `connections` named `sheet`. Rename it and the code must change with it: the name is part of the API.
- **Setup:** the owner connects Google Sheets once in the dashboard (Connections). Set `SHEET_ID` as a plain setting under `env.vars` in `cohostly.json`.
- **Use `access: "user"` instead** when each visitor's own sheet should be used; then the call must happen inside a request handled by `middleware()`, and the visitor may be sent to `err.connectUrl` first.

Read `references/bindings.md` ("Connections") for the error codes.
