---
title: AI over HTTP, and streaming
description: "The three AI addresses, how to send the token, how to use stock client libraries, and how to stream a reply word by word."
nav: HTTP and streaming
---

You do not need the typed `platform` object to use the AI binding. The gateway speaks plain HTTP, and two popular client libraries work with it unchanged. This page is for apps in any language, apps that already use one of those libraries, and anyone who wants a live reply.

## The three addresses

Every address takes a `POST` with a JSON body. `AI_BASE_URL` already ends in `/ai`, so add the rest to it.

| Address | Description |
| --- | --- |
| `/ai/messages` | **The simple call.** Send a model and a list of messages, get back `{ text, usage }`. Works with every model. It never streams. This is what `platform.ai.messages` calls. |
| `/ai/v1/chat/completions` (also `/ai/chat/completions`) | **The chat format** most AI libraries speak. Works with every model. Streams when you send `stream: true`. |
| `/ai/v1/messages` | **Anthropic's own message format**, passed straight through, including tools, prompt caching and thinking. Anthropic models only. Streams when you send `stream: true`. Any other model gets `wrong_endpoint`. |

`GET /ai/openapi.json` returns a machine-readable description of the binding, for generating a client in another language ([other languages](../sdk/other-languages.md)). It needs the token like any other call. Any other address answers `not_found`, and any method other than POST on a call address answers `method_not_allowed`.

## Sending the token

Your binding token is in `AI_API_KEY`. The gateway accepts it in any one of these headers:

| Header | Description |
| --- | --- |
| `X-Platform-Binding-Token: <token>` | What the typed `platform` object sends. Use it for hand-written calls. |
| `Authorization: Bearer <token>` | What the OpenAI library sends as its key. |
| `x-api-key: <token>` | What the Anthropic library sends as its key. |

It is checked in that order. The gateway uses only the token to know who you are. It removes these headers, and every `X-Platform-` header, before the request goes any further, so the token never reaches the provider.

## The simple call by hand

```js title="Simple call" tab="js"
const res = await fetch(`${process.env.AI_BASE_URL}/messages`, {
  method: 'POST',
  headers: {
    'X-Platform-Binding-Token': process.env.AI_API_KEY,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gemini-3.5-flash-lite',
    system: 'Be brief.',
    messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
    max_tokens: 200,
  }),
})
const body = await res.json()
if (!res.ok) throw new Error(`${body.error.code}: ${body.error.how_to_fix}`)
console.log(body.text, body.usage)   // usage is { input_tokens, output_tokens }
```

```py title="Simple call" tab="py"
import json, os, urllib.error, urllib.request

req = urllib.request.Request(
    os.environ["AI_BASE_URL"] + "/messages",
    data=json.dumps({
        "model": "gemini-3.5-flash-lite",
        "system": "Be brief.",
        "messages": [{"role": "user", "content": "Give me three names for a bakery."}],
        "max_tokens": 200,
    }).encode(),
    headers={
        "X-Platform-Binding-Token": os.environ["AI_API_KEY"],
        "content-type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req) as res:
        body = json.load(res)
    print(body["text"], body["usage"])
except urllib.error.HTTPError as e:
    err = json.load(e)["error"]
    print(e.code, err["code"], err["how_to_fix"])
```

```sh title="Simple call" tab="sh"
curl "$AI_BASE_URL/messages" \
  -H "X-Platform-Binding-Token: $AI_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"gemini-3.5-flash-lite","messages":[{"role":"user","content":"Hi"}]}'
```

The answer looks like this. The header `x-platform-model` also names the model that answered.

```json title="200 reply"
{ "text": "...", "usage": { "input_tokens": 18, "output_tokens": 24 } }
```

How the simple call reads your request: `messages` items have a `role` of `user` or `assistant` and a text `content`. `system` is turned into the system instruction for you, whichever model you use. A `stream` field is ignored here, and you always get one finished reply.

## The chat format, with the OpenAI library

Set the library's base URL to `AI_BASE_URL` and its key to `AI_API_KEY`. The library adds `/chat/completions` itself.

```js title="OpenAI library" tab="js"
import OpenAI from 'openai'

const client = new OpenAI({ baseURL: process.env.AI_BASE_URL, apiKey: process.env.AI_API_KEY })

const reply = await client.chat.completions.create({
  model: 'gemini-3.5-flash-lite',
  messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
  max_tokens: 200,
})
console.log(reply.choices[0].message.content)
```

```py title="OpenAI library" tab="py"
import os
from openai import OpenAI

client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])

reply = client.chat.completions.create(
    model="gemini-3.5-flash-lite",
    messages=[{"role": "user", "content": "Give me three names for a bakery."}],
    max_tokens=200,
)
print(reply.choices[0].message.content)
```

```sh title="OpenAI library" tab="sh"
curl "$AI_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $AI_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"gemini-3.5-flash-lite","messages":[{"role":"user","content":"Hi"}]}'
```

The gateway needs a non-empty `model` and a non-empty `messages` list. Everything else in the body goes through to the provider as you wrote it, with a few exceptions listed under "What the gateway changes" below. The reply is the provider's own, plus the `x-platform-model` header.

## Anthropic's format, with the Anthropic library

For Claude models you can use Anthropic's library. It posts to `/v1/messages` under your base URL, which is an address the gateway serves. Claude models are paid with your own key, so [save one first](ai-bring-your-own-key.md).

```js title="Anthropic library" tab="js"
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
  maxRetries: 0,
})

const reply = await client.messages.create({
  model: 'claude-haiku-5-5',
  max_tokens: 300,
  messages: [{ role: 'user', content: 'Give me three names for a bakery.' }],
})
console.log(reply.content[0].text)
```

```py title="Anthropic library" tab="py"
import os
from anthropic import Anthropic

client = Anthropic(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])

reply = client.messages.create(
    model="claude-haiku-5-5",
    max_tokens=300,
    messages=[{"role": "user", "content": "Give me three names for a bakery."}],
)
print(reply.content[0].text)
```

```sh title="Anthropic library" tab="sh"
curl "$AI_BASE_URL/v1/messages" \
  -H "x-api-key: $AI_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-5-5","max_tokens":300,"messages":[{"role":"user","content":"Hi"}]}'
```

Tools, prompt caching and thinking are passed straight through on this address, in the form Anthropic defines. Of the headers a client sends, only `anthropic-beta` is passed on (letters, numbers, dots, commas and dashes, up to 200 characters). The `anthropic-version` is fixed by the gateway.

The gateway does **not** convert between formats. A tool call written for Anthropic does not work on the chat address, and the other way round. What the chat address accepts is whatever the model's provider accepts in that format.

## Other libraries

Only the official OpenAI and Anthropic libraries are tested against the gateway. Any other library that lets you set a base URL and a key will probably work through the chat format, but that is not tested here. If something odd happens, try the official library, or the simple call, to find out which side is at fault.

## What the gateway changes

Almost nothing is changed. These are the exceptions:

- **`max_tokens`** (or `max_completion_tokens`, if that is the name you used) is lowered to 8192 when it is higher, and set to 4096 when you send none.
- **Streaming usage.** When you stream on the chat address, the gateway asks the provider for the final usage figures so it can count the call. If you did not ask for them yourself, that last usage-only chunk is removed before you see the stream.
- **Model name.** The model name you send is the public name from [models and costs](ai-models-and-costs.md). The gateway maps it for the provider.

## Streaming

Streaming sends the reply in small pieces as the model writes it, so a person sees words appear instead of waiting for the whole answer. It is like watching a letter being typed rather than waiting for the post.

Streaming works on `/ai/v1/chat/completions` and `/ai/v1/messages`. Send `stream: true`.

```js title="Stream a reply" tab="js"
import OpenAI from 'openai'

const client = new OpenAI({ baseURL: process.env.AI_BASE_URL, apiKey: process.env.AI_API_KEY })

const stream = await client.chat.completions.create({
  model: 'gemini-3.5-flash-lite',
  messages: [{ role: 'user', content: 'Tell me a short story about a kite.' }],
  max_tokens: 500,
  stream: true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
```

```py title="Stream a reply" tab="py"
import os
from openai import OpenAI

client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])

stream = client.chat.completions.create(
    model="gemini-3.5-flash-lite",
    messages=[{"role": "user", "content": "Tell me a short story about a kite."}],
    max_tokens=500,
    stream=True,
)

for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

What to expect on the wire:

- The answer is `200` with `content-type: text/event-stream`, `cache-control: no-store` and `x-platform-model`. The events are passed on unchanged.
- The platform reads the token counts from the provider's events as they pass by. Thinking tokens are counted as output.
- On the chat address, `data: [DONE]` is written only after the call has been counted.
- **If your app drops the connection, the call is cancelled.** The model stops, and you are charged only for the tokens the provider had reported by then, or for an estimate.
- Streaming and thinking tokens count against your caps like any other tokens.

The typed `platform.ai.messages` call cannot stream. Use a stock client, as above.

### If a stream breaks

Once a stream has started, the `200` has already been sent, so an error cannot change the status. If something goes wrong in the middle, the connection simply ends, and no JSON error is sent. Treat a stream that stops without finishing as an incomplete answer, and offer to try again. Errors found before the first word, such as a missing key or a reached cap, still arrive as normal errors with a status code ([errors](ai-errors.md)).

## Telling the platform who asked

If your app is handling a visitor's request, it can pass that visitor's signed context along by adding it as the `X-Platform-Context` header on the AI call. The platform then lists the visitor in the cost report, under "Who used the AI". The typed call adds the header for you.

This is only for reporting. A missing or invalid context never blocks a call. See [request context](../sdk/request-context.md).

## Related

- [AI](ai.md): the overview, with the typed call.
- [Errors](ai-errors.md): what each failure means.
- [Models and costs](ai-models-and-costs.md): limits on size, speed and spend.
- [Python, Go and other languages](../sdk/other-languages.md): the rest of the bindings by hand.
