# go-verify

Verifies the platform's signed request context in Go, with the standard library only.

- **Shows:** the checks in `references/verify-token.md`: ES256 only, the key chosen by `kid` from the platform's published keys, the lifetime, the issuer, the audience (the host the request arrived on), then reading the `ctx` claim. `/me` answers who is calling.
- **Bindings:** none.
- **Settings:** `visibility: "private"`; the context arrives on every request that reaches the app.
- **Do not decide from a header** such as `X-Platform-Caller-Id`: a header is a claim, only the token is verified.

Python version: `fastapi-verify`. Fields: `platform://reference/context-fields`.
