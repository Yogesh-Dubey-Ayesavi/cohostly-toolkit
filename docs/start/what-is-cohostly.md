---
title: What is Cohostly
description: A shared home for apps, with sharing, hosting and a few built-in services, so you can skip building those.
---

Think of a restaurant that rents out a kitchen. You bring the recipe, which is your app. The restaurant gives you the stove, the fridge and a table with a name card on it. You do not buy a stove. Cohostly does the same for apps.

## The three jobs

1. **Hosting.** Your app gets a web address. It runs when someone visits and goes to sleep when nobody does, so you are not paying for an idle machine.
2. **Sharing.** You choose who can open it: only you, only people you invite, your team, anyone with a Cohostly account, anyone with the link, or the whole internet. You can change your mind at any time.
3. **Bindings.** Services the platform lends to your app: a small database, AI models, access to a person's Google or Microsoft account, a way to ask a person "is this okay?" before doing something risky, and a clock that wakes your app at set times. Your app asks; the platform does the heavy and risky part, and no secret key ever sits inside your app.

## What you actually install

| Piece | Name | What it is for |
| --- | --- | --- |
| Command line | `cohostly` | Put an app online, share it, look after it. Runs on your own computer. |
| SDK | `@cohostly/sdk` | A package your app imports to find out who is visiting and to use bindings. |
| Skills | `cohostly-host`, `cohostly-app-code` | Instructions that teach an AI coding assistant to do both of the above. |

## Words we use

You will meet these words again. Here they are once, in plain language.

| Word | What it means |
| --- | --- |
| Project | One app on Cohostly, with a name, versions and settings. |
| Version | One build of your project. Every deploy makes a new one. Old ones are kept so you can go back. |
| Binding | A service the platform lends your app. Your app declares which ones it needs. |
| Visitor | Anyone opening your app. They may be signed in, or not. |
| Settings file | `cohostly.json`, a short file next to your code that says things like "this app needs a database". Most apps need none. |
| Account | The workspace that owns projects. People in it are an owner, an admin or a member. |
| Secret | A value like a password or an API key that your app needs but that must never sit in your code. |

## What Cohostly is not

- It is not a place for apps that must run all day without pause. Apps sleep when idle. [How apps run](how-apps-run.md) explains the details.
- It is not a disk. Files an app writes while running can disappear. Keep information in the database binding instead.
- It does not run every language. Node, Python, Go and plain websites work today.
- It does not yet show prices. Costs are estimates, not a bill.

> **Good to know** The platform itself (the part that runs apps) is not in this toolkit. These docs describe what you touch: the CLI, the SDK, the settings file and the behaviour you can rely on.

Next: [put an app online in five minutes](quickstart.md).
