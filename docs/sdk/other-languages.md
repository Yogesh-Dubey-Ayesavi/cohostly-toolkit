---
title: Python, Go and other languages
description: "What to do when your app is not Node: check the visitor's token yourself and call bindings over plain HTTP."
nav: Other languages
---

The typed `platform` object is TypeScript. Apps in Python, Go or anything else can use every binding all the same. There are two pieces to do by hand: **check the visitor's token** and **call the bindings**.

## Checking the visitor's token

Every visit carries `X-Platform-Context`, a signed token (a JWT). Check it before you trust anything it says. Working versions are in the sample folders `fastapi-verify` (Python) and `go-verify` (Go) under `skills/cohostly-app-code/assets/examples/`.

### The token

| Part | Value |
| --- | --- |
| Header | `alg` is `ES256`, `typ` is `JWT`, and `kid` names the signing key. |
| Signature | ECDSA P-256 over SHA-256 of `header.payload`, written as 64 raw bytes (`r` then `s`), **not** DER. JWT libraries read this correctly. Hand-written code must split the 64 bytes in half. |
| Claims | `iss`, `aud`, `iat`, `exp`, `jti`, `sub` (when the caller has an id) and `ctx`. |

- `iss` is exactly `PLATFORM_AUTH_URL`, with no trailing slash.
- `aud` is the address the visitor used, in lower case. The platform also sends it in the `X-Platform-App-Host` header. Compare against that. Use `X-Forwarded-Host` and then `Host` only if it is absent, taking the first entry of a list.
- `exp` is 5 minutes after `iat`. `jti` is the request id.
- `sub` is the caller's stable id, and is absent for an anonymous visitor.
- `ctx` is the context, grouped. A field that is unknown or not allowed is absent. One the app asked for but the person does not share is `null` next to `<name>_status: "not_shared"`.

### The keys

The public keys are at `<PLATFORM_AUTH_URL>/.well-known/jwks.json`, a list of P-256 keys each with a `kid`. Cache them. When a token names a key you do not have, fetch again, but no more than once every ten seconds.

### The checks, in order

1. There are three parts, and the header says `alg: "ES256"`. Refuse `none` and every shared-secret algorithm.
2. The `kid` is one of the published keys.
3. The signature verifies.
4. `exp` has not passed and `iat` is not in the future, each with up to 30 seconds of clock difference allowed.
5. `iss` equals `PLATFORM_AUTH_URL`.
6. `aud` equals the address in `X-Platform-App-Host`.

Any failure is a 401 with one plain sentence. Never echo the token. Log the reason on the server only.

> **Careful** The plain `X-Platform-Caller-Id` and similar headers are claims, not proof. Decide nothing from a header you did not check against the token. An anonymous visitor (no `caller.id`, `caller.kind` of `anonymous`) is a valid answer. Decide per route whether to let them in.

## Calling bindings from another language

Each binding publishes an OpenAPI description at `<binding address>/openapi.json`. The addresses are in the `PLATFORM_BINDINGS` environment variable. Request the description with your binding token in the `X-Platform-Binding-Token` header, then generate a client with any OpenAPI generator. The platform checks that its binding descriptions validate and that the Python and Go clients from OpenAPI Generator compile.

A generated client covers the calls and their types. It does not cover what your app must still do itself:

- Check the visitor's token (above).
- Send the visitor's token as `X-Platform-Context` on calls made for them, so a row rule or a "connect as the visitor" connection knows who is asking.
- The per-table types of your database. A generated client sees `findMany` and a body, not your columns.
- Retries. Approval requests accept an `Idempotency-Key` header, so a retry does not make a second request.

Anything the platform calls **into** your app, such as a scheduled job or an approval decision, is a web hook. Serve it and check the platform's signature (see [approvals](../bindings/approvals.md) and [the clock](../bindings/cron.md)).

For AI there is a shortcut: most stock AI client libraries can be pointed at the gateway with `AI_BASE_URL` as the address and `AI_API_KEY` as the key. See [AI](../bindings/ai.md).

## What exists in Python today

The clock helper has a Python form:

```py title="jobs.py"
@platform.cron("0 9 * * 1-5", name="daily-report", time_zone="Asia/Kolkata")
def daily_report(run):
    ...
```

`platform.cron.once(...)` and `platform.cron.handle(name, body, caller)` for a web route also exist. Typed Python files for other bindings are not available for every binding yet. `cohostly types --lang python` writes them where supported.
