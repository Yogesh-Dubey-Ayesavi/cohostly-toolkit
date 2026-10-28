---
title: AI keys
description: "Save, check and delete your own AI provider keys with cohostly ai-keys, so every project in an account can use models the platform does not pay for."
nav: AI keys
---

The platform provides some AI models with no key from you. Other models are paid by your own account with a key from that model's provider. `cohostly ai-keys` manages those keys. Think of a shared petrol card kept in the office: one card, saved once, and every van in the fleet can use it.

A key belongs to the **account**. Every project in that account can use it. The models, prices and providers are described in [bring your own key](../bindings/ai-bring-your-own-key.md) and [models and costs](../bindings/ai-models-and-costs.md).

## Usage

```bash
cohostly ai-keys [list | set <provider> | check <provider> | delete <provider>] [--account <id>]
```

With no subcommand it runs `list`. There is no project argument and no `--json`.

| Flag | Type | Description |
| --- | --- | --- |
| `--account <id>` | text | Which account. Default: your personal account, otherwise the first account on your key. Applies to all four subcommands. |

Who may run it: an **account owner or admin**, for all four subcommands, `list` included. A key bound to an account counts as an admin.

## list

```bash
cohostly ai-keys list
```

Three blocks, then a hint.

```
Models the platform provides (no key needed):
  <model>                    (default) $<in>/<out> per million tokens (in/out)

Models that use your own key:
  <model>  <provider>  key saved | KEY REJECTED - replace it | no key yet

Saved keys:
  <provider>         <hint>  <status>, last used <time>   (or ", not used yet")

Providers you can bring: a, b. Add one with: platform ai-keys set <provider>
```

A model with no price checked yet is marked `- price not checked yet`. **A key is never printed.** The hint is only the first and last four characters. With no saved keys the block says `none`.

## set

```bash
cohostly ai-keys set anthropic
printf %s "$KEY" | cohostly ai-keys set anthropic
```

The key is typed at a **hidden prompt**, or read from a pipe. It is never an argument. A provider name is lower-case letters, digits and dashes, 2 to 40 characters.

The platform tries the key once with a cheap call, and the answer is printed:

| Result | Description |
| --- | --- |
| `Saved. <p> accepted the key. Every project in this account can now use <models> (list a model under bindings.ai.models in the project's manifest).` | It works. List the model in your settings file. |
| `Saved, but <p> answered: "<message>". Calls will fail until that is fixed at <p>.` | It was saved, but the provider is unhappy. Fix it with the provider. |
| `Saved. The key could not be tried just now, so it will be tried on its first use.` | The check could not run. Try `check` later. |

Refusals:

- `That does not look like an API key. Paste the key on its own, with no spaces or line breaks.`
- `No models from "<p>" are offered yet, so a key for it would not be used. Providers with models: ...`
- `<p> rejected this key (HTTP 401). Check that you copied the whole key and that it is for <p>.`
- A limit of 10 tries a minute (error 429).
- An AI assistant cannot set a key.

## check

```bash
cohostly ai-keys check anthropic
```

Tries the saved key again. Prints `The anthropic key works.`, or `<p> rejected the saved key. Replace it.`, or `The provider answered: <message>`. If none is saved: `No <p> key is saved for this account.`

## delete

```bash
cohostly ai-keys delete anthropic
```

Removes the key. It does not ask. It prints `Projects that use <p> models will get "needs your own <p> key" until another key is added.`

## Files read and written

None. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. Ctrl-C at the hidden prompt exits `130`. A network failure prints `Fatal: TypeError: fetch failed`.

## Exit codes

`0` on success, `1` on any failure, `130` for Ctrl-C at the prompt.

## Examples

Save a key, then confirm it works:

```bash
cohostly ai-keys set anthropic
cohostly ai-keys check anthropic
```

Work on a team account instead of your personal one:

```bash
cohostly ai-keys list --account 3f6c0b5e-7a21-4d0e-9b57-1c2d8a4f6e90
```

Replace a rejected key from a CI secret:

```bash
printf %s "$NEW_KEY" | cohostly ai-keys set anthropic
```

## Related pages

- [Bring your own key](../bindings/ai-bring-your-own-key.md): which provider covers which model.
- [Cost](cost.md): what AI use is estimated to cost.
- [Secrets](secrets.md): for values other than AI keys.
