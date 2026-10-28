---
title: The settings file
description: cohostly.json is a short file that changes how your app runs. Most apps need none.
nav: Settings file
---

The settings file is `cohostly.json`, at the top of your app folder. Older projects may call it `manifest.json`, which still works when it is Cohostly's own. A web app's or browser extension's `manifest.json` is ignored. If both files exist, `cohostly.json` is used.

## You usually do not need one

A project with no settings file deploys. The platform works out the app type, port and start command, and shows you its guess first. Write a file only to change something, and change only that. A small file is easier to review than a full one.

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "calc-history",
  "lifetime": { "idle_timeout": "10m" },
  "env": { "secrets": ["STRIPE_KEY"] }
}
```

Every key you leave out takes its default. Check the result with `cohostly manifest check`, which prints each value and where it came from.

## Sections

| Key | What it controls |
| --- | --- |
| `manifest_version` | `2` is current. A missing value is read as 2 with a notice. `1` is accepted and upgraded in memory with a warning. The file on disk is never rewritten. |
| `name` | The project name. |
| `runtime` | `entrypoint` (the start command), `version`, and `system_packages` (Debian packages to add). |
| `compute` | `vcpu` and `memory` in MB. The sizes are 256, 512, 1024 and 2048, and a value between rounds up. |
| `lifetime` | `idle_timeout`, `pause_mode`, `max_duration`, `on_timeout`: when the app sleeps and how it wakes. |
| `env` | `vars` (plain values), `secrets` (names only), and a few delivery options. |
| `health` | `path`, `port` and `timeout_ms` (default 5000). |
| `network` | `egress` (`open` by default, or `restricted`) and `allowed_hosts`. |
| `session_affinity` | Sticky routing mode. |
| `bindings` | `ai`, `data`, `connections`, `approvals`, `cron`. See [bindings](../bindings/overview.md). |
| `context` | What the app learns about each visitor: `preset` (`none`, `basic`, `friendly`, `full`) and `expose`. |
| `storage` | For stateful apps. See the warning below. |
| `visibility` | **Ignored.** A deploy never changes who can open an app. See [sharing](../cli/sharing.md). |
| `listing` | A placeholder for discovery, planned. Setting it has no effect. |

## Defaults

- Memory 512 MB.
- Idle timeout 10 minutes, then pause with memory kept (`pause_mode: memory`).
- Outgoing network open.
- Health timeout 5000 ms.
- No bindings and no secrets.
- The project starts private.

## Limiting outgoing connections

```json title="cohostly.json"
{ "network": { "egress": "restricted", "allowed_hosts": ["api.example.com", "*.example.org"] } }
```

An entry is a domain, a subdomain wildcard, an IPv4 address or an IPv4 range. URLs, ports, IPv6, `*.com`, `0.0.0.0/0` and private addresses are refused. Domain rules apply on ports 80 and 443. For another port, list the server's IPv4 address or range. The platform's own address is always allowed. A changed list takes effect on the next deploy.

> **Careful** Restricted egress is a seatbelt, not a vault. DNS lookups and outbound port 25 are not blocked by it, and a blocked connection can look successful until a real request is sent. Do not rely on it as a security wall.

## Warnings you may see

- **A connection with `access: "user"`**: each visitor connects their own account when they first use the app. That is what they will see.
- **Volumes**: there are none. Setting `storage.persistent` or `mount_path` produces a warning. Keep information in [the database](../bindings/data.md).
- **Unknown field**: a warning, not an error. Check the spelling.
- **Version 1 file**: upgraded in memory with a warning. Rewriting it as version 2 is up to you.

## Errors

Errors name the field and the allowed pattern in plain words. Fix the field the message names.

- `runtime.engine` is gone. `auto` and `linux` are ignored with a notice and `unikraft` is refused, so remove the line.
- A reserved name used as a connection name (`ai`, `approvals`, `data`, `connections`, `bindings`, `platform`): rename it. Names become part of your code, so renaming later breaks the app.
- Memory below 256 or above 2048: pick a value in range.

## Changing a deployed app

A new settings file makes a new version. Old versions keep their own settings and never change. Some changes need the app to restart, and the result says so.

## What must never be in this file

Secret values, keys or tokens. Only secret **names** go in `env.secrets`.
