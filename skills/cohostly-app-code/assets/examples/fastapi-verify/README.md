# fastapi-verify

Verifies the platform's signed request context in Python, so a FastAPI app can tell who is calling without the TypeScript SDK.

- **Shows:** the checks in `references/verify-token.md`: ES256 only, the key chosen by `kid` from `PLATFORM_AUTH_URL/.well-known/jwks.json`, the issuer, the audience (the host the request arrived on), the 5-minute lifetime, then reading the `ctx` claim.
- **Bindings:** none.
- **Sharing:** set it `private` after deploying (the settings file cannot), so only people the project is shared with get in. The context arrives on every request that reaches the app.
- **Needs:** `pyjwt[crypto]`. Do not use a header like `X-Platform-Caller-Id` for a decision: a header is a claim, only the token is verified.

Go version: `go-verify`. Fields: `platform://reference/context-fields`.
