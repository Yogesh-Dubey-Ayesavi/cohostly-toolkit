---
title: AI errors
description: "Every error the AI binding can return, what it means, whether to retry, and how to fix it."
nav: Errors
---

When the AI binding refuses a call, it says why in plain words and tells you what to do. Nothing is spent on a refused call. This page lists every error code, grouped by the kind of fix.

## What an error looks like

An error is a JSON body with a stable `code`, a `message` you can show, and a `how_to_fix` sentence.

```json title="403 model_not_allowed"
{
  "type": "error",
  "error": {
    "type": "model_not_allowed",
    "code": "model_not_allowed",
    "message": "This tool is not set up to use \"claude-sonnet-5-5\".",
    "how_to_fix": "Allowed models: claude-haiku-5-5. Add the model to bindings.ai.models in the manifest and deploy again."
  }
}
```

The same body works for both stock libraries. The OpenAI library reads `error.message`, `error.type` and `error.code`. The Anthropic library reads the top-level `type` and `error.type`. A few errors that happen before the AI part of the gateway, such as `invalid_token`, `binding_not_declared` and the gateway-wide `rate_limited`, have only `code`, `message` and `how_to_fix`. Always read `code`.

Every answer carries these headers:

| Header | Description |
| --- | --- |
| `x-request-id` | An id for this call. Quote it when you ask for help. The typed call puts it in `requestId`. |
| `x-ratelimit-limit` and `x-ratelimit-remaining` | The gateway-wide limit and what is left of it, per project. |
| `Retry-After` | On errors that can clear up: how many seconds to wait. |
| `x-platform-model` | On successful calls: the model that answered. |

## Catching errors in your code

```js title="Catch AI errors" tab="js"
import { PlatformError } from '@cohostly/sdk'

try {
  const reply = await platform.ai.messages({ model: 'gemini-3.5-flash-lite', messages })
  return reply.text
} catch (e) {
  if (!(e instanceof PlatformError)) throw e
  // e.status, e.code, e.message, e.howToFix, e.requestId
  if (e.code === 'ai_budget_exhausted') return 'The AI budget for this month is used up.'
  if (e.code === 'provider_key_needed') return 'This app needs an AI key. Ask the account owner.'
  return e.message
}
```

```py title="Catch AI errors" tab="py"
import os
from openai import OpenAI, APIStatusError

client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"], max_retries=0)

try:
    reply = client.chat.completions.create(
        model="gemini-3.5-flash-lite",
        messages=[{"role": "user", "content": "Hello"}],
    )
except APIStatusError as e:
    print(e.status_code, e.code, e.message)
```

With the typed call, the network failing gives a `PlatformError` with status 0 and code `network_error`. Running outside the platform with no token gives code `not_configured`. Run locally with `cohostly dev -- <command>` ([develop](../cli/develop.md)).

> **Good to know** Stock libraries retry some errors on their own. A refusal such as `ai_budget_exhausted` will not change by trying again, so consider turning their automatic retries off (`max_retries=0` or `maxRetries: 0`) and deciding yourself. The typed call never retries.

## Should I retry?

| Kind | Description |
| --- | --- |
| Never retry | `invalid_request`, `request_too_large`, `model_not_allowed`, `model_unpriced`, `wrong_endpoint`, `provider_rejected_request`, `provider_key_needed`, `provider_key_invalid`, `provider_key_rejected`, `ai_budget_exhausted`, `invalid_token`, `binding_not_declared`, `method_not_allowed`, `not_found`. The same request gets the same answer. Fix the cause. |
| Retry after the wait | `rate_limited`, `too_many_concurrent_calls`. Wait the `Retry-After` seconds. |
| Retry later | `ai_paused`, `ai_unavailable`, `ai_platform_ceiling`, `provider_unavailable`, `internal`. Wait, with growing pauses, and give up after a few tries. |

## Setup mistakes

These come from the request or the settings file. Fix them in your code or `cohostly.json`, and deploy.

| Code | Description |
| --- | --- |
| `invalid_token` | **HTTP 401.** No valid binding token was sent. Send it in `X-Platform-Binding-Token`. An app running on the platform gets the token as `AI_API_KEY` automatically. Check that you pass `AI_API_KEY` as the library's key. |
| `binding_not_declared` | **HTTP 403.** The project has not declared the `ai` binding. Add `ai` under `bindings` in `cohostly.json` and deploy. |
| `method_not_allowed` | **HTTP 405.** AI calls are POST requests with a JSON body. The reply has `Allow: POST`. |
| `not_found` | **HTTP 404.** There is nothing at that address. The AI addresses are `/ai/v1/messages`, `/ai/v1/chat/completions` and `/ai/messages`. Check that your base URL is `AI_BASE_URL` exactly. |
| `invalid_request` | **HTTP 400.** The body is not a JSON object, names no model, or has no messages. Send `content-type: application/json`, add a `"model"` and add a `"messages"` array with at least one message. |
| `request_too_large` | **HTTP 413.** The request is over 256 KiB. Send less text in one call. |
| `model_not_allowed` | **HTTP 403.** The model is not in `bindings.ai.models`. The message lists the models that are. Add the model and deploy again. Names must match exactly, so check spelling and case. |
| `model_unpriced` | **HTTP 400.** The platform has no price on file for this model, so it cannot offer it. Choose a model from `cohostly ai-keys list`. A name in your list that is not a real model can reach this error after it passes the allow-list. |
| `wrong_endpoint` | **HTTP 400.** You sent a model that is not from Anthropic to `/ai/v1/messages`. That address is for Anthropic's models only. Use `/chat/completions` for this model. |
| `provider_rejected_request` | **HTTP 400.** The model provider refused the request itself, for example a field it does not accept. The message is the provider's own short reason. Check your fields against the provider's documentation. It costs nothing and retrying will not help. |

## Keys

These apply to models paid with your own key. See [bring your own key](ai-bring-your-own-key.md).

| Code | Description |
| --- | --- |
| `provider_key_needed` | **HTTP 403.** The model is not paid for by the platform, and no key is saved for its provider. Nothing was sent. Save the key in **Settings, then AI**, or run `cohostly ai-keys set <provider>`. |
| `provider_key_invalid` | **HTTP 403.** The saved key was rejected before and is marked rejected. No call is made while it is. Replace it. |
| `provider_key_rejected` | **HTTP 502.** The provider rejected your key during this call. The key is now marked rejected and the account owner is told. Replace it. |

## Limits and spending

| Code | Description |
| --- | --- |
| `rate_limited` | **HTTP 429.** Two limits share this code, and the message says which. "This tool is asking the AI too fast" means more than 60 AI calls in a minute. "This project is calling the platform too fast" means more than 600 calls across all bindings in a minute. `Retry-After` says when to try again. Slow down. |
| `too_many_concurrent_calls` | **HTTP 429.** The project already has 4 AI calls running. `Retry-After` is 2 seconds. Wait for one to finish. |
| `ai_budget_exhausted` | **HTTP 429.** A spending cap is used up. The message says whether it is the project's ("This tool has used its AI budget for this month") or the account's. `Retry-After` is the time until the 1st of next month, 00:00 UTC. For the project, raise `bindings.ai.monthly_cap_usd` (up to the account limit) and deploy, or wait. For the account, the message says to ask the account owner to raise the account limit, or wait for next month. Lower `max_tokens` if you are only just short. |
| `ai_platform_ceiling` | **HTTP 503.** The platform has reached its daily AI limit for all customers. AI on platform-paid models resumes at midnight UTC. Calls on your own keys are not affected. |

See [models and costs](ai-models-and-costs.md) for how each cap is worked out.

## Something is down for a moment

| Code | Description |
| --- | --- |
| `ai_paused` | **HTTP 503.** The platform has paused AI for everyone for a short time. `Retry-After` is 60 seconds. Try again in a few minutes. |
| `ai_unavailable` | **HTTP 503.** The part that counts calls cannot be reached, so the platform stops calls to be safe. `Retry-After` is 5 seconds. Try again shortly. |
| `provider_unavailable` | **HTTP 502.** The model provider is not answering. The platform has already tried again with short pauses, up to 120 seconds per attempt. `Retry-After` is 5 seconds on the first form. Try again in a moment. |
| `internal` | **HTTP 500.** The binding hit a problem of its own. Try again in a moment, and quote the `x-request-id` if it keeps happening. |

`ai_not_configured` (HTTP 503, "AI is not set up on this platform yet") can only appear on a platform that has not connected a model provider. You should not see it on Cohostly.

## When it fails after the answer starts

When you ask for a live reply (streaming), the gateway has already answered `200` before the model finishes. If something goes wrong after that, the connection ends. No JSON error is sent after the first words. Treat a stream that stops early as an incomplete answer. See [HTTP and streaming](ai-http-and-streaming.md).

## Related

- [Models and costs](ai-models-and-costs.md): the caps and limits behind these errors.
- [Troubleshooting](../limits/troubleshooting.md): problems that are not AI-specific.
- [The platform object](../sdk/platform-object.md): `PlatformError` in full.
