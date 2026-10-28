---
title: Quickstart
description: Install the CLI, sign in, and get a link to your app in about five minutes.
---

You need Node.js 20 or later, and an app that runs on your computer (a Node, Python or Go app, or a folder of plain web files). No app yet? Make a tiny one with `cohostly new`.

## 1. Install and sign in

```bash
npm install -g cohostly      # or use npx cohostly <command> without installing
cohostly login
```

`login` shows a short code and opens your browser. Approve the code in the dashboard and you are signed in. In a script or CI there is no browser, so use a key made in the dashboard instead: `cohostly login --token plk_...`.

## 2. Start a tiny app (or use your own)

```bash
cohostly new express hello
cd hello
```

The templates are `static`, `flask`, `fastapi`, `express`, `go` and `nextjs`. Each one runs as it is.

## 3. Deploy

```bash
cohostly deploy --project hello
```

Cohostly looks at your folder, works out the language, the start command and the port, and shows you what it decided. Answer yes and it builds and starts the app. At the end it prints the address.

> **Good to know** In a script with no keyboard, `deploy` does not ask. Run `cohostly deploy --draft` first to read the plan, then deploy with `--yes` once you agree with it.

## 4. Decide who can open it

A new project is private: only you and your account's owners and admins can open it. To show it to someone else:

```bash
cohostly share invite friend@example.com --project hello
cohostly share visibility link --project hello      # anyone with the address
```

Opening an app to everyone with the link means exactly that. Anyone who has the address can open it. The address has a random ending, so it cannot be guessed, but it can be passed around.

## 5. Look at it

```bash
cohostly open hello          # opens the address in your browser
cohostly logs hello -f       # watches what the app prints
cohostly ls                  # your projects and their state
```

## An app that already runs on your laptop

If your app is more than a template (it reads settings, needs special packages, starts with a particular command), let Cohostly watch it run once:

```bash
cohostly snapshot -- npm start
cohostly deploy
```

`snapshot` starts your app, watches it for a few seconds and writes down what it really needs. [The snapshot page](../cli/snapshot.md) explains what it writes and how to fix the questions it asks.

## What next

- [How apps run](how-apps-run.md): sleeping, memory and why files do not last.
- [The command line](../cli/overview.md): everything `cohostly` can do.
- [Sample apps](../examples/overview.md): a notes app, an AI helper, a morning summary and more.
