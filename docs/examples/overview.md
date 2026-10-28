---
title: Sample apps
nav: Overview
description: Small, complete apps explained in everyday words. Pick the one closest to what you want, copy it, and change it.
---

Each sample app on these pages is small enough to read in one sitting. Each one does a single useful thing, and each one is a real app that has been run against the platform, not a sketch. Copy one and change it. That is quicker and safer than writing the platform parts from memory.

> **Good to know** You do not need to be a programmer to follow along. Every page says what each part does in plain words, and every new word is explained the first time it shows up.

## Pick by what you want to do

- [Put an app you already have online](./put-your-app-online.md): Your app already runs on your own computer. Share it with other people without rewriting it.
- [A page that says hello](./hello-visitor.md): Greet signed-in people by name and show everyone else a sign-in link.
- [Private notes](./private-notes.md): A notepad where each person sees only their own notes.
- [An AI helper](./ai-helper.md): A page that answers questions with an AI model, with no key to look after.
- [A morning summary](./morning-summary.md): Something that runs by itself at 9:00 on weekdays, even while the app is asleep.
- [Ask before deleting](./ask-before-deleting.md): The app stops and waits until a person says yes.
- [A sign-up list in a Google Sheet](./signup-sheet.md): A form that adds each email to your spreadsheet.
- [A members-only page](./members-only-page.md): Different doors for viewers, editors and the owner.

## Words you will see

| Word | What it means here |
| --- | --- |
| Project | One app on Cohostly, with a name. Names are shared by everyone, so pick one nobody else has. |
| Deploy | Send your app to Cohostly so it gets a web address. Each deploy makes a new version. |
| Binding | A service the platform lends your app, such as a small database or an AI model. You list the ones you want in a settings file, and the app never holds the real keys. |
| `cohostly.json` | The settings file at the top of your app's folder. It says which services the app wants. |
| Visitor | A person who opens your app's address. |
| The `platform` object | A ready-made set of helpers in your code for talking to the services above. A command writes it for you. |

## Habits every sample follows

These are the same on every page, so once you know them you know all of them.

- **It listens on the right door.** A web app waits for visitors at a "port", which is like a numbered door. The samples read the number from `PORT` and fall back to 3000. The same number goes in `cohostly.json` under `health.port`, so the platform knows which door to knock on after a deploy.
- **It says which services it uses.** If a service is not listed in `cohostly.json`, the app cannot use it. A call to an unlisted service fails.
- **It treats "not yet" as normal.** A visitor who is not signed in, a person who has not agreed to share their name, a Google account nobody has connected yet, a question nobody has answered yet: none of these is a crash. The app shows something sensible.
- **It is safe to run twice.** Some things the platform can send to your app more than once, such as a timed job or an answer to "may I?". The samples remember what they already did, so a repeat does no harm.
- **It keeps nothing important on its own disk.** Apps sleep, restart and get replaced by new versions. Anything saved in a file can disappear. Things worth keeping go in the small database. See [How apps run](../start/how-apps-run.md).
- **It never holds a secret in the code.** Keys and passwords come from the platform when the app starts. See [Secrets](../cli/secrets.md).

## Before you start any of them

1. Install the command line: `npm install -g cohostly` (you need Node 20 or later).
2. Sign in once: `cohostly login`. It shows a code to approve in your browser.
3. Look at [the quickstart](../start/quickstart.md) if you have never deployed anything.

When an app is online, only you can open it at first. The sample pages say when and how to open it wider, using [`cohostly share`](../cli/sharing.md).

## Where the code comes from

The samples are copies of the example apps in the toolkit repository, under `skills/cohostly-app-code/assets/examples/`. There is also a script there, `scripts/scaffold.sh`, that copies one into a new folder for you.
