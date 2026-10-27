# The request context

Read this when the app needs to know who is calling, or to show something different to a signed-in person, a machine or an anonymous visitor.

## What arrives

Every request that reaches the app carries a context. It is built by the proxy and describes the caller in small, readable fields. Whatever is unknown is simply absent. Fields are grouped by the question they answer:

| Group | Answers | Examples |
| --- | --- | --- |
| `request` | What is this request? | `request.id`, `request.time` (UTC), `request.protocol` (`http`, `websocket`, `sse`) |
| `caller` | Who or what is calling? | `caller.kind` (`person`, `machine`, `anonymous`, `platform`), `caller.id`, `caller.label` (a key's name), `caller.client`, `caller.name`, `caller.email`, `caller.avatar_url` |
| `access` | Why are they allowed in? | `access.how`, `access.role`, `access.account_id`, `access.account_role`, `access.scopes` |
| `place` | Where are they? | `place.country`, `place.city`, `place.time_zone`, `place.utc_offset`, `place.locale` |
| `device` | What are they using? | `device.type`, `device.browser`, `device.os` |

`caller.name`, `caller.email` and `caller.avatar_url` are personal. They need the person's consent, so they are missing for anyone who has not agreed. `place.city` is not given to a machine unless the owner lists it in `context.expose`. Use `describe_context` to see exactly what a given project's preset sends.

Presets (the project's `context.preset`) decide how much arrives. `basic` is the default. Every field, the preset that reveals it, who it applies to and whether it needs consent is `platform://reference/context-fields` (or `read_reference` with `context-fields`); read that when the question is "does my app get X".

## The headers and the token

For each request the proxy adds:

- `X-Platform-<Group>-<Field>` headers, one per field, for example `X-Platform-Caller-Email` for `caller.email`. The name is the field ID with dots changed to dashes, in title case, after `X-Platform-`.
- `X-Platform-Context`, a signed token with the same fields. It is valid 5 minutes and is tied to that one request (its ID is `request.id`).

Use the token, not the bare headers, for any decision that matters. Verify it with the SDK:

```ts
import { context, middleware } from '@cohostly/sdk'

// one request: returns undefined when there is no valid context
const ctx = await context(req.headers)
if (ctx?.caller.kind === 'person') {
  // ctx.caller.name may be absent if the person has not consented
}

// or as middleware on the whole app (required: true refuses requests without a valid context)
app.use(middleware({ required: false }))
```

The SDK fetches the platform's public keys from `PLATFORM_AUTH_URL` (`<it>/.well-known/jwks.json`) and caches them. For Python, Go or any other language there is no SDK: verify the token yourself with `verify-token.md` (the exact checks), starting from `assets/examples/fastapi-verify` or `assets/examples/go-verify`. Do not read the bare headers as proof.

## Other ways to read it

- `GET /__platform/me` on the app's own address returns the context as JSON. Useful for a single-page app that needs the current person on load. The SDK wraps it as `me()`.
- `platformFetch(url, init)` calls another platform address with the right headers attached.
- `loginUrl(returnTo)` builds the address to send an anonymous visitor to, so they can sign in and come back. Use it for a "Sign in" link rather than building the path by hand.

Paths under `/__platform/` belong to the platform. Only `session`, `logout`, `login` and `me` are answered; the app should not define routes there.

## Rules

- **An anonymous visitor is normal.** Design the page for them too. Do not treat "no context" as an error or a bug.
- **Never trust a claim you did not verify.** A visitor can send any header; only a token that verifies against the platform's keys is the platform's statement.
- **Do not store what you learned as a credential.** The context is per request. Store only what the person chose to save in your app, and say so in the app.
- **Do not log emails or coordinates.** The platform does not log them; the app should not either.
- **Do not show a field as if it were certain.** `place.city` is a guess from the network. Label it "around" or "approximate" if you show it.
- **The visitor's network address is never passed to the app.** Do not look for it in headers; it will not be there.

## Checking it

With `platform dev`, call the route as a signed-in person and as an anonymous caller (no cookie). Compare the output. Then check `describe_context` to confirm the project's preset matches what the code expects.
