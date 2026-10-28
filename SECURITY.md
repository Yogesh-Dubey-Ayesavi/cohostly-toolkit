# Security policy

## Reporting a vulnerability

Do not open a public issue. Use GitHub's **private vulnerability reporting** (Security tab, "Report a vulnerability") on this repository.

You will get an acknowledgement within 5 working days. We aim to ship a fix or a mitigation within 30 days for confirmed issues and will credit you unless you ask us not to.

## Supported versions

Only the latest published minor version of each package receives fixes while the packages are on `0.x`.

| Package | Supported |
| --- | --- |
| `cohostly` (CLI) | latest `0.x` |
| `@cohostly/sdk` | latest `0.x` |
| Skills | `main` |

## Scope

In scope: the CLI, the SDK, and the skill text and example apps in this repository.

Out of scope: the Cohostly platform itself (report that privately through the same channel and we will route it), and third-party tools the CLI downloads (Railpack).

Skills are instructions an AI agent follows. Treat a change to a `SKILL.md`, to a file it references, or to a script under `scripts/` as a change to executable behaviour, and review it that way.
