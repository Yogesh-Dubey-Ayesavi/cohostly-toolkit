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

/** Which preset reveals each field, so a project's typed context can leave out what its manifest never sends. */
export const CONTEXT_FIELD_INFO: readonly { id: string; fromPreset: 'none' | 'basic' | 'friendly' | 'full'; always: boolean; list: boolean; who: readonly string[]; label: string }[] = [
  { id: "request.id", fromPreset: "none", always: true, list: false, who: ["person", "machine", "anonymous", "platform"], label: "A unique ID for this request. It is also in the platform's logs." },
  { id: "request.time", fromPreset: "none", always: true, list: false, who: ["person", "machine", "anonymous", "platform"], label: "When the platform received the request, in UTC." },
  { id: "request.protocol", fromPreset: "none", always: true, list: false, who: ["person", "machine", "anonymous", "platform"], label: "http, websocket or sse." },
  { id: "caller.kind", fromPreset: "none", always: true, list: false, who: ["person", "machine", "anonymous", "platform"], label: "Whether the caller is a person, a machine, an anonymous visitor or the platform itself." },
  { id: "caller.id", fromPreset: "none", always: true, list: false, who: ["person", "machine"], label: "A stable opaque ID for the person or the access key." },
  { id: "caller.label", fromPreset: "none", always: true, list: false, who: ["machine", "platform"], label: "A readable label, such as the access key's name or \"approvals\" for the platform." },
  { id: "caller.client", fromPreset: "none", always: true, list: false, who: ["person"], label: "The app a person connected through, such as Claude. Only present for people who signed in through an MCP client." },
  { id: "caller.name", fromPreset: "friendly", always: false, list: false, who: ["person"], label: "The person's display name." },
  { id: "caller.email", fromPreset: "full", always: false, list: false, who: ["person"], label: "The person's email address." },
  { id: "caller.avatar_url", fromPreset: "friendly", always: false, list: false, who: ["person"], label: "A link to the person's profile image." },
  { id: "access.how", fromPreset: "none", always: true, list: false, who: ["person", "machine", "anonymous", "platform"], label: "Why the caller is allowed in. collaborator, account, link, public, key or platform." },
  { id: "access.role", fromPreset: "none", always: true, list: false, who: ["person", "machine"], label: "The caller's role on this tool. viewer, editor, admin, owner or machine." },
  { id: "access.account_id", fromPreset: "none", always: true, list: false, who: ["person"], label: "The account that owns the tool, when the person belongs to it." },
  { id: "access.account_role", fromPreset: "none", always: true, list: false, who: ["person"], label: "The person's role in the owning account (owner, admin or member)." },
  { id: "access.scopes", fromPreset: "none", always: true, list: true, who: ["machine"], label: "What the access key is allowed to do." },
  { id: "place.country", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "The country the request came from, from the network address. Best effort." },
  { id: "place.city", fromPreset: "full", always: false, list: false, who: ["person", "machine"], label: "The city the request came from. People must agree. A machine's city is sent only when the owner lists it." },
  { id: "place.time_zone", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "A time zone such as Asia/Kolkata. The person's own setting when known, otherwise derived from the location." },
  { id: "place.utc_offset", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "The offset from UTC right now in that time zone." },
  { id: "place.locale", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "The preferred language, such as en-IN." },
  { id: "device.type", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "mobile, desktop, tablet, bot, cli, library or unknown. A hint only, never proof." },
  { id: "device.browser", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "The browser family, such as Chrome. Never a full version." },
  { id: "device.os", fromPreset: "basic", always: false, list: false, who: ["person", "machine", "anonymous", "platform"], label: "The operating system family, such as Android." },
]
