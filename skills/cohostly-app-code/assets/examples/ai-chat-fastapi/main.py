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
