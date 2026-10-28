---
title: Bring your own AI key
description: "Use models the platform does not pay for by saving your own provider key once for the whole account."
nav: Bring your own key
---

The platform pays for a small set of models. For everything else, such as the Claude models, you bring **your own key** from the company that makes the model. The provider bills you directly. Your app code does not change, and it still never holds the key.

Picture a restaurant that lets you bring your own wine. You hand the bottle to the staff once. They open it, pour it for your table, and never let it leave the building. Your key works the same way: you give it to the platform once, it is stored encrypted, and only the gateway uses it.

## How it works

- **One key per provider, per account.** Every project in the account shares it. Save an `anthropic` key once, and every app that lists a Claude model can use it.
- **The model decides the provider.** `claude-haiku-5-5` and `claude-sonnet-5-5` use your `anthropic` key. `gemini-3.8-flash` uses your `google-ai-studio` key.
- **The key is used only for its own provider.** It is never sent anywhere else.
- **The platform's own keys are never used for your models.** If your key is missing, the call fails. It does not quietly switch to a platform-paid model.
- **Your key is encrypted and never shown again.** The platform keeps a short hint (the first four and last four characters) so you can tell keys apart.

## Who can add a key

Only an account **owner or admin** can see, add, test or remove keys.

An **AI assistant cannot add a key.** The key would pass through the assistant. Ask the assistant to tell you the command, then run it yourself, or paste the key in the dashboard.

## Add a key

### In the dashboard

1. Open the app, then **Settings**, then **AI**.
2. Under **Your own keys**, find the provider. It shows "Needs a key" until one is saved.
3. Paste the key into the field and choose **Save key**.
4. Choose **Test the key** to ask the provider whether it accepts it.

The dashboard checks the start of the key before it saves, to catch a wrong paste: an OpenAI key starts with `sk-`, an Anthropic key with `sk-ant-`, and a Google key with `AIza`. Other providers are not checked.

The same page lists the models the platform provides ("Cohostly pays for these. Nothing to add.") and has a **Remove** button for each saved key. Removing a key stops every app in the account that uses that provider's models until a new key is added.

### On the command line

```sh
cohostly ai-keys set anthropic
```

You type the key at a hidden prompt, or pipe it in on standard input. It is never a command-line argument, so it does not land in your shell history. If you give no key, nothing changes.

The commands:

| Command | Description |
| --- | --- |
| `cohostly ai-keys list` | Shows the models the platform provides, the models that need your own key (with "key saved", "KEY REJECTED - replace it" or "no key yet"), your saved keys with a hint, a status and when each was last used, and the providers you can bring. |
| `cohostly ai-keys set <provider>` | Saves a key, or replaces the one saved. The key is tried once before it is kept. |
| `cohostly ai-keys check <provider>` | Asks the provider whether the saved key still works. |
| `cohostly ai-keys delete <provider>` | Removes the key. Projects that use that provider's models get `provider_key_needed` until another key is added. |

Add `--account <id>` to any of them to pick an account. Without it, the command uses your personal account, or your first account if you have none. See [secrets, tokens and AI keys](../cli/secrets.md).

> **Good to know** The command-line tool is installed as both `cohostly` and `platform`, and they are the same program. Some error messages from the platform say `platform ai-keys set <provider>`. Run it as `cohostly` if you prefer. Where a message says "dashboard > AI keys", it means **Settings, then AI** on the app.

## Which providers you can bring

Today you can bring a key for any provider that has models in the list:

| Provider | Description |
| --- | --- |
| `anthropic` | For `claude-haiku-5-5` and `claude-sonnet-5-5`. |
| `google-ai-studio` | For `gemini-3.8-flash`. Paste a key from Google AI Studio. |

`cohostly ai-keys list` ends with "Providers you can bring", which is the live answer. A provider with no models in the list is refused when you try to save a key, with a message naming the providers that do have models.

Some providers need more than a single key, so they cannot be brought yet:

- **Vertex AI** needs a service account, not an API key. Bring a Google AI Studio key for Gemini instead.
- **Workers AI** runs on the platform's own account and cannot be brought.
- **Amazon Bedrock** needs AWS credentials, not an API key.
- **Azure OpenAI** needs a resource address as well as a key.

## Use it in your app

Nothing special. List the model and call it the usual way.

```json title="cohostly.json"
{
  "bindings": {
    "ai": { "models": ["claude-haiku-5-5"], "monthly_cap_usd": 5 }
  }
}
```

```js title="Ask Claude" tab="js"
import platform from './platform.gen.js'

const reply = await platform.ai.messages({
  model: 'claude-haiku-5-5',
  messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
})
console.log(reply.text)
```

```py title="Ask Claude" tab="py"
import os
from openai import OpenAI

client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])

reply = client.chat.completions.create(
    model="claude-haiku-5-5",   # needs the account's anthropic key
    messages=[{"role": "user", "content": "Give me three names for a bakery."}],
)
print(reply.choices[0].message.content)
```

When you deploy, the platform warns you if a listed model uses your own key and none is saved, or if the saved key was rejected. Read the warning. Without a key, every call fails.

## What counts against which cap

| Spending | Description |
| --- | --- |
| Platform-paid models | The platform pays. Counted against the project cap and the account cap. |
| Your own keys | The provider bills you. The platform shows an estimate. They do not count against the account cap or the platform's daily limit. They count against `monthly_cap_usd` only if you wrote one, and with no `monthly_cap_usd` they have no cap at all. |

Because there is no default cap on your own keys, **write a `monthly_cap_usd`** when an app uses them. It is the only brake the platform has on that spending. Your provider's own limits and invoice are the final word. See [models and costs](ai-models-and-costs.md).

## When a key stops working

| What you see | Description |
| --- | --- |
| `provider_key_needed` | HTTP 403. No key is saved for that provider. Add one. |
| `provider_key_invalid` | HTTP 403. The saved key was rejected before. The platform makes no call while the key is marked rejected. Replace it. |
| `provider_key_rejected` | HTTP 502. The provider just rejected the key during a call. The key is marked rejected and the account's owner gets a notice, at most once a day for each provider. Replace it. |

To fix any of them, save a new key with `cohostly ai-keys set <provider>`, or paste it in **Settings, then AI**. A newly added key works at once. Run `cohostly ai-keys check <provider>` to confirm.

If the provider says the key is fine but there is a billing or quota problem, the key is still saved. The provider's message is shown so you can fix it on their side.

A key you try to save is refused if it has spaces, line breaks or control characters in it, or is shorter than 8 or longer than 4096 characters. Saving is limited to 10 attempts a minute.

## A note on provider terms

Each provider has its own terms for its keys, including where and how you may use them. They apply to your key, so read them. Some free-tier keys let the provider use your content, and some are not allowed in certain regions. That is the provider's rule, not a platform guarantee.

## Related

- [Models and costs](ai-models-and-costs.md): which models need which key.
- [Errors](ai-errors.md): every code, with its fix.
- [Account](../settings/account.md): what an account owns, and who can do what.
