---
title: SDK setup
description: Install @cohostly/sdk and see what it gives your app.
nav: Setup
---

`@cohostly/sdk` is a small package your app imports. Your app does not need it to be hosted. You add it when the app wants to know who is visiting, or wants to use a [binding](../bindings/overview.md).

```bash
npm install @cohostly/sdk
```

- **Node.js 20 or later.**
- **ES modules only.** Use `import`, not `require`. Set `"type": "module"` in `package.json`, or use `.mjs` files.
- **TypeScript or JavaScript.** Types are included.
- Python and Go clients are planned. For now, those languages use the [verification steps](other-languages.md) and the stock HTTP description of each binding.

## What it gives you

| Piece | What it is for |
| --- | --- |
| `context`, `middleware`, `me`, `loginUrl` | Find out who is visiting, safely. See [request context](request-context.md). |
| `platform` (generated) | Typed methods for the services your app declared. See [the platform object](platform-object.md). |
| `PlatformError` | One kind of error with a plain message and a fix. |
| `platform.cron`, `platform.approvals` | Helpers for the clock and for asking a person first. |
| `logger`, `requestId` | Log lines you can follow from the platform's edge to your app. |
| `cohostly-sdk types` | The type generator, if you prefer it to `cohostly types`. |

## The two-minute version

```js title="server.js"
import express from 'express'
import { middleware, loginUrl } from '@cohostly/sdk'

const app = express()
app.use(middleware({ required: false }))     // checks who is visiting on every request

app.get('/', (req, res) => {
  const who = req.platform?.caller
  res.send(who?.kind === 'person'
    ? '<h1>Welcome back</h1>'
    : `<h1>Hello</h1><a href="${loginUrl('/')}">Sign in</a>`)
})

app.listen(process.env.PORT || 3000)
```

`req.platform` holds the checked facts about the visitor. When nobody is signed in, `caller.kind` is `anonymous`, which is a normal state and not an error.

## Running it on your machine

Outside the platform there is no token and no service address. Start your app through `cohostly dev` and it gets them for the length of that run:

```bash
cohostly dev --project my-app -- node server.js
```

Without that, a binding call fails with `not_configured` and tells you to do this.

## Logging that can be followed

```js
import { logger } from '@cohostly/sdk'

app.get('/work', (req, res) => {
  const log = logger(req)
  log.info('starting work')        // written as: [req:abc123] starting work
  res.send('ok')
})
```

The platform gives every request an id. A line starting `[req:<id>]` comes out of the platform's logs with that id as its own field, so one request can be followed from the edge into your app. Do not log emails or locations.
