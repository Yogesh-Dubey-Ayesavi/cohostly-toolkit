---
title: A page that says hello
nav: Say hello
description: Greet signed-in people by name, and show everyone else a link to sign in.
---

## What you will build

A one-page app. When a signed-in person opens it, it says "Hello, Priya". When someone who is not signed in opens it, it says "Hello" and offers a sign-in link. It never makes up a name for anyone who has not shared theirs.

This one uses no extra service. Every visit already arrives with a small signed note from the platform that says who is visiting. The app only has to read it.

## What you need

- Node 20 or later, and the command line (`npm install -g cohostly`).
- Three files in one new folder.

## The files

```json title="package.json"
{
  "name": "visitor-greeting",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": { "@cohostly/sdk": "^0.2.1", "express": "^4.19.2" }
}
```

```json title="cohostly.json"
{
  "manifest_version": 2,
  "name": "visitor-greeting",
  "health": { "port": 3000 },
  "context": { "preset": "friendly" }
}
```

```js title="server.js"
import express from 'express'
import { middleware, loginUrl } from '@cohostly/sdk'

const app = express()

// Verifies the signed context on every request. required: false lets anonymous visitors in, which is a normal state.
app.use(middleware({ required: false }))

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

app.get('/', (req, res) => {
  const caller = req.platform?.caller
  if (caller?.kind === 'person') {
    // caller.name needs the "friendly" preset AND the person's consent, so it can be missing. Do not invent a name.
    return res.send(`<h1>${caller.name ? `Hello, ${esc(caller.name)}` : 'Hello'}</h1>`)
  }
  res.send(`<h1>Hello</h1><p><a href="${esc(loginUrl('/'))}">Sign in</a> to be greeted by name.</p>`)
})

app.listen(process.env.PORT || 3000)
```

## What each part does

**`package.json`** lists the two helper packages the app uses. `express` makes it easy to answer web requests. `@cohostly/sdk` is Cohostly's own helper for reading the note about who is visiting. `npm start` runs `node server.js`.

**`cohostly.json`** is the settings file.

- `name` is the project's name.
- `health.port` is the numbered door the app listens on. It must match the number in the code (3000).
- `context.preset: "friendly"` asks the platform to include the visitor's name in the note. Without it, the name is never sent. The default preset, `basic`, sends less. Even with `friendly`, a name only arrives if the person agreed to share it.

**`server.js`**

- `app.use(middleware({ required: false }))` checks the signed note on every visit. The note has a lock that only the platform can close, so a visitor cannot forge it. `required: false` means "let people in even without a valid note". A visitor who is not signed in is a normal case here, not an error.
- `req.platform?.caller` is the checked note about who is visiting. `kind === 'person'` means a signed-in person.
- If there is a name, it says hello with the name. If not, it says plain "Hello". It never shows "Guest" as if that were their name.
- `esc(...)` makes the name safe to put in a page, so a name that contains page code is shown as text instead of being run.
- `loginUrl('/')` builds the address of the sign-in page, and brings the person back to `/` afterwards.
- The last line starts the app on the port from `PORT`, or 3000.

> **Good to know** Do not read the visitor's name from a plain request header and trust it. Anyone can send any header. Only the signed note, checked by `middleware`, is the platform's own word.

## Put it online

```sh
cohostly login
npm install
cohostly dev --project visitor-greeting -- npm start    # try it on your computer first
cohostly deploy --project visitor-greeting
```

`cohostly dev` runs your app here with the platform's addresses and the project's secrets in its environment, and writes nothing to disk. The first deploy creates the project.

Right after deploying, only you can open it. To let people try the sign-in, open it wider:

```sh
cohostly share visibility link --project visitor-greeting
```

`link` means anyone who has the address can open it, signed in or not. See [Sharing and roles](../settings/sharing-and-roles.md).

## Try it

1. Open the address in a window where you are signed in to Cohostly. You should see "Hello" and your name, if you have agreed to share it.
2. Open it in a private window, signed out. You should see "Hello" and a "Sign in" link. Click it, sign in, and you come back to the page with your name.

## Make it yours

1. Change the words: edit the two `res.send(...)` lines.
2. Show more about the visitor. The note can carry other facts, such as a rough place or time zone. [The visitor fields](../sdk/request-context.md) list the exact names and which setting reveals each one. Places are guesses from the network, so say "around" when you show one.
3. Show something extra only to signed-in people, such as a link to a private page, and a different message to everyone else.

## If something goes wrong

- **It always says plain "Hello" even when I am signed in.** Either the setting is missing (`context.preset` must be `friendly`) or you have not agreed to share your name. A missing name is a normal answer.
- **A sign-in link appears even though I am signed in.** You opened the address in a window where you are not signed in to Cohostly, or through a different address.
- **Deploy works but the page shows an error.** Check that the port in the code and `health.port` match. See [Troubleshooting](../limits/troubleshooting.md).

Next: [Private notes](./private-notes.md) keeps something for each person. The fields in the signed note are listed in [the request context](../sdk/request-context.md).
