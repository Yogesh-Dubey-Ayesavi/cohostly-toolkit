---
title: Dev tokens
description: "cohostly token makes, lists and revokes dev tokens: short-lived passes that let code on your computer reach one project's services."
nav: Dev tokens
---

A **dev token** is a short-lived pass. It lets code running on your own computer call the real services of one project, in the **dev environment only**. Think of a day pass for a gym: it works for one visitor, in one building, until tonight.

You rarely need to make one yourself. [`cohostly dev`](develop.md) makes one for you and removes it when your command ends. Use `cohostly token` when you want to manage them by hand.

## What a dev token is

- Tied to **you** (the person behind the key), to **one project** and to a **device**.
- Lasts **12 hours**, then stops working.
- Reaches only the dev environment.
- At most **10** live tokens per person per project. Making one for the same device ends the earlier one.

## Usage

```bash
cohostly token create --dev --project <name> [--device <label>]
cohostly token list --project <name>
cohostly token revoke <id> --project <name>
```

`--project` is required.

| Flag | Type | Description |
| --- | --- | --- |
| `--dev` | on or off | **Required** for `create`. Only dev tokens can be made here. Without it: `Only dev tokens can be made here. Use: platform token create --dev --project <name>`. |
| `--device <label>` | text | A label for the token's device. Default: your computer's host name. |
| `--project <name>` | text | The project. Required. |

Who may run it: an **editor**, and the person behind your key must themselves be an editor. Otherwise:

- `The person this key belongs to can only view this project, so it cannot make dev tokens. Ask a project admin for editor access.`
- `A dev token belongs to a person. Sign in with "platform login" as yourself; keys with nobody behind it and the operator key cannot make one.`

## create

```
$ cohostly token create --dev --project shop
Dev token for shop (shown once, valid until 11:42 PM). Keep it out of git.
export AI_BASE_URL=...
export DATA_URL=...
export PLATFORM_TOKEN=...

Or skip all this and run: platform dev --project shop -- <command>
```

You see the token **once**. The `export` lines are the platform's service addresses and the token, for the services the live version declares. Do not commit them.

## list

One line per token: `<id>  <status>  <hint>  <email or person id>  <device>  until <time>[  last used <time>]`. Tokens made by an assistant are marked `assistant:`. With none: `No dev tokens.` Admins see everyone's tokens on the project. Everyone else sees their own.

## revoke

```bash
cohostly token revoke <id> --project shop
```

Prints `That dev token no longer works.` If the id does not exist or you cannot end it: `There is no such dev token on this project that you can end.` Revoke at once if a laptop is lost.

## Files read and written

None. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. A network failure prints `Fatal: TypeError: fetch failed`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

Make a token for a script, labelled by machine:

```bash
cohostly token create --dev --project shop --device build-laptop
```

Find a token and end it:

```bash
cohostly token list --project shop
cohostly token revoke <id> --project shop
```

## Related pages

- [Build and test locally](develop.md): `cohostly dev` handles tokens for you.
- [Secrets](secrets.md): values your app reads at run time.
- [Sign in and keys](login-and-keys.md): why a CLI key is different from a signed-in person.
