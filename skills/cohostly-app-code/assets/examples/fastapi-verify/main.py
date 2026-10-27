import os

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request

app = FastAPI()

# The platform gives every app PLATFORM_AUTH_URL. It is the token's issuer, and its signing keys are published at /.well-known/jwks.json.
AUTH_URL = os.environ["PLATFORM_AUTH_URL"].rstrip("/")
keys = jwt.PyJWKClient(f"{AUTH_URL}/.well-known/jwks.json", cache_keys=True)


def platform_context(request: Request) -> dict:
    """The verified request context, as the groups the platform sends: {"caller": {...}, "access": {...}, ...}."""
    token = request.headers.get("x-platform-context")
    if not token:
        raise HTTPException(401, "This app must be opened through the platform.")
    # The token is for one app address: the host the request arrived on.
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host", "")).lower()
    try:
        claims = jwt.decode(
            token,
            keys.get_signing_key_from_jwt(token).key,
            algorithms=["ES256"],  # never "none", never a shared-secret algorithm
            audience=host,
            issuer=AUTH_URL,
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(401, "The platform's context for this request could not be verified.")
    return claims.get("ctx", {})


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/me")
def me(ctx: dict = Depends(platform_context)):
    caller = ctx.get("caller", {})
    return {"kind": caller.get("kind"), "id": caller.get("id"), "role": ctx.get("access", {}).get("role")}


@app.get("/editors-only")
def editors_only(ctx: dict = Depends(platform_context)):
    if ctx.get("access", {}).get("role") not in ("editor", "admin", "owner"):
        raise HTTPException(403, "This needs the editor role.")
    return {"ok": True}
