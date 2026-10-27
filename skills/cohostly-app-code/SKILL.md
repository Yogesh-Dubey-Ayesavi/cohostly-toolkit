---
name: cohostly-app-code
description: Write or fix the code of an app that runs on Cohostly, or start a new one from a worked example. Use this whenever the code needs to know who is visiting (the signed-in person, a machine with an access key, or an anonymous visitor), read the visitor's name, time zone, country or device, add a sign-in link, read environment variables such as PORT, PLATFORM_APP_URL or PLATFORM_BINDINGS, use a secret the app was given, call the AI gateway, keep rows in the project's managed database (migrations and row policies), run something on a schedule instead of a timer, ask a person to approve an action, use a connection such as Google Sheets, or run the app on the person's own machine with `platform dev`. Also use it when someone asks how to build a kind of app on Cohostly (a notes app, a chatbot, a daily report, a form that writes to a sheet) so you start from the matching example in `assets/examples/`. Triggers on phrases like "use the visitor's name in my app", "call Claude from my cohostly app", "store data for each user", "run this every morning", "ask me before it deletes anything", "how does my app know who is logged in". Do NOT use this to deploy, share, change visibility or write manifest settings; that is `cohostly-host`.
---

# Writing app code for Cohostly

The app is ordinary code: a web server, a script or a static site, in Python, Node or Go. Cohostly runs it, and gives it three things: who is calling (the request context), the platform's services (through the `platform` object), and its settings (environment variables). Keep the app standard so it runs the same on a laptop.

## Start from what the app is told

Before writing anything that depends on the platform, check what the project receives. Use `get_contract` (what the `platform` object can do, and which values are allowed) and `describe_context` (which visitor fields the project gets). Those are the source of truth; this skill is the map.

## The three things the app gets

| What | How the app reads it | Reference |
| --- | --- | --- |
| **Who is calling** | Signed headers and a signed token on each request, verified with the SDK (or by hand in another language). Or `GET /__platform/me`. | `references/context.md`, `references/verify-token.md` |
| **Settings and addresses** | Environment variables set at start (`PORT`, `PLATFORM_APP_URL`, `PLATFORM_BINDINGS`, and so on). | `references/environment.md` |
| **Platform services** | The `platform` object, generated from the project's contract. | `references/bindings.md` |

## Rules that stop the common mistakes

- **Listen on the port the platform checks.** That is the manifest's `health.port`. Read `PORT` from the environment as a first choice, but `PORT` is in the roadmap's list of always-set variables and the code does not yet show it being injected, so confirm it on the first test deploy (`references/environment.md`). Hard-coding a port the health check does not use fails at the start stage.
- **Verify the context, do not just read headers.** The proxy sends `X-Platform-*` headers and a signed `X-Platform-Context` token. Use the SDK (`context`, `middleware`) to verify the token before you make a decision about who someone is. A header you have not verified is a claim.
- **Ask for only what you need.** Fields with consent (name, email, avatar) are missing when the person has not consented, and that absence is a normal state. Write the app so it works without them.
- **Treat a missing field as unknown**, never as a default value. An anonymous visitor has no `caller.name`; do not show "Guest" as if it were a name the person gave.
- **Never put a credential in code or config you commit.** Secrets come from the environment (`env.secrets` names them, the platform fills them). Provider keys never enter the app; the app talks to the platform's addresses with the binding token.
- **Use the platform's addresses, not the provider's.** For the AI gateway, set the stock client's base URL from `AI_BASE_URL` and let `AI_API_KEY` be the binding token. Do not call a model provider directly from the app.
- **Check the contract before relying on a call.** If `get_contract` does not list a call, do not write code that depends on it.
- **A connection that acts as the visitor (`access: "user"`) can fail with `connection_required`.** That means "not connected yet": send the visitor to `err.connectUrl`, do not show it as an error (`references/bindings.md`).

## Start from an example

Twelve small, complete apps are in `assets/examples/`: a greeting that reads the visitor, an AI chat API, a notes API on managed data, a scheduled report, an approval gate, a form that writes to a Google Sheet, role-gated pages, an app a program calls with a key, a visitor-acting calendar view, a single-page app with sign-in, and token verifiers for Python and Go. Pick the nearest one with `references/recipes.md`, then copy it with `scripts/scaffold.sh <example> <folder> [name]` and change it. Copying is faster and safer than writing the platform calls from memory, because each example already declares its bindings, handles the "not yet" answers and is safe where the platform can deliver twice.

## Local development

Run the app on the person's machine with the platform's addresses and the project's secrets, but nothing written to disk:

```bash
platform dev --project <name> -- <start command>
```

For an assistant running code itself, `request_dev_token` gives a token limited to that one project and the dev environment. Read `cohostly-host/references/secrets-and-tokens.md` before using one.

## Checking your work

1. Run `check_code` with the project's TypeScript files. It checks calls against the contract and names problems in plain words. Fix those before deploying.
2. Run the app locally with `platform dev`, call the route that uses the context, and confirm the output for a signed-in and an anonymous request.
3. Deploy with `cohostly-host`.

## References

Read only the one you need:

- `references/context.md`: the visitor fields, the headers, verifying the token, and the SDK functions.
- `references/environment.md`: every variable the platform sets, which ones are secret, and when they appear.
- `references/bindings.md`: the `platform` object, typed calls, `platform types`, the AI gateway and connections.
- `references/data.md`: managed data: migrations, row policies, `platform.data`, `$app`, limits.
- `references/approvals.md`: asking a person to approve an action, waiting for or receiving the answer.
- `references/cron.md`: scheduled jobs, in the manifest or in code, and why not a timer.
- `references/recipes.md`: which example to start from for which kind of app.
- `references/sign-in.md`: the platform's sign-in or the app's own, and the visibility each needs.
- `references/verify-token.md`: verifying the signed context in Python, Go or any language without the SDK.

The platform's lists (roles, visibility, limits, context fields) are data: `platform://reference/index`, or the `read_reference` tool. The worked examples are also served as `skill://cohostly-app-code/assets/examples/...`.
