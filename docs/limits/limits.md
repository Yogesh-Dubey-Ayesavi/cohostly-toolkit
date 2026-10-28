---
title: Limits
description: The numbers behind your account and your app, and what happens when you reach one.
---

> **Starting values** The numbers on this page are the free defaults and are expected to change as real use is seen. An operator can also raise or lower them for one account. When you reach a limit, the message names it, tells you what the account has, and says how to raise it.

## Per account

| Limit | Free default | Checked when |
| --- | --- | --- |
| Projects | 5 | A new project is deployed. |
| Running apps at once | 2 | An app is started or woken. |
| Total memory of running apps | 2048 MB | An app is started or woken. A sleeping app does not count. |
| Databases | 6 | A project's first database, at deploy. |
| Deploys per hour | 10 | A deploy. |
| Builds per day | 40 | A deploy. Each version is a build. |

A refusal is a 403 that names the limit. At the web address itself it is a 429.

## Per visitor and per project

Per calendar minute, counted at the edge before your app is reached:

| Limit | Default |
| --- | --- |
| Requests from one network address to one project | 600 |
| Requests to one project from everyone | 6000 |

Only the address over its limit gets the 429. A `Retry-After` header says how many seconds until the next minute. The window is fixed, so a burst at the turn of a minute can reach twice the limit.

### Abuse protection

Nothing is banned automatically. A project is flagged for review and held to a quarter of the normal request limits when it shows:

- **Sustained heavy CPU**: about 90% or more for most of two hours.
- **Scanning**: one address collecting 100 "not found" or "forbidden" answers in a minute is held to 30 requests a minute for ten minutes.

## Builds and uploads

- A build is limited to 10 minutes and about 1 MB of build log.
- A deploy carries up to 100 secrets.
- The upload size is limited. `node_modules`, `.git`, `.vercel`, `.next`, `__pycache__` and `.DS_Store` are left out already. Leave out build output and big data files too.
- Supported versions: Node 16, 18 and 20 to 24; Python 3.9 to 3.13; Go 1.18 to 1.29.
- Build steps the platform runs: `npm run <script>`, `pnpm run <script>`, `yarn <script>` and `npx next build`.

## Machines

| Setting | Values |
| --- | --- |
| Memory | 256, 512 (default), 1024 or 2048 MB |
| Idle time before sleep | 10 minutes by default |
| Health check wait | 5 seconds by default |
| One run | Has a length cap. The app pauses when it ends and wakes on the next visit. |

## Services

| Service | Limit |
| --- | --- |
| AI | $2.00 per project per month by default, $10.00 per account. See [AI](../bindings/ai.md). |
| Data | A read returns at most 1000 rows (100 with no `take`). A query is stopped at 10 seconds. About 16 queries at once per project. |
| Approvals | `details` up to 16 KiB. Expiry between 60 seconds and 7 days. |
| Cron | A one-off timer's payload up to 8 KB. A run times out at 10 minutes by default. Retries 0 to 5. |
| Connections | A secure link for entering a secret works once and lasts 15 minutes. |

## Sharing and keys

- A new invitation lasts 14 days.
- Data keys last 1 to 90 days.
- A sealed `.cohostly` file lasts 7 days by default, and `env.enc` 30 days. Choose from 1 to 30 days.
- A change in who can open an app reaches visitors within about 30 seconds.

## Not limited, and not promised

- **Backup storage** has no limit set yet.
- **Database storage** is bounded by the database provider's own plan.
- **Email volume** and approval emails are not sent yet.
- **Windows** for the CLI is not supported.
- **Disk durability** is not promised. Keep information in [the database](../bindings/data.md).
