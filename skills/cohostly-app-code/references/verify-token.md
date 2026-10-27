# Verifying the request context in any language

Read this when the app is not Node (Python, Go, anything else) and needs to know who is calling, or when you are checking a verifier someone wrote. The TypeScript SDK does all of this for you (`context.md`); this is the same contract written down.

Working versions that are tested against the real token format: `assets/examples/fastapi-verify` (Python) and `assets/examples/go-verify` (Go).

## The token

Every request that reaches the app carries `X-Platform-Context`, a compact JWT (three base64url parts joined by dots).

| Part | Value |
| --- | --- |
| Header | `alg: "ES256"`, `typ: "JWT"`, `kid`: names the signing key. |
| Signature | ECDSA P-256 over SHA-256 of `<header>.<payload>`. Written as 64 raw bytes (`r` then `s`), **not** DER. Libraries that implement JWT already read it this way; hand-written code must split the 64 bytes in half. |
| Claims | `iss`, `aud`, `iat`, `exp`, `jti`, `sub` (when the caller has an ID), `ctx`. |

- `iss`: the platform's address, exactly `PLATFORM_AUTH_URL` with no trailing slash.
- `aud`: the host this request arrived on, lower case (`x-forwarded-host` if present, otherwise `Host`). A token is for one app address and no other.
- `exp`: 5 minutes after `iat`. The token belongs to one request: `jti` is the request ID.
- `sub`: the caller's stable ID, the same as `ctx.caller.id`. Absent for an anonymous visitor.
- `ctx`: the context in groups, `{ "caller": { "kind": "person", ... }, "access": { "role": "editor", ... } }`. The fields are listed at `platform://reference/context-fields`. A field that is unknown or not allowed is absent. A field the app asked for that the person does not share is `null` next to `<name>_status: "not_shared"`.

## The keys

`PLATFORM_AUTH_URL` is set for every app. The public keys are at `<PLATFORM_AUTH_URL>/.well-known/jwks.json`: a JWKS of EC keys on curve P-256, each with a `kid`. Cache them. When a token names a `kid` you do not have, fetch again, but no more than once every ten seconds, so a flood of bad tokens cannot turn into a flood of fetches.

## The checks, in order

1. Three parts, and the header says `alg: "ES256"`. Refuse `none`, and refuse every shared-secret algorithm.
2. The `kid` is one of the platform's published keys.
3. The signature verifies.
4. `exp` has not passed and `iat` is not in the future, each with up to 30 seconds of clock difference allowed.
5. `iss` equals `PLATFORM_AUTH_URL`.
6. `aud` equals the host the request arrived on.

Any failure is a 401, with one plain sentence ("The platform's context for this request could not be verified."). Never echo the token. Log the reason on the server side only.

## Rules

- **Headers are claims, the token is proof.** The proxy also sends `X-Platform-Caller-Id` and friends for convenience. A visitor can send any header to an app reached some other way; decide nothing from a header you did not check against the token.
- **An anonymous visitor is normal.** No `caller.id` and `caller.kind` of `anonymous` is a valid answer, not a failure. Decide per route whether to let them in.
- **Pass the token on to bindings.** When the app calls the data, AI, approvals or connections gateway on behalf of the visitor, send the same token as `X-Platform-Context`. That is how a row policy or a `user` connection knows who is asking. A call without it runs as no one (or as the app, for a job).
- **Do not forward the token to anything that is not the platform.** It is a bearer for this one app for five minutes.
- **A machine** (an access key) arrives with `caller.kind` `machine`, `caller.label` the key's name and `access.scopes` the scopes it was made with.

## Roles, once verified

`access.role` is the caller's role on this project (`viewer`, `editor`, `admin`, `owner`, or `machine`) and `access.account_role` is their role in the owning account (`owner`, `admin`, `member`). The full permission matrix is `platform://reference/roles`. Check on the server, on every route that matters; hiding a button is not a check.
