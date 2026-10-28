---
title: AI models and costs
description: "Which models you can use, who pays for each, what a call costs, and every cap and limit in one place."
nav: Models and costs
---

This page answers four questions. Which models can my app use? Who pays for them? What will a call cost? What stops a runaway bill?

The short version: the platform pays for a few models and puts a spending cap on them. For every other model, you bring your own key and the provider bills you. Either way, the platform counts every call and shows you an estimate.

## The models

Prices are in US dollars per **million tokens**. A token is a small piece of text, roughly three to four letters. A short question is a few dozen tokens. A page of text is about a thousand.

This is the list at the time of writing. The list and the prices are data that can change, so check the live list with `cohostly ai-keys list` and the prices in use with `cohostly cost --terms`.

| Model | Description |
| --- | --- |
| `gemini-3.5-flash-lite` | **Platform pays. This is the default.** $0.33 in, $2.75 out, $0.033 for cached input. |
| `gemini-3.1-flash-lite` | Platform pays. $0.275 in, $1.65 out, $0.0275 for cached input. |
| `gemini-2.5-flash` | Platform pays. $0.30 in, $2.50 out, $0.03 for cached input. |
| `claude-haiku-5-5` | **Your own `anthropic` key.** $0.10 in, $0.50 out, $0.01 for cached input. A prompt over 100,000 tokens costs more: $0.50 in, $2.50 out and $0.05 cached, for the whole request. |
| `claude-sonnet-5-5` | **Your own `anthropic` key.** $2.00 in, $10.00 out, $0.10 for cached input. |
| `gemini-3.8-flash` | **Your own `google-ai-studio` key** (a Google AI Studio key). $0.75 in, $3.75 out, $0.075 cached until 2026-12-31. From 2027-01-01: $1.50 in, $7.50 out, $0.15 cached. |

"In" is the text you send. "Out" is the text the model writes. "Cached input" is text the provider has already seen recently and charges less for.

Use the model name from the left column in `bindings.ai.models` and in every request. Names are matched exactly.

### Which model should I pick?

- **Start with `gemini-3.5-flash-lite`.** It needs no key, so it works on the first deploy.
- **Reach for a Claude model when quality matters more than cost.** Save your Anthropic key first ([bring your own key](ai-bring-your-own-key.md)).
- **Keep the list short.** Only list the models your code really calls. A shorter list is a smaller blast radius if a bug asks for the wrong thing.

### Seeing the live list

```sh
cohostly ai-keys list
```

This prints the models the platform provides (with the default marked, and the price per million tokens in and out), the models that use your own key and whether a key is saved for each, and the providers you can bring. It never shows a key.

## How a call is priced

For every call the provider reports how many tokens it used. The platform never takes the number from your app. The cost is:

- input tokens times the input price,
- plus output tokens times the output price,
- plus cached tokens times the cached price,
- plus any tokens written into the provider's cache, at the cache-write price (when none is listed, 1.25 times the input price),
- divided by one million, and rounded **up** to the next whole millionth of a dollar.

Some details that surprise people:

- **Thinking tokens are output.** A model that thinks before it answers is charged for the thinking at the output price, whether you stream or not.
- **The price in force when the call started is the price used.** A later price change never re-prices an old call.
- **Failed and cancelled calls.** A call the provider could not answer costs nothing. If you close a stream early, the call is priced from the tokens the provider had already reported, or from an estimate when it had reported none.
- **Only text calls are priced.** Audio, image and video work, batch or priority modes, and web grounding are not priced, so the platform cannot estimate them.
- **Platform-paid prices may be up to about 10 percent high.** The platform records the higher of the provider's prices, so an estimate is never too low.
- **Claude 1-hour cache writes** are counted at the 5-minute rate, so they are slightly under-estimated.

> **Good to know** Every figure is an **estimate**. For platform-paid models, the platform pays the real bill. For your own keys, the provider bills you, and its invoice is the truth.

## Caps and limits

There are two kinds of limit. **Spending caps** stop money. **Rate limits** stop a program that is going too fast.

### Spending caps

| Cap | Description |
| --- | --- |
| Per project, per month | $2.00 to start. Raise it with `monthly_cap_usd` in `cohostly.json`, up to the account limit. Applies to models the platform pays for. |
| Per account, per month | $10.00. Adds up every project in the account, for models the platform pays for. For now this is not something you change in `cohostly.json`. |
| Platform-wide, per day | A shared daily limit across all customers, for models the platform pays for. When it is reached, AI is paused until midnight UTC and the error is `ai_platform_ceiling`. |
| Your own keys | No account cap and no platform cap. If you wrote `monthly_cap_usd`, it applies to your own-key spending too, and it is the only cap that does. Without one, there is no cap. |

How the project cap is worked out for a platform-paid model: it is the smaller of your `monthly_cap_usd` (or $2.00 if you wrote none) and the account limit. A `monthly_cap_usd` of 50 therefore means 10 for now.

Caps reset on the **1st of each month at 00:00 UTC**. That is a calendar month, not your billing period.

### What "reached" means

Before each call, the platform sets aside the most it could cost: the input, plus `max_tokens` priced as output. If that amount would push the total over the cap, the call is refused with `ai_budget_exhausted`, even though a smaller call would have fit. After the call, the real cost replaces the reservation.

So when you are close to a cap, a smaller `max_tokens` lets small calls through.

### Warnings

At 80 percent of a project or account cap, and again at 100 percent, the platform leaves one notice per month. At 100 percent, it says AI calls are stopped until next month unless you raise the limit. Notices show up in `cohostly cost` and on the project's Cost card in the dashboard. Calls on your own keys add "(on your own keys)" to the notice.

### Rate limits and sizes

| Limit | Description |
| --- | --- |
| AI calls per minute | 60 per project, for every model. A fixed one-minute window, so a burst across a minute boundary can briefly reach about twice that. Over it: `rate_limited`. |
| AI calls at the same time | 4 per project. Over it: `too_many_concurrent_calls`. |
| All bindings together | 600 calls per minute per project, across AI, data, connections and the rest. Over it: `rate_limited` with a different message. |
| Request size | 256 KiB of JSON. Over it: `request_too_large`. |
| `max_tokens` ceiling | 8192. A larger number is lowered to 8192. |
| `max_tokens` when you send none | 4096. |
| Models in `bindings.ai.models` | The first 20 names are read. |
| Time for the provider to answer | 120 seconds per attempt. The gateway tries again up to 2 more times when the provider is unavailable. |

The `max_tokens` rule applies to `max_completion_tokens` too, when a request uses that name instead.

## Seeing what you have spent

```sh
cohostly cost --project my-app
```

It prints, in plain sentences:

- the month so far and the pace of the last 7 days,
- a "what if 50 people used it" projection,
- the AI budget: how much of the cap is spent, and whether it is close (80 percent) or stopped,
- your own-key spending, on its own line, as "about $X this month so far (an estimate; your providers bill you for it, not the platform)",
- notices,
- who used the AI in the last 7 days (up to 10), when your app passes the visitor's context along.

Add `--terms` for the prices used and the meaning of each word, or `--json` for a machine-readable version. Anyone who can view the project can read its cost. See [develop](../cli/develop.md).

The same facts are on the project's Cost card in the dashboard.

## Staying under a cap

- **Set `max_tokens` on every call.** A short answer should not be able to run long.
- **Use the cheapest model that does the job.**
- **Keep prompts small.** You pay for every token you send, and some models charge more for very long prompts.
- **Do not retry a refused call.** A budget refusal is not a glitch.
- **Raise the cap on purpose.** To give one project more room, raise `monthly_cap_usd` and deploy again. Raising it is flagged in the deploy summary. For platform-paid models it can never go above the account limit.

## Related

- [Bring your own key](ai-bring-your-own-key.md): models the platform does not pay for.
- [Errors](ai-errors.md): `ai_budget_exhausted`, `rate_limited` and the rest.
- [Limits](../limits/limits.md): the numbers for every part of the platform.
