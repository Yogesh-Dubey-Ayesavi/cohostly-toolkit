# Cohostly Toolkit

The public tools for [Cohostly](https://cohostly.cloud): a command line to put an app online and share it, an SDK for the code that runs there, and the skills that teach an AI agent to do both.

> **Status: early.** The CLI, SDK and skills are imported with their history from the private monorepo. Both packages are on `0.x`.

## What is in the toolkit

| Part | What it does | Where | Status |
| --- | --- | --- | --- |
| **CLI** `cohostly` | `snapshot`, `check`, `deploy`, `share` from your terminal | `packages/cli` | live |
| **SDK** `@cohostly/sdk` | Verify who is calling your app, call platform bindings (AI, data, cron) with typed methods | `packages/sdk` | live |
| **Skills** | `cohostly-host` (deploy and share) and `cohostly-app-code` (write code that runs on Cohostly), plus runnable example apps | `skills/` | live |

## Supported

- **Node.js 20 or later** for the CLI and the SDK. CI runs on Node 22.
- **CLI platforms:** macOS (arm64, x64) and Linux (arm64, x64).
- **SDK language:** TypeScript and JavaScript (ES modules).
- **Skills:** any agent that reads the open `SKILL.md` format (a folder with a `SKILL.md`, optional `references/`, `assets/`, `scripts/`). Also served over the platform's MCP server as `skill://` resources.

## Not supported

- **Windows** for the CLI. Capture, the tool `snapshot` runs, ships for macOS and Linux only.
- **Python and Go SDKs.** They are planned as generated files from the same API descriptions, not hand-written packages.
- **Self-hosting the platform.** This repo holds the client side only.
- **CommonJS** consumers of the SDK. It is ESM-only.

## Pinned versions

| Item | Version |
| --- | --- |
| `cohostly` CLI | `0.1.0` |
| `@cohostly/sdk` | `0.2.1` |
| Node.js (`engines`) | `>=20` |
| TypeScript | `^5.5` |
| Railpack (downloaded by the CLI) | pinned by the CLI, checked against a checksum |

Versions here describe what the first import ships. After that the changelog of each package is the source of truth. Both packages are on `0.x`: a minor release may change behaviour, and the changelog says when.

## How skills reach agents

Skills are edited here and served by the platform without a platform deploy.

1. The platform fetches `skills/` from this repo at a pinned ref and keeps it in memory.
2. A push to `main` sends a webhook; the platform re-fetches once. There is no timer polling.
3. A slow safety refresh uses a conditional request (`ETag` / `If-None-Match`), so an unchanged repo costs a `304` and no download.
4. A copy of the skills is baked into the platform image as a fallback, so a GitHub outage does not stop it starting.

## Repository layout

```
skills/<name>/SKILL.md        the router; name equals the folder name
skills/<name>/references/     read on demand, one topic per file
skills/<name>/assets/         complete small example apps
skills/<name>/scripts/        small deterministic helpers
packages/cli/                 the cohostly command line
packages/sdk/                 @cohostly/sdk
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Working in this repo with an AI agent: see [AGENTS.md](AGENTS.md).

## License

[Apache-2.0](LICENSE).
