# machine-access

An app a program can call with an access key, limited by scope.

- **Shows:** `caller.kind === "machine"`, `access.scopes` and `caller.label` from the verified context.
- **Bindings:** none. A key is not a binding; it belongs to this one project.
- **Make a key:** a person with the admin role on the project makes it, in the dashboard or with `POST /v1/projects/<name>/access-keys` and `{ "label": "Zapier", "scopes": ["orders:write"] }`. The secret is shown once. The sender uses it as `Authorization: Bearer <secret>` (or the `X-Platform-Key` header). An assistant cannot hand a key to a sender for you, and should never print one.
- **Try it:** `curl -X POST https://<app address>/orders -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d '{"id":"1"}'`. A key without `orders:write` gets 403.
- **Not the same as an API key** (`plk_...`), which lets the CLI, MCP and CI manage the platform. See `cohostly-host/references/auth.md`.

Read `references/context.md` for the fields.
