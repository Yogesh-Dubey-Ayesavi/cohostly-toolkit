---
title: Put an app you already have online
nav: Put your app online
description: Take an app that already runs on your computer, let Cohostly watch it work once, and get a web address to share.
---

## What you will do

You have a small web app. It runs on your laptop when you type `npm start`. You would like a friend to open it from their own computer, without you leaving your laptop on. In this walk-through you let Cohostly watch your app run once, so it learns how to start it. Then you send it up and get an address back.

This is the quickest way in because you change none of your code.

## What you need

- An app that runs on your computer. Node, Python and Go apps and plain websites work.
- Node 20 or later, to run the command line. macOS or Linux. Windows is not supported yet.
- The command line: `npm install -g cohostly`.
- Docker, only if you want the optional check in step 4.

## The steps

### 1. Sign in

```sh
cohostly login
```

It shows a short code. Approve it in your browser and you are signed in. Check with `cohostly whoami`.

### 2. Let Cohostly watch the app run once

Go to your app's folder. After the two dashes, type the command you would use to run the app for real.

```sh
cd my-app
cohostly snapshot -- npm start
```

Cohostly runs the app, waits a few seconds, and writes down what it saw. Use the real start command, not a "dev" mode that reloads on every change. A dev mode can record the wrong command and the wrong port.

> **Good to know** The command after `--` runs as it is, without a shell. If you need to change folder or set a value first, wrap it: `cohostly snapshot -- sh -c "cd web && npm start"`.

If your app is slow to wake up, give it longer than the 30 seconds it gets by default: `cohostly snapshot --timeout 60s -- npm start`.

### 3. Read what it wrote

A new hidden folder called `.cohostly/` now sits in your app's folder.

| File | What it is |
| --- | --- |
| `Dockerfile` | A recipe for building your app on the platform. Cohostly writes it again every time you run snapshot. |
| `cohostly.json` | The settings: name, port, start command, and the names of the values your app reads. You can edit this one. |
| `capture.json` | What Cohostly saw while your app ran. Read-only. |
| `env.enc` | The values your app read, locked so that only your account can deploy them. Safe to keep in version control. |

Open `.cohostly/Dockerfile` and look at the top. Two kinds of line matter:

- `TODO(cohostly): ...` is a question Cohostly could not answer and your app cannot run without, such as which port to use. `cohostly deploy` refuses to continue while one is open. Answer it by editing the file, or by fixing the cause and running snapshot again.
- `NOTE(cohostly): ...` is information, such as a value your app asked for that you had not set. It does not stop a deploy. Read it and decide whether it matters.

### 4. Optional: try the recipe on your computer

```sh
cohostly check
```

This builds and starts the same recipe that will be deployed, then compares it with your app. It needs Docker running. It never changes your files. If you do not have Docker, skip it. The platform builds the same recipe when you deploy.

### 5. Deploy

```sh
cohostly deploy --project my-app
```

Pick a project name nobody else uses. When the app is live, Cohostly prints its address. Only then is it online.

Watching the build line by line is optional: add `--verbose`.

### 6. Choose who can open it

Right after a deploy, only you and the people you invite can open the app. Deploying never changes this. Look at where it stands:

```sh
cohostly ls
```

Then choose. Each choice is one command:

```sh
cohostly share invite friend@example.com --project my-app          # one named person (a viewer)
cohostly share visibility account --project my-app                 # anyone in your Cohostly account
cohostly share visibility signed_in --project my-app               # anyone with a Cohostly account
cohostly share visibility link --project my-app                    # anyone who has the address
```

> **Good to know** `link` means anyone who has the address can open it, signed in or not. The address has a random ending, so it can not be guessed, but anyone you give it to can pass it on. If you are not an owner or admin of the account, a request to open an app wider waits for an owner or admin to approve it, and the app stays as it was until they do. More in [Sharing and roles](../settings/sharing-and-roles.md).

## What each part does

- `cohostly snapshot` is a recording. It does not change your app. It writes down the start command, the port your app answers on, and the names of the settings it read.
- `.cohostly/Dockerfile` is a recipe, written in an ordinary format that many tools understand. If you want to change how the app is built, copy it to `./Dockerfile` at the top of your folder and edit that copy. A Dockerfile in your folder is used as it is. It must have one stage only.
- `env.enc` holds your values, locked. Your keys and passwords are never written into the recipe or the settings file, and never appear on a command line. Each `env.enc` is made for one account and stops working after 30 days (change that with `--expires`, from `1d` to `30d`). After that, run snapshot again.
- `cohostly deploy` sends the folder up, builds it, starts it and waits until it answers.

## Try it

Open the address `cohostly deploy` printed. You should see your app, the same as on your laptop. Then run `cohostly open my-app` to open it in your browser, and `cohostly logs my-app` to see what the app printed.

## Make it yours

1. **Rename the project** by deploying with a different `--project`. It becomes a different app.
2. **Change a setting** such as the port by editing `.cohostly/cohostly.json`. To see the settings Cohostly will use and where each came from, run `cohostly manifest check`.
3. **Give it more room** if a build gets killed halfway: in `.cohostly/cohostly.json` set `"compute": { "vcpu": 2, "memory": 2048 }` and deploy again. The sizes are 512, 1024 and 2048 MB. Snapshot already picks a bigger size when your build looks heavy.

## If something goes wrong

- **Snapshot says nothing answered on a web port.** Your app may take longer than 30 seconds to start, or it may not be a web server. Run `cohostly snapshot --timeout 90s -- <your command>`.
- **Deploy stops on a `TODO(cohostly)` line.** Open `.cohostly/Dockerfile`, answer the question in the comment, or fix your app and snapshot again. `--force` deploys anyway, but only do that when you know the question does not matter.
- **The app starts but nothing opens.** The app is probably listening only on `127.0.0.1`, which means "this computer only". It must listen on `0.0.0.0`. Cohostly names this `binds_loopback`.
- **A build is killed in the middle.** It most likely ran out of memory. Raise the size one step as in "Make it yours".
- **Someone else sees "not found".** Not found means they are not allowed in, not that the app is down. Check the sharing level with `cohostly ls`.

More fixes are in [Troubleshooting](../limits/troubleshooting.md). Every `snapshot` option is on [Snapshot](../cli/snapshot.md).
