# Recipes: building different kinds of app on Cohostly

Read this at the start of a new app, to pick the closest worked example and the bindings it needs. If the app needs sign-in, read `sign-in.md` first: the choice between the platform's login and the app's own decides the visibility. Each example is a complete small app in `assets/examples/<name>/` with its settings file, code and a README. Copy one, then change it, rather than writing the platform parts from memory.

```bash
scripts/scaffold.sh --list                       # the examples
scripts/scaffold.sh notes-data ./my-notes        # copy one, named my-notes (never overwrites)
```

## Pick by what the app needs

| The app needs to... | Start from | Bindings | Read |
| --- | --- | --- | --- |
| greet people by name, or show something different to signed-in and anonymous visitors | `visitor-greeting` (Node, Express) | none, only the request context | `context.md` |
| answer with a language model | `ai-chat-fastapi` (Python, FastAPI) | `ai` | `bindings.md` |
| keep rows, with each person seeing only their own | `notes-data` (TypeScript, Express) | `data` | `data.md` |
| do something on a clock (a daily report, a nightly cleanup, a reminder at a set time) | `scheduled-report` (TypeScript) | `cron`, `data` | `cron.md` |
| wait for a person to confirm something risky before doing it | `approval-gate` (TypeScript) | `approvals` | `approvals.md` |
| read or write a person's Google or Microsoft account (a sheet, a mailbox, a calendar) | `sheet-form` (TypeScript, Express) | `connections` | `bindings.md` |
| gate pages by role (members, editors, an owner-only admin page) | `roles-gate` (TypeScript, Express) | none | `context.md` |
| accept calls from a program (a webhook, Zapier, a script) with an access key | `machine-access` (TypeScript, Express) | none | `verify-token.md` |
| act as each visitor's own Google account (their calendar, their sheet) | `my-agenda` (TypeScript, Express) | `connections` (`access: "user"`) | `bindings.md` |
| a single-page app that knows who is signed in, with sign-in and sign-out links | `spa-login` (static page, small Node server) | none | `context.md` |
| verify who is calling from Python | `fastapi-verify` (FastAPI) | none | `verify-token.md` |
| verify who is calling from Go | `go-verify` (Go, standard library) | none | `verify-token.md` |
| serve static files, or an ordinary web app with no platform features | none: deploy it as it is | none | `cohostly-host` |

Combine them. A real app usually mixes two or three: for example `notes-data` plus the `visitor-greeting` sign-in link, or `scheduled-report` that writes through `$app` and asks `approval-gate` before deleting.

## What every example does the same way

- **Listens on `process.env.PORT || 3000`** and sets `health.port` to match. A port the health check does not use fails at the start stage.
- **Uses the SDK for the platform parts** (`@cohostly/sdk`). The typed `platform` object is generated into `platform.gen.ts` by `platform types --project <name>` for the bindings the app declares, so an app that uses it is TypeScript (the examples run with `tsx`; `npm run check` type-checks). Regenerate after a manifest or migration change. Python and Go generated clients are not available for every binding yet.
- **Declares every binding in `cohostly.json`**, and nothing else is in that file. Secret *values* never are.
- **Treats "not yet" answers as normal**: an anonymous visitor, a missing consent, a connection nobody has connected yet, an approval still pending.
- **Is safe to run twice** where the platform can deliver twice (scheduled jobs, approval callbacks).

## A framework that needs values at build time (Next.js, Vite and others)

Some frameworks copy a value into the browser code while the app is built (a public API URL, a sign-in key). The value must exist during the build, not only when the app starts, or the built app behaves as if it were unset. A missing login button is the usual sign. `cohostly snapshot` finds these values and the deploy supplies them to the build: see `cohostly-host/references/snapshot.md`, "Values the build needs". There is no separate example, because the fix is in the snapshot step and not in the app's code.

If you write the Dockerfile yourself, add a bare `ARG NAME` before the build step for each such value. Public values only: anything the build copies into browser code is visible to every visitor.

## When no example fits

1. Read `get_contract` for what the project's `platform` object can do.
2. Start from the closest example and keep its shape: the same file layout, the same SDK calls, the same handling of "not yet" answers.
3. Run `check_code` on the TypeScript before deploying (`SKILL.md`, "Checking your work").
4. Deploy with `cohostly-host`. Do not change visibility, secrets or other settings the person did not ask for.

## These examples are tested against the SDK

`node packages/api/scripts/verify-skill-examples.mjs [example ...]` (from the repo root, needs the network) generates each example's `platform.gen.ts` with the SDK's own `platform types`, installs its dependencies, type-checks it, then runs it with the environment the platform gives an app and drives it with signed visitor contexts against a stand-in gateway. If you change an example, run it.
