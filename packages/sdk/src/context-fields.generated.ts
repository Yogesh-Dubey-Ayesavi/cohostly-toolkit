// Code generated from packages/shared/context-fields.yaml by scripts/gen-context.py; DO NOT EDIT.

/** What an app is told about the caller of a request. A field that is unknown or not allowed is absent, never an empty string. */
export interface PlatformContext {
  request?: {
    /** A unique ID for this request. It is also in the platform's logs. Example: 01JC8Q4Z7M2V9K5X3N6T1H8B0D */
    id?: string
    /** When the platform received the request, in UTC. Example: 2026-10-08T09:30:00Z */
    time?: string
    /** http, websocket or sse. Example: http */
    protocol?: string
  }
  caller?: {
    /** Whether the caller is a person, a machine, an anonymous visitor or the platform itself. Example: person */
    kind?: string
    /** A stable opaque ID for the person or the access key. Example: 6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f */
    id?: string
    /** A readable label, such as the access key's name or "approvals" for the platform. Example: Zapier */
    label?: string
    /** The app a person connected through, such as Claude. Only present for people who signed in through an MCP client. Example: Claude */
    client?: string
    /** The person's display name. Example: Ana Silva */
    name?: string
    /** The person's email address. Example: ana@example.com */
    email?: string
    /** A link to the person's profile image. Example: https://example.com/ana.png */
    avatar_url?: string
  }
  access?: {
    /** Why the caller is allowed in. collaborator, account, link, public, key or platform. Example: collaborator */
    how?: string
    /** The caller's role on this tool. viewer, editor, admin, owner or machine. Example: editor */
    role?: string
    /** The account that owns the tool, when the person belongs to it. Example: 0b9a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d */
    account_id?: string
    /** The person's role in the owning account (owner, admin or member). Example: member */
    account_role?: string
    /** What the access key is allowed to do. Example: orders:write */
    scopes?: string[]
  }
  place?: {
    /** The country the request came from, from the network address. Best effort. Example: IN */
    country?: string
    /** The city the request came from. People must agree. A machine's city is sent only when the owner lists it. Example: Bengaluru */
    city?: string
    /** A time zone such as Asia/Kolkata. The person's own setting when known, otherwise derived from the location. Example: Asia/Kolkata */
    time_zone?: string
    /** The offset from UTC right now in that time zone. Example: +05:30 */
    utc_offset?: string
    /** The preferred language, such as en-IN. Example: en-IN */
    locale?: string
  }
  device?: {
    /** mobile, desktop, tablet, bot, cli, library or unknown. A hint only, never proof. Example: mobile */
    type?: string
    /** The browser family, such as Chrome. Never a full version. Example: Chrome */
    browser?: string
    /** The operating system family, such as Android. Example: Android */
    os?: string
  }
}

export const CONTEXT_FIELD_HEADERS: Record<string, string> = {
  "request.id": "X-Platform-Request-Id",
  "request.time": "X-Platform-Request-Time",
  "request.protocol": "X-Platform-Request-Protocol",
  "caller.kind": "X-Platform-Caller-Kind",
  "caller.id": "X-Platform-Caller-Id",
  "caller.label": "X-Platform-Caller-Label",
  "caller.client": "X-Platform-Caller-Client",
  "caller.name": "X-Platform-Caller-Name",
  "caller.email": "X-Platform-Caller-Email",
  "caller.avatar_url": "X-Platform-Caller-Avatar-Url",
  "access.how": "X-Platform-Access-How",
  "access.role": "X-Platform-Access-Role",
  "access.account_id": "X-Platform-Access-Account-Id",
  "access.account_role": "X-Platform-Access-Account-Role",
  "access.scopes": "X-Platform-Access-Scopes",
  "place.country": "X-Platform-Place-Country",
  "place.city": "X-Platform-Place-City",
  "place.time_zone": "X-Platform-Place-Time-Zone",
  "place.utc_offset": "X-Platform-Place-Utc-Offset",
  "place.locale": "X-Platform-Place-Locale",
  "device.type": "X-Platform-Device-Type",
  "device.browser": "X-Platform-Device-Browser",
  "device.os": "X-Platform-Device-Os",
}
