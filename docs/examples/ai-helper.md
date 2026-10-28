---
title: An AI helper
nav: AI helper
description: A small Python app that answers a question with an AI model, with no provider key to keep safe.
---

## What you will build

A tiny helper with one job: you send it a question, it sends back an answer written by an AI model. The usual hard part of this is looking after a secret key from the AI company. Here there is none. Cohostly sits in the middle, holds the real key, and gives your app a pass that only works for your app.

It is written in Python, but nothing in it is Python-only. The same idea works in any language that has a client for the OpenAI-style protocol.

## What you need

- Python 3.9 to 3.13, and the command line (`npm install -g cohostly`, which needs Node 20 or later).
- Three files in a new folder.
- A model that does not need your own key, or your own key saved once for the model you choose. See "If something goes wrong".

## The files

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "ai-chat-fastapi",
  "runtime": { "entrypoint": "uvicorn main:app --host 0.0.0.0 --port 3000" },
  "health": { "port": 3000, "path": "/health" },
  "bindings": { "ai": { "models": ["claude-haiku-5-5"], "monthly_cap_usd": 5 } }
}
```

```py title="main.py"
import os

from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel

app = FastAPI()

# The platform's gateway speaks the stock OpenAI client's protocol. AI_API_KEY is a binding token, not a provider key,
# and the app never holds the provider's own key.
client = OpenAI(base_url=os.environ["AI_BASE_URL"], api_key=os.environ["AI_API_KEY"])


class Ask(BaseModel):
    question: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ask")
def ask(body: Ask):
    try:
        reply = client.chat.completions.create(
            model="claude-haiku-5-5",  # must be in bindings.ai.models
            messages=[{"role": "user", "content": body.question}],
        )
    except Exception as e:  # a cap reached or a model not allowed comes back as a plain message: show it, do not retry in a loop
        raise HTTPException(status_code=502, detail=str(e))
    return {"answer": reply.choices[0].message.content}
```

```text title="requirements.txt"
fastapi>=0.110
uvicorn>=0.29
openai>=1.30
```

## What each part does

**`cohostly.json`**

- `runtime.entrypoint` is the command that starts the app. `uvicorn main:app` runs the `app` found in `main.py`. `--host 0.0.0.0` means "accept visitors from anywhere", which the platform needs. `--port 3000` is the numbered door.
- `health` tells the platform where to knock after a deploy to see that the app is awake: port 3000, path `/health`.
- `bindings.ai` asks for the AI service. `models` is the list of models the app is allowed to use. `monthly_cap_usd` is a monthly spending limit in US dollars. Asking for a model that is not on the list fails with a plain message. The fix is to change the list, not to switch to a different model in the code.

**`main.py`**

- `OpenAI(base_url=..., api_key=...)` makes an ordinary AI client. The platform puts the gateway's address in `AI_BASE_URL` and a pass in `AI_API_KEY` when the app starts. The pass is not the AI company's key. It only works for this app, through the gateway. The app never sees the real key.
- `/health` answers "ok" so the platform knows the app started.
- `/ask` takes a question, asks the model, and returns the answer. If the call fails, for example because the monthly cap is reached, the message is passed on instead of being retried in a loop.

> **Good to know** Some models are provided by the platform and need no key from you. Others are billed to your own account with the AI company, and you save that key once with `cohostly ai-keys set <provider>`. You type it at a hidden prompt and it is never shown again. Costs are not fully measured yet, so any figure the platform shows is an estimate.

## Put it online

```sh
cohostly login
cohostly deploy --project ai-chat-fastapi
```

Then ask it a question. Replace `APP_URL` with the address `deploy` printed. If the app is private, open it from a browser where you are signed in, or share it first (see [Sharing](../cli/sharing.md)).

```sh
curl -X POST "$APP_URL/ask" -H 'content-type: application/json' -d '{"question":"hello"}'
```

You can also try it on your computer, with the platform's addresses, using `cohostly dev --project ai-chat-fastapi -- uvicorn main:app --port 3000`.

## Try it

You should get back a short piece of JSON with the model's reply:

```json
{ "answer": "Hello! How can I help you today?" }
```

The exact words will differ. Run `cohostly cost --project ai-chat-fastapi` to see an estimate of what the questions cost, in plain sentences.

## Make it yours

1. Change the question into a job. Instead of passing the question straight through, wrap it: `"Summarise this in two sentences: " + body.question`.
2. Allow a second model. Add it to `models` in `cohostly.json`, deploy, and choose between them in the code.
3. Lower the monthly limit while you test: set `monthly_cap_usd` to `1`.

## If something goes wrong

- **A 502 with a message about the model.** The model in the code is not in `bindings.ai.models`. Add it to `cohostly.json` and deploy again, or use one that is listed.
- **A message saying a key is needed.** The model you chose is not one the platform provides, so it needs your own key from that provider. Run `cohostly ai-keys set <provider>` once. `cohostly ai-keys list` shows which are saved, and never the keys themselves.
- **A message saying the cap is reached.** The monthly limit is used up. Raising it needs an owner or admin to approve it, so the limit stays as it is until they do.
- **The app fails to start.** Check that `--port` in the entrypoint matches `health.port`, and that you used `--host 0.0.0.0`. See [Troubleshooting](../limits/troubleshooting.md).

More on the service: [AI](../bindings/ai.md). How keys are kept: [Secrets](../cli/secrets.md).
