# AGENTS.md

Guidance for any coding agent (or person) working in this repo. `CLAUDE.md` imports this file.

## What this is

The public part of Cohostly: the command line (`cohostly`), the app-side SDKs (`@cohostly/sdk`), and the agent skills. The platform that runs apps is **not** here. It lives in a private repository.

## Layout

Status key: **live** = in this repo now, **planned** = not yet present.

| Path | What | Status |
| --- | --- | --- |
| `packages/cli` | The `cohostly` command line (npm: `cohostly`) | live |
| `packages/sdk` | The app-side SDK (npm: `@cohostly/sdk`) | live |
| `skills/<name>/` | Agent skills: `SKILL.md`, `references/`, `assets/`, `scripts/`, `evals/` | live |
| `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE` | Repository health files | live |

Do not create an empty folder for a planned item. Add it in the change that moves the code.

## Rules

- **Nothing private.** No API keys, internal hostnames, project IDs, customer data, or links into the private repo's files. If a doc needs a platform fact, state the fact.
- **Skills are plain folders.** `skills/<name>/SKILL.md` has YAML frontmatter with `name` (equal to the folder name; lowercase letters, digits, hyphens; at most 64 characters) and `description` (what it does, then when to use it). The body is a router under about 150 lines. Detail goes in `references/<topic>.md`, each opening with a one-line "read this when". Point to a source of truth instead of copying it, so copies cannot drift.
- **Skills are served live.** The platform fetches `skills/` from this repo at a pinned ref and refreshes it when `main` changes. A merged skill change reaches agents without a platform deploy. Never rename a skill folder or a reference file without a deprecation note, because agents and links name them.
- **Prompts are not here.** The platform's own system prompts and templates are private. Only skills are public.
- **Pin versions.** Exact versions in lockfiles, `engines` set, GitHub Actions pinned to a major version or a commit SHA, and no `latest` tags.
- **No dead code, no commented-out code, no duplicate logic.** One module, one job.
- **Tests are feature-driven.** Name them for what a person sees ("rejects an expired token"), not for the function they call.

## Commands

Each package is self-contained. From `packages/<name>`: `npm ci`, `npm run build`, `npm test`.

## Release

Packages are versioned independently with semver. While on `0.x` a minor bump may break; the changelog says so. Publish the SDK before the CLI that depends on it.
