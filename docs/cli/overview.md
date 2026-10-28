---
title: The command line
description: Install cohostly, sign in, learn the habits every command shares, and find the command you need.
nav: Overview
---

`cohostly` is how you put an app online and look after it from your own computer. Think of it as a remote control for your projects. You press a button on your keyboard, and the platform does the work far away.

```bash
npm install -g cohostly
cohostly
```

Run with no arguments, it prints the list of commands and exits with code `1`. That is normal. It is the only built-in help there is.

> **Careful** The command has no `--help`, no `-h` and no `--version`. Typing one of them prints `Unknown command: --help`, then the command list, and exits with code `1`. Use the list you get from plain `cohostly`, and these pages.

## Two names, one program

`platform` is the same program under its older name. Both names work. Some messages the CLI prints still say `platform ...`, for example `Run "platform login"`. When you see that, type `cohostly` instead. The result is the same.

## What you need

- **Node.js 20 or later.**
- **macOS or Linux**, Intel or Arm, for `snapshot` and `check`. On Windows those two stop with `Capture runs on macOS and Linux. On Windows, use WSL2.` The other commands do not use the capture tool.
- **Docker**, only for `cohostly check`, which builds your app on your machine to prove it works. Nothing else needs it.
- **Railpack**, the open-source tool that plans builds. The CLI downloads it once, the first time `snapshot` or `check` needs it, and checks it against a pinned checksum.

## First five minutes

```bash
cohostly login                   # approve a code in your browser
cohostly new express hello       # a tiny starter app in ./hello
cd hello
cohostly deploy                  # build it and put it online
cohostly open                    # print the address and open it
```

## Every command, by what you want to do

- [Sign in and keys](login-and-keys.md): `login`, `logout`, `whoami`, and what the saved key can do.
- [Start a project from a template](new-templates.md): `new` and its six templates.
- [Put an app online](deploy.md): `deploy`, `manifest check`, upload limits, `.env` files, approvals.
- [Pack and inspect](pack.md): `pack`, `inspect` and deploying a sealed `.cohostly` file.
- [Deploy what already runs](snapshot.md): `snapshot`, `check`, and deploying from the `.cohostly/` folder.
- [Look after projects](projects.md): `ls`, `open`, `logs`.
- [Versions and rollback](versions-and-rollback.md): `versions`, `promote`, `rollback`.
- [Backup and restore](backup-and-restore.md): `backup`, `backups`, `restore`.
- [Share and name it](sharing.md): `share`, `domains`, `ship`.
- [Secrets](secrets.md): `secrets list`, `set`, `import`, `delete`, `share`, `request`.
- [Dev tokens](tokens.md): `token create --dev`, `list`, `revoke`.
- [AI keys](ai-keys.md): `ai-keys list`, `set`, `check`, `delete`.
- [Build and test locally](develop.md): `dev`, `types`, `bindings check`.
- [Cost](cost.md): `cost`, a plain-words estimate of AI and hosting spend.
- [Schedules and run](jobs-and-approvals.md): `schedules` and `run`, the jobs on a clock.
- [Approvals](approvals-command.md): `approvals`, the inbox of requests waiting on a person.
- [Exit codes and environment variables](exit-codes-and-env.md): what each exit code means, every variable the CLI reads, and what `Fatal:` means.

## Habits shared by all commands

| Habit | What it means |
| --- | --- |
| Project name | Most commands act on one project. Some take it as `--project <name>`, some as a plain word (`cohostly open hello`), some as both. Each page shows the exact form. |
| `--json` | These commands can print a machine-readable result: `logs`, `share`, `domains`, `schedules` (and `run`), `ship`, `approvals`, `cost`. The others cannot. |
| Secret values | Commands that take a secret (`secrets set`, `ai-keys set`) read it at a hidden prompt, or from a pipe. They never take it as an argument. The one exception is `login --token`, which puts a key on the command line. |
| Plain error text | Errors say what to fix. A failed deploy also prints a stable `Code:` such as `build_failed_dependency` (see [troubleshooting](../limits/troubleshooting.md)). |
| Questions | Only `deploy` ever asks a question. Everything else acts at once. That includes `restore`, `promote`, `rollback`, `secrets delete` and `share remove`. Read the command before you press Enter. |
| Aliases | `ls` is the same as `list`. `run <schedule>` is the same as `schedules run`. |

## Which projects you can reach

The saved key is tied to one account. With it, `cohostly ls` lists the projects of that account only. A project that someone shared with you by invitation, from a different account, does not appear in the CLI. See [sign in and keys](login-and-keys.md) for why.

## Read next

- [Sign in and keys](login-and-keys.md): the first thing every other page assumes.
- [Put an app online](deploy.md): the command you will use most.
- [Exit codes and environment variables](exit-codes-and-env.md): for scripts and CI.
