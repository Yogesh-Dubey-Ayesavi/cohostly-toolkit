# ai-chat-fastapi

A Python API with one route that asks a model a question.

- **Shows:** the AI gateway through the stock OpenAI client (`AI_BASE_URL`, `AI_API_KEY`), the model allow-list and the monthly cap in the manifest, and a start command for a Python app.
- **Bindings:** `ai`. The model named in the code must be in `bindings.ai.models`, or the call fails with a plain message.
- **Not here:** a provider key. There is none to set.

```bash
curl -X POST "$APP_URL/ask" -H 'content-type: application/json' -d '{"question":"hello"}'
```

Read `references/bindings.md` ("Calling it from an ordinary client").
