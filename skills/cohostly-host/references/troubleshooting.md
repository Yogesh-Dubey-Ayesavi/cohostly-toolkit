# Troubleshooting

Read this when a deploy fails, the app does not open, or a person says "it's broken". Always start from the platform's own words, then translate them.

## Read the failure

A failed deploy reply has these parts (MCP and CLI both):

- **What failed:** the error line, for example "Deploy failed".
- **Which stage:** `uploading`, `building`, `starting` or `live`. "It stopped while: building" tells you the code is the likely cause; "starting" points at the start command or the port.
- **Cause and fix:** plain sentences from the classifier, for example a missing dependency, a wrong Python or Node version, no start command, or a port not read from the environment.
- **Log tail:** the last lines of the log when the classifier does not know the cause.

Report the cause and fix first. Quote the log only if the cause is unclear.

## Common causes

| Stage | What it usually means | What to do |
| --- | --- | --- |
| uploading | The archive is too big, or was not sent | Pack without `node_modules` and `.venv`. For big archives use `get_upload_url`. |
| building | A dependency is missing from the lock or requirements file, or the language version is unsupported | Ask the person to fix the dependency file; do not edit their code without asking. |
| starting | No start command was found, or the app did not listen on the port it was given | The app must listen on the port the health check uses (`health.port` in the manifest). Add or fix the start command in the manifest's `runtime.entrypoint`. Reading `PORT` from the environment is the usual approach; see `cohostly-app-code/references/environment.md`. |
| live, but the page is an error | The app crashed on the first request | Check the code path that serves `/`. There are no logs tool yet, so run the app locally with `platform dev` or `start_dev_session` to see the error. |

## The app opens for the owner but not for others

Check visibility before anything else. `describe_project` shows it. A "not found" for an outsider usually means the project is `private` (or `account`) and they have no access, not that the app is down. Share with them, or set visibility, after asking the person.

## "Needs a secret called X"

The deploy worked; the app starts without the value. Follow `secrets-and-tokens.md`: `request_secret`, then the link.

## "Name is already taken"

Someone else owns that project name. Names are global. Propose another name and ask the person before deploying under it.

## confirm_token rejected or expired

Tokens expire (`expires_in_s` in the draft reply). Call `deploy` again with the same code to get a new draft, then confirm.

## Redeploy asks for confirmation again

The new code changed something that the saved settings depend on. That is intended. Show the draft and what changed; do not force it with `skip_confirmation` unless the person said so.

## "The platform's context for this request could not be verified" (401)

The app's SDK `middleware()` got a context token and could not verify it. The reason is in the app's log (`get_logs`), on a line starting `[platform] context not verified:`.

- `the token is for a different app`: the app checked the token against the wrong host. A project deployed before the proxy sent `X-Forwarded-Host` needs a redeploy; an app that sets `audience` by hand must use its public address.
- `the platform's public keys could not be fetched`: the app cannot reach `PLATFORM_AUTH_URL`. Check the manifest's `network` rules allow it.
- `the token has expired`: the app's clock is wrong, or the request was replayed.

## Rolling back

If the new version broke things and the person wants it undone now: `rollback`. It makes the previous ready version live. Then `list_versions` to confirm which one is live, and tell the person which version it is.

## Still stuck

Say what you checked and what the platform said, in that order, and ask the person for the one thing you cannot see (a screen, a log they ran locally, the error from their own browser). Do not guess a fix and deploy it.

## Things the platform cannot do yet

Say these plainly rather than working around them:

- Send approval emails (approvals show in the dashboard and through `list_approvals`; no email goes out yet).
- Connect Slack (Google and Microsoft work; Slack is not set up yet).
- Costs and AI spend figures (not measured yet).
