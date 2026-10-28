---
title: AI
description: "Ask AI models from your app with no provider key in your code, and a monthly spending cap you control."
nav: AI
---

The AI binding lets your app ask a language model a question and get an answer back. Your app never holds a key from an AI company. It holds a pass that works only for your app, and a gateway run by the platform does the rest.

Think of a canteen with a prepaid meal card. You do not carry cash to the kitchen. You show the card at the counter, the counter checks what you may order and how much is left on the card, and the kitchen cooks. Here, the pass is your app's **binding token**, the counter is the **gateway**, and the card balance is your **monthly cap**.

## What the gateway does on every call

Each call goes through the same checks, in this order. The first one that fails stops the call, and nothing is spent.

1. **Is the pass real?** The binding token must be valid, and your project must have declared the `ai` binding.
2. **Is this model allowed?** The model must be on your `models` list.
3. **Is there a price?** A model with no price on file is refused, so the platform can never spend blind.
4. **Is the key there?** A model paid with your own key needs that key saved.
5. **Are you going too fast?** There are limits on calls per minute and on calls at the same time.
6. **Is there money left?** The platform sets aside the most the call could cost and checks it against your caps.
7. **Ask the model.** Then it counts the tokens the provider reports, works out the cost and adds it to your total.

The pages below go deeper on each part.

- [Models and costs](ai-models-and-costs.md): the models you can use, who pays for each, the caps, and how a cost is worked out.
- [Bring your own key](ai-bring-your-own-key.md): use models the platform does not pay for.
- [HTTP and streaming](ai-http-and-streaming.md): the three addresses, the headers, stock client libraries, and live word-by-word replies.
- [Errors](ai-errors.md): every error code and what to do about it.

## When to use it

Use the AI binding when your app needs to summarise, classify, draft, translate or chat. Use it whenever you would otherwise paste a provider key into your code. Do not call it from a visitor's browser: the token is a secret and belongs on your server. Your server calls the gateway, then sends the answer on to the browser.

## Turn it on

Declare `bindings.ai` in `cohostly.json`, then deploy.

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "bakery-namer",
  "runtime": { "entrypoint": "uvicorn main:app --host 0.0.0.0 --port 3000" },
  "health": { "port": 3000, "path": "/health" },
  "bindings": {
    "ai": {
      "models": ["gemini-3.5-flash-lite"],
      "monthly_cap_usd": 5
    }
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `models` | list of text | The models your app may call. Each is a plain model name such as `gemini-3.5-flash-lite`. A request for any other model is refused with `model_not_allowed`. Leave it out, or leave the list empty, to allow only the platform's default model. Only the first 20 names are read. |
| `monthly_cap_usd` | number | The most this project may spend in a calendar month (UTC), in US dollars. It must be greater than 0. Leave it out to start at $2.00. For models the platform pays for, it can never go above the account limit. See [models and costs](ai-models-and-costs.md). |

Declaring the binding also gives your app two settings:

| Variable | Description |
| --- | --- |
| `AI_BASE_URL` | The gateway's address for AI, ending in `/ai`. Not secret. |
| `AI_API_KEY` | Your app's binding token, not a provider key. Secret. Never print it or send it to a browser. |

Stock AI libraries read these two settings as their address and their key, which is why moving an existing chatbot over is often just those two lines. More on that in [HTTP and streaming](ai-http-and-streaming.md).

> **Good to know** `ai` is a reserved name. You cannot give a connection that name, and you cannot set `AI_BASE_URL` or `AI_API_KEY` yourself. See [environment variables](environment.md).

### What the default model really means

If you list no models, the allow-list is the platform's default model, which is `gemini-3.5-flash-lite`. Your app still has to **name it in every request**. A request that names no model is refused with `invalid_request`. "Default" decides what is allowed. It does not fill in a missing `model`.

### A typo is not caught until the call

When you deploy, the platform tells you if a listed model uses your own key and none is saved. It does not check that every name in `models` exists. A misspelled name only fails when a call is made, with `model_not_allowed` or `model_unpriced`. Copy names from `cohostly ai-keys list`, which prints the live list.

### The deploy summary

When you change `models` or `monthly_cap_usd`, the deploy summary says so in plain words, such as "AI spending limit $2 -> $5 a month". A raised cap, or a removed one, is marked as risky so nobody misses it.

## Make your first call

There are two ways. The typed call is the shortest. A stock client library is the best choice when you already have a chatbot, or need streaming, tools or the full chat format.

### The typed call

Generate the typed `platform` object once, and again whenever you change `cohostly.json` ([the platform object](../sdk/platform-object.md)).

```sh
cohostly types --project bakery-namer
```

```js title="ask.js"
import platform from './platform.gen.js'

const reply = await platform.ai.messages({
  model: 'gemini-3.5-flash-lite',          // must be in bindings.ai.models
  system: 'Be brief.',                      // optional
  messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
  max_tokens: 200,                          // optional
})

console.log(reply.text)                     // the answer, as plain text
console.log(reply.usage.input_tokens, reply.usage.output_tokens)
```

`platform.ai.messages` takes this and gives this back:

| Name | Type | Description |
| --- | --- | --- |
| `model` | text | Required. One of the names in `bindings.ai.models`. |
| `messages` | list | Required. Each item is `{ role, content }`. `role` is `"user"` or `"assistant"`, and `content` is plain text. |
| `system` | text | Optional. Instructions for how the model should behave. |
| `max_tokens` | whole number | Optional. At least 1. The most the answer may use. The platform lowers anything above 8192 and uses 4096 when you send none. |
| `text` | text | In the reply. The answer. |
| `usage` | object | In the reply. `{ input_tokens, output_tokens }`, the tokens counted for this call. |

The typed call always returns one finished answer. It cannot stream. For a live reply, use a stock client ([HTTP and streaming](ai-http-and-streaming.md)).

> **Good to know** List your models in `cohostly.json` when you use the typed call. The generated code narrows `model` to exactly your list, so the editor can catch a wrong name. With an empty list, the generated type falls back to two Claude names. Those models need your own key and are not in the default allow-list, so code that compiles would still be refused.

### When the typed call fails

It throws a `PlatformError` with the HTTP status, a stable `code`, a plain `message` and a `howToFix` sentence. Every code is on the [errors](ai-errors.md) page.

```js title="handle-errors.js"
import { PlatformError } from '@cohostly/sdk'

try {
  const reply = await platform.ai.messages({ model: 'gemini-3.5-flash-lite', messages })
  return reply.text
} catch (e) {
  if (e instanceof PlatformError) {
    // e.status, e.code, e.message, e.howToFix, e.requestId
    if (e.code === 'ai_budget_exhausted') return 'The AI budget for this month is used up.'
    return e.message
  }
  throw e
}
```

The typed call waits up to 30 seconds per attempt and does **not** retry on its own. A very long answer can run past 30 seconds. For those, use a stock client with streaming, or build your own object with a longer `timeoutMs` ([the platform object](../sdk/platform-object.md)).

### A stock client library

Point the official OpenAI library at the gateway. Nothing else changes.

```js title="Ask with a stock client" tab="js"
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
})

const reply = await client.chat.completions.create({
  model: 'gemini-3.5-flash-lite',            // must be in bindings.ai.models
  messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
})
console.log(reply.choices[0].message.content)
```

```py title="Ask with a stock client" tab="py"
import os
from openai import OpenAI

client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])

reply = client.chat.completions.create(
    model="gemini-3.5-flash-lite",   # must be in bindings.ai.models
    messages=[{"role": "user", "content": "Give me three names for a bakery."}],
)
print(reply.choices[0].message.content)
```

Do not hard-code a provider's own address. The gateway is the only door.

For Claude models, you can use Anthropic's library instead. Claude models are paid with your own key, so save one first ([bring your own key](ai-bring-your-own-key.md)). Streaming, tools, and a plain `curl` version are on [HTTP and streaming](ai-http-and-streaming.md).

## Who pays

- **Models the platform provides** are paid by the platform, up to your caps. The default is `gemini-3.5-flash-lite`.
- **Every other model** is paid with your account's own key from that model's provider. The provider bills you. The platform only estimates the cost.

Claude models are in the second group today. If you copy a Claude model name into a new account that has no Anthropic key saved, the first call fails with `provider_key_needed`. That is the expected first result, not a bug. [Bring your own key](ai-bring-your-own-key.md) shows the fix.

## Testing on your own computer

`cohostly dev` runs your app on your machine with the real binding settings ([develop](../cli/develop.md)). That means **local AI calls are real calls**. They use the same model list, the same limits, your saved keys and the same caps, and they are counted against the same project. There is no offline or pretend mode, so test with a small `max_tokens`.

## What is recorded

The platform records which model was asked, how many tokens, how long it took and what it cost. It does not store your prompts or the answers unless a project editor turns on a debug capture. A debug capture is off by default, lasts 1 to 24 hours, and is then deleted. It hides text that looks like a secret, but it does that by pattern only, so never rely on it to hide private data.

The platform never saves an answer to reuse for someone else, and it shares nothing between customers. The model provider handles the text you send under its own terms.

If your app passes the visitor's signed request context along with a call, the cost report can also show which visitors used the AI. The typed call does this for you. See [HTTP and streaming](ai-http-and-streaming.md) for stock clients.

## Gotchas

- **A Claude model name does not work out of the box.** It needs your own Anthropic key, or the call fails with `provider_key_needed`.
- **Name the model every time.** There is no automatic fill-in, even for the default model.
- **Names must match exactly.** `Gemini-3.5-Flash-Lite` is not `gemini-3.5-flash-lite`. A typo only shows up at call time.
- **A cap above the account limit does nothing for platform-paid models.** Writing `monthly_cap_usd: 50` still stops at the account limit ($10.00 for now).
- **A call can be refused a little before the cap is reached.** The platform sets aside the most the call could cost first. A small `max_tokens` leaves more room near the cap.
- **Your `max_tokens` is capped at 8192**, and is 4096 when you send none.
- **Streaming and thinking tokens cost money.** Tokens a model spends thinking are billed as answer tokens.
- **Do not retry a budget error.** `ai_budget_exhausted` stays until the month ends or you raise the cap. Retrying does not help. See [errors](ai-errors.md).
- **No more than 60 calls a minute and 4 at the same time** per project. Queue your work or slow down.
- **An AI assistant cannot add a provider key.** The key would pass through the assistant. A person adds it in the dashboard or with the command line.
- **Local runs cost real money** and count against the same caps.
- **Costs are estimates.** Use `cohostly cost` to see them, and your provider's own page for keys of your own.
- **The token is a secret.** Do not log it, return it to a browser or write it to a file.

## Read next

- [Models and costs](ai-models-and-costs.md): what each model costs, and every limit in one table.
- [Bring your own key](ai-bring-your-own-key.md): save, test and remove a provider key.
- [HTTP and streaming](ai-http-and-streaming.md): the raw calls, other client libraries and live replies.
- [Errors](ai-errors.md): every code and its fix.
- [An AI helper](../examples/ai-helper.md): a small app that uses this binding from start to finish.
