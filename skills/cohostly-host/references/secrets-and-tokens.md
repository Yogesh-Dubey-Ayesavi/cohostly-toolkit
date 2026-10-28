# Secrets and tokens

Read this when an app needs a value it should not hold in code: an API key, a password, a database token. Also read it when the person asks about dev tokens or about rotating the app's token.

## The rule

A secret value goes from the person's keyboard into the platform's secret store. It does not pass through you, the chat, the manifest, the repo or a log. You only ever handle **names**.

Why this matters: anything you read is in the conversation history and may be logged. A value you have seen is a value that has leaked.

## Adding a secret the app needs

1. Make sure the manifest, or the code's needs, names it under `env.secrets` (names only, for example `STRIPE_KEY`). If it is not there yet, the deploy reply will say the project "needs a secret called X".
2. Call `list_secrets` to see what is set and what is missing.
3. Call `request_secret` with the name. You get a secure link that works once, for 15 minutes.
4. Give the person the link. Say: "Open this link while signed in and type the value there. I won't see it."
5. Call `list_secrets` again to confirm it is set. Never ask them to read the value back to you.

Do not offer to "just paste it here this once". That is the one thing this flow exists to prevent.

## Resolution

For each name in `env.secrets`, the project's own secret wins; otherwise the account's shared secret is used; nothing else. A missing secret never stops a deploy or a start. The app starts without it and the platform reports it as missing.

Delivery is `env`: the secret is in the app's environment. A paused app keeps its memory, so treat the value as sitting there too. The other delivery modes (`env-strict`, `inject`) are not built yet.

## Sharing a secret across the account

`share_secret` moves a project's secret to the account so the other projects can use the same name. Only an account owner or admin can do this. The value does not move in the chat; it stays in the store.

## Deleting a secret

`delete_secret` (or `platform secrets delete`) is refused while the live version still needs it. To delete, first deploy a version that no longer asks for it, or ask the person. Confirm before deleting.

## Dev tokens

A dev token lets code you run on the person's machine (or your environment) call the real platform services for one project, in the dev environment only.

- Only a person makes a token in the CLI or dashboard by default. An assistant working through MCP may call `request_dev_token` for one project. Its token is marked as the assistant's, is limited to that project and the dev environment, and carries a hint (first and last 4 characters).
- A token is shown once. Put it in the environment of the process that needs it. Do not write it to a file that could be committed, and do not paste it into the chat.
- Tokens stop working at their expiry. `list_tokens` shows the status. `revoke_token` ends one at once; use it when a laptop is lost.
- `request_dev_token` with the same `device` name replaces the earlier token.

## The app's own token

The running app holds one binding token (`PLATFORM_TOKEN`, also used as `AI_API_KEY`). It is the only credential a sandbox holds. Provider keys never enter the app.

If `describe_bindings` shows a misuse signal (the token used from an unexpected place), or the person suspects a leak:

1. `rotate_sandbox_token`. This restarts the app. The old token keeps working about 10 minutes so in-flight calls finish.
2. Tell the person the app restarted and why.
3. Check `describe_bindings` again.

Do this only with the person's agreement, because it restarts their app.

## Things to refuse

- Showing any existing token or secret value, even a hint of a secret. Hints are only for tokens, and only first and last 4 characters.
- Writing a key into a manifest, a `.env` file that is committed, a test fixture, or example code. Use `<value>` or `plk_...` as placeholders.
